<script setup lang="ts">
import { AgGridVue } from 'ag-grid-vue3'
import {
  AllCommunityModule,
  ModuleRegistry,
  type ColDef,
  type GridApi,
  type GridReadyEvent,
  type RowDoubleClickedEvent,
  type RowSelectionOptions,
  type SpanRowsParams,
} from 'ag-grid-community'
import { computed, nextTick, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ScreenHeaderField from '@/components/ScreenHeaderField.vue'
import { fetchParties, getApiBaseUrl, getAuthHeaders } from '@/api/client'
import { PARTIES as MOCK_PARTIES } from '@/constants/mockData'
import type { CodeMasterItem } from '@/types/master'
import type { HeaderFieldSpec, ListResultColumn, ListScreenSpec } from '@/features/screen-engine/screenSpecTypes'
import { resolveListScreenSpec } from '@/features/screen-engine/listScreenSpecRegistry'
import { useKeySpec } from '@/features/screen-engine/useKeySpec'
import { useListSearchEnterNav } from '@/features/screen-engine/useListSearchEnterNav'

import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-balham.css'

ModuleRegistry.registerModules([AllCommunityModule])

const route = useRoute()
const router = useRouter()

const screenSpecId = computed(
  () => (route.meta.screenSpecId ?? 'order-list') as string,
)

const spec = computed(() => resolveListScreenSpec(screenSpecId.value))

function initSearchRecord(fields: readonly HeaderFieldSpec[]): Record<string, unknown> {
  const o: Record<string, unknown> = {}
  for (const f of fields) {
    o[f.id] = f.editorType === 'masterCombobox' ? null : ''
  }
  return o
}

const searchHeader = reactive<Record<string, unknown>>(initSearchRecord(spec.value.searchFields))

watch(screenSpecId, () => {
  Object.assign(searchHeader, initSearchRecord(spec.value.searchFields))
  rowData.value = []
  gridApi.value?.deselectAll()
  updateSelectedCount()
})

const parties = ref<CodeMasterItem[]>([])
const rowData = ref<Record<string, unknown>[]>([])
const loading = ref(false)
const selectedCount = ref(0)

/** F12 二重発火・連打で古い fetch のエラーアラートが出ないよう世代を管理する */
let searchSeq = 0

const popupParentEl = shallowRef<HTMLElement | null>(null)
const gridApi = shallowRef<GridApi<Record<string, unknown>> | null>(null)

const headerRefs = shallowRef(new Map<string, { focus: () => void }>())

function bindHeaderRef(id: string, el: unknown) {
  const m = new Map(headerRefs.value)
  if (
    el &&
    typeof el === 'object' &&
    el !== null &&
    'focus' in el &&
    typeof (el as { focus: unknown }).focus === 'function'
  ) {
    m.set(id, el as { focus: () => void })
  } else {
    m.delete(id)
  }
  headerRefs.value = m
}

const headerFieldRefCallbacks = new Map<string, (el: unknown) => void>()
function headerFieldRef(fieldId: string) {
  let cb = headerFieldRefCallbacks.get(fieldId)
  if (!cb) {
    cb = (el: unknown) => bindHeaderRef(fieldId, el)
    headerFieldRefCallbacks.set(fieldId, cb)
  }
  return cb
}

const enterOrder = computed(() => spec.value.searchFieldEnterOrder)

const { focusNextAfter, focusFirstInSearchChain } = useListSearchEnterNav({
  enterOrder,
  getHeaderFocusMap: () => headerRefs.value,
})

function buildSearchQueryParams(s: ListScreenSpec, header: Record<string, unknown>): URLSearchParams {
  const q = new URLSearchParams()
  const mapping = s.searchParamMapping ?? {}
  for (const field of s.searchFields) {
    const paramName = mapping[field.id] ?? field.id
    if (field.editorType === 'masterCombobox') {
      const code = (header[field.id] as { code?: string } | null)?.code
      if (code) q.set(paramName, code)
      continue
    }
    const str = String(header[field.id] ?? '').trim()
    if (str) q.set(paramName, str)
  }
  return q
}

async function runSearch() {
  const seq = ++searchSeq
  const s = spec.value
  const qs = buildSearchQueryParams(s, searchHeader).toString()
  const path = `${s.searchAction.apiPath}${qs ? '?' + qs : ''}`
  const url = `${getApiBaseUrl()}${path}`
  loading.value = true
  try {
    const res = await fetch(url, { headers: getAuthHeaders() })
    if (seq !== searchSeq) return
    if (!res.ok) throw new Error(`検索に失敗しました (${res.status})`)
    const data = (await res.json()) as unknown
    if (seq !== searchSeq) return
    if (!Array.isArray(data)) throw new Error('一覧の形式が不正です')
    rowData.value = data as Record<string, unknown>[]
  } catch (e) {
    if (seq !== searchSeq) return
    console.error(e)
    alert(e instanceof Error ? e.message : '検索に失敗しました')
  } finally {
    if (seq === searchSeq) loading.value = false
  }
  if (seq !== searchSeq) return
  await nextTick()
  try {
    gridApi.value?.deselectAll()
  } catch (e) {
    console.warn('deselectAll:', e)
  }
  updateSelectedCount()
}

function clearSearch() {
  Object.assign(searchHeader, initSearchRecord(spec.value.searchFields))
  rowData.value = []
  gridApi.value?.deselectAll()
  updateSelectedCount()
  requestAnimationFrame(() => focusFirstInSearchChain())
}

function formatCalendarDate(v: unknown): string {
  if (v == null || v === '') return ''
  const s = String(v)
  const m = /^\d{4}-\d{2}-\d{2}/.exec(s)
  return m ? m[0].replaceAll('-', '/') : s
}

function formatDateTime(v: unknown): string {
  if (v == null || v === '') return ''
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toLocaleString('ja-JP', { dateStyle: 'short', timeStyle: 'medium' })
}

function formatNumber(v: unknown): string {
  if (v == null || v === '') return ''
  const n = Number(v)
  if (Number.isNaN(n)) return String(v)
  return new Intl.NumberFormat('ja-JP').format(n)
}

function formatCellValue(v: unknown, format?: ListResultColumn['format']): string {
  if (format === 'number') return formatNumber(v)
  if (format === 'date') {
    const s = String(v ?? '')
    return s.includes('T') ? formatDateTime(v) : formatCalendarDate(v)
  }
  return v == null ? '' : String(v)
}

function spanRowsByGroupField(field: string) {
  return (p: SpanRowsParams<Record<string, unknown>, unknown>): boolean => {
    const a = p.nodeA?.data?.[field]
    const b = p.nodeB?.data?.[field]
    return a != null && a === b
  }
}

const columnDefs = computed((): ColDef<Record<string, unknown>>[] => {
  const groupField = spec.value.spanRowsGroupField
  const spanByGroup = groupField ? spanRowsByGroupField(groupField) : null
  return spec.value.resultColumns.map((c) => {
    const def: ColDef<Record<string, unknown>> = {
      field: c.field,
      headerName: c.headerName,
      width: c.width,
      valueFormatter: (p) => formatCellValue(p.value, c.format),
    }
    if (c.spanRows) {
      def.spanRows = spanByGroup ?? true
    }
    if (c.align === 'right') {
      def.cellClass = 'ag-right-aligned-cell'
      def.headerClass = 'ag-right-aligned-header'
    }
    return def
  })
})

const defaultColDef = computed(
  (): ColDef => ({
    sortable: true,
    filter: false,
    resizable: true,
    suppressHeaderMenuButton: true,
  }),
)

const rowIdField = computed(
  () =>
    spec.value.listRowIdField ??
    spec.value.deleteAction?.idField ??
    spec.value.rowNavigation.paramField,
)

function countDistinctField(rows: readonly Record<string, unknown>[], field: string): number {
  const seen = new Set<string>()
  for (const r of rows) {
    const v = r[field]
    if (v == null || v === '') continue
    seen.add(typeof v === 'number' ? String(v) : String(v))
  }
  return seen.size
}

const toolbarSummaryText = computed(() => {
  if (loading.value) return '読み込み中…'
  const n = rowData.value.length
  const distinctKey = spec.value.toolbarOrderDistinctField
  if (!distinctKey) return `${n} 件`
  const orders = countDistinctField(rowData.value, distinctKey)
  return `明細 ${n} 行 · 受注 ${orders} 件`
})

const rowSelection = computed(
  (): RowSelectionOptions<Record<string, unknown>> => ({
    mode: 'multiRow',
  }),
)

function onGridReady(e: GridReadyEvent<Record<string, unknown>>) {
  gridApi.value = e.api
}

function updateSelectedCount() {
  const api = gridApi.value
  selectedCount.value = api ? api.getSelectedRows().length : 0
}

async function handleDelete() {
  const del = spec.value.deleteAction
  if (!del) return
  const api = gridApi.value
  if (!api) return
  const rows = api.getSelectedRows()
  if (rows.length === 0) {
    alert('削除する行を選択してください。')
    return
  }
  if (!confirm(del.confirmMessage)) return
  const idField = del.idField
  const orderIds = new Set<number>()
  for (const row of rows) {
    const raw = row[idField]
    const id = typeof raw === 'number' ? raw : Number(raw)
    if (!Number.isFinite(id)) continue
    orderIds.add(id)
  }
  const ids = [...orderIds]
  if (ids.length === 0) {
    alert('有効な ID が取得できませんでした。')
    return
  }
  try {
    for (const id of ids) {
      const url = `${getApiBaseUrl()}${del.apiPath}/${id}`
      const res = await fetch(url, { method: 'DELETE', headers: getAuthHeaders() })
      if (!res.ok) throw new Error(`削除に失敗しました (${res.status})`)
    }
    await runSearch()
  } catch (e) {
    console.error(e)
    alert(e instanceof Error ? e.message : '削除に失敗しました')
  }
}

function onRowDoubleClicked(e: RowDoubleClickedEvent<Record<string, unknown>>) {
  const data = e.data
  if (!data) return
  const param = spec.value.rowNavigation.paramField
  const raw = data[param]
  if (raw == null) return
  void router.push({
    name: spec.value.rowNavigation.routeName,
    params: { id: String(raw) },
  })
}

function handleEdit() {
  const api = gridApi.value
  if (!api) return
  const rows = api.getSelectedRows()
  if (rows.length === 0) {
    alert('変更する行を選択してください。')
    return
  }
  const first = rows[0]
  if (!first) return
  const param = spec.value.rowNavigation.paramField
  const raw = first[param]
  if (raw == null) return
  void router.push({
    name: spec.value.rowNavigation.routeName,
    params: { id: String(raw) },
  })
}

useKeySpec(
  () => spec.value.keySpec,
  {
    search: runSearch,
    clearSearch,
    edit: handleEdit,
  },
)

onMounted(() => {
  popupParentEl.value = document.body
  requestAnimationFrame(() => focusFirstInSearchChain())
  void (async () => {
    try {
      parties.value = await fetchParties()
    } catch (e) {
      console.error('マスタ取得失敗:', e)
      parties.value = [...MOCK_PARTIES]
    }
  })()
})
</script>

<template>
  <div class="page">
    <header class="hdr">
      <h1 class="hdr-title">{{ spec.title }}</h1>
      <div class="hdr-actions">
        <button type="button" class="btn btn-outline" :disabled="loading" @click="clearSearch">
          条件クリア（F01）
        </button>
        <button type="button" class="btn btn-primary" :disabled="loading" @click="runSearch">
          検索（F12）
        </button>
      </div>
    </header>

    <div class="body">
      <main class="main">
        <section class="card header-card">
          <p class="hint">検索条件（Enter で次項目）</p>
          <div class="header-grid">
            <ScreenHeaderField
              v-for="field in spec.searchFields"
              :key="field.id"
              :ref="headerFieldRef(field.id)"
              v-model="searchHeader[field.id]!"
              :field="field"
              :parties="parties"
              @enter-next="focusNextAfter(field.id)"
            />
          </div>
        </section>

        <section class="card toolbar-card">
          <div class="toolbar">
            <button
              type="button"
              class="btn btn-outline"
              :disabled="loading || selectedCount === 0"
              @click="handleEdit"
            >
              変更（F10）
            </button>
            <button
              v-if="spec.deleteAction"
              type="button"
              class="btn btn-danger"
              :disabled="loading || selectedCount === 0"
              @click="handleDelete"
            >
              削除
            </button>
            <span class="count">{{ toolbarSummaryText }}</span>
          </div>
        </section>

        <section class="card grid-card">
          <div class="ag-theme-balham grid-wrap">
            <AgGridVue
              v-model="rowData"
              theme="legacy"
              style="width: 100%; height: 100%"
              :popup-parent="popupParentEl"
              :column-defs="columnDefs"
              :default-col-def="defaultColDef"
              :enable-cell-span="true"
              :get-row-id="(p: { data: Record<string, unknown> }) => String(p.data[rowIdField] ?? '')"
              :row-selection="rowSelection"
              :enter-navigates-vertically="false"
              :enter-navigates-vertically-after-edit="false"
              @grid-ready="onGridReady"
              @row-double-clicked="onRowDoubleClicked"
              @selection-changed="updateSelectedCount"
            />
          </div>
        </section>
      </main>
    </div>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  min-height: 0;
  background: #dfe6ec;
  color: #0f172a;
  font-family: ui-sans-serif, system-ui, sans-serif;
}
.hdr {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  border-bottom: 1px solid #94a3b8;
  background: #cfd8e3;
}
.hdr-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  font-family: ui-monospace, monospace;
}
.hdr-actions {
  display: flex;
  gap: 8px;
}
.btn {
  padding: 6px 12px;
  font-size: 13px;
  font-family: ui-monospace, monospace;
  cursor: pointer;
  border-radius: 4px;
}
.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.btn-outline {
  border: 1px solid rgba(0, 0, 0, 0.35);
  background: #fff;
  color: inherit;
}
.btn-primary {
  border: none;
  background: #1976d2;
  color: #fff;
}
.btn-danger {
  border: 1px solid #b91c1c;
  background: #fef2f2;
  color: #991b1b;
}
.body {
  display: flex;
  flex: 1;
  min-height: 0;
}
.main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  overflow: hidden;
}
.card {
  border: 1px solid #9aa7b8;
  border-radius: 0;
  background: #eef2f6;
}
.header-card {
  padding: 12px;
}
.toolbar-card {
  padding: 8px 12px;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
}
.count {
  font-size: 13px;
  font-family: ui-monospace, monospace;
  color: #475569;
}
.hint {
  margin: 0 0 8px;
  font-size: 12px;
  color: #64748b;
  font-family: ui-monospace, monospace;
}
.header-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}
@media (min-width: 768px) {
  .header-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
.grid-card {
  flex: 1;
  min-height: 280px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #f7f9fc;
}
.grid-wrap {
  flex: 1;
  min-height: 0;
  padding: 4px;
}
</style>
