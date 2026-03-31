<script setup lang="ts">
import type { CellValueChangedEvent, ColDef, GridApi, GridReadyEvent } from 'ag-grid-community'
import { computed, nextTick, onMounted, reactive, ref, shallowRef } from 'vue'
import { fetchParties } from '@/api/client'
import { PARTIES as MOCK_PARTIES } from '@/constants/mockData'
import type { HeaderFieldSpec } from '@/features/screen-engine/screenSpecTypes'
import { useGridEnterNav } from '@/features/screen-engine/useGridEnterNav'
import { useKeySpec } from '@/features/screen-engine/useKeySpec'
import { applyPurchaseCommitSpec } from '@/features/purchase-screen/purchaseCommitRules'
import {
  buildPurchaseColumnDefs,
  createEmptyPurchaseRows,
  createNextPurchaseRow,
} from '@/features/purchase-screen/purchaseGrid'
import { PURCHASE_NEW_SPEC } from '@/features/purchase-screen/purchaseNewSpec'
import type { PurchaseLineRow } from '@/features/purchase-screen/purchaseTypes'
import type { CodeMasterItem } from '@/types/master'
import RegistrationScreenShell from '@/views/RegistrationScreenShell.vue'

function initHeaderRecord(fields: readonly HeaderFieldSpec[]): Record<string, unknown> {
  const o: Record<string, unknown> = {}
  for (const f of fields) {
    o[f.id] = f.editorType === 'masterCombobox' ? null : ''
  }
  return o
}

const purchaseHeader = reactive<Record<string, unknown>>(
  initHeaderRecord(PURCHASE_NEW_SPEC.headerFields),
)
const purchaseRowData = ref<PurchaseLineRow[]>(createEmptyPurchaseRows())
const parties = ref<CodeMasterItem[]>([])
const products = ref<CodeMasterItem[]>([])
const gridApiPurchase = shallowRef<GridApi<PurchaseLineRow> | null>(null)

const purchaseNav = useGridEnterNav<PurchaseLineRow>({
  editChainColIds: computed(() => PURCHASE_NEW_SPEC.navigationSpec.gridEditChainColIds),
  enterStopEditingColIds: computed(
    () => PURCHASE_NEW_SPEC.navigationSpec.gridEnterStopEditingColIds,
  ),
  gridApi: gridApiPurchase,
  rowData: purchaseRowData,
  createNextRow: createNextPurchaseRow,
  autocompleteAwareColId: null,
})

function formatJstCalendarDatePlusDays(addDays: number): string {
  const timeZone = 'Asia/Tokyo'
  const now = new Date()
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  })
  const parts = dtf.formatToParts(now)
  const y = Number(parts.find((p) => p.type === 'year')?.value)
  const m = Number(parts.find((p) => p.type === 'month')?.value)
  const d = Number(parts.find((p) => p.type === 'day')?.value)
  const rolled = new Date(Date.UTC(y, m - 1, d + addDays))
  const yy = rolled.getUTCFullYear()
  const mm = rolled.getUTCMonth() + 1
  const dd = rolled.getUTCDate()
  return `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
}

function onDateFieldFocus(field: HeaderFieldSpec) {
  if (field.editorType !== 'date' || field.defaultDatePlusDays == null) return
  if (String(purchaseHeader[field.id] ?? '') === '') {
    purchaseHeader[field.id] = formatJstCalendarDatePlusDays(field.defaultDatePlusDays)
  }
}

function snapshotPurchaseRowsFromGrid(): PurchaseLineRow[] {
  const api = gridApiPurchase.value
  if (!api) return purchaseRowData.value
  const rows: PurchaseLineRow[] = []
  api.forEachLeafNode((node) => {
    if (node.data) rows.push(node.data)
  })
  rows.sort((a, b) => a.lineNo - b.lineNo)
  return rows
}

const shellRef = ref<InstanceType<typeof RegistrationScreenShell> | null>(null)

function handleNew() {
  purchaseNav.resetEnterNavAdvance()
  gridApiPurchase.value?.stopEditing(true)
  Object.assign(purchaseHeader, initHeaderRecord(PURCHASE_NEW_SPEC.headerFields))
  purchaseRowData.value = createEmptyPurchaseRows()
  requestAnimationFrame(() => shellRef.value?.focusFirstInHeaderChain())
}

async function handleSave() {
  gridApiPurchase.value?.stopEditing(false)
  await nextTick()
  console.info('[発注保存モック]', {
    header: { ...purchaseHeader },
    lines: snapshotPurchaseRowsFromGrid().filter(
      (r) => r.materialCode.trim() !== '' || r.qty > 0,
    ),
  })
  alert('発注を保存しました（コンソールにモック出力）')
  handleNew()
}

useKeySpec(
  () => PURCHASE_NEW_SPEC.keySpec,
  {
    new: handleNew,
    save: handleSave,
  },
)

function onGridReady(e: GridReadyEvent<PurchaseLineRow>) {
  gridApiPurchase.value = e.api
}

function onCellValueChanged(e: CellValueChangedEvent<PurchaseLineRow>) {
  applyPurchaseCommitSpec(e)
}

const purchaseColumnDefs = computed(() => buildPurchaseColumnDefs())

const defaultColDef = computed((): ColDef => ({
  sortable: false,
  filter: false,
  resizable: true,
  suppressHeaderMenuButton: true,
  suppressKeyboardEvent: purchaseNav.suppressEnterWhileEditing as ColDef['suppressKeyboardEvent'],
}))

function getRowId(p: { data: PurchaseLineRow }) {
  return String(p.data.lineNo)
}

onMounted(() => {
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
  <RegistrationScreenShell
    ref="shellRef"
    v-model:row-data="purchaseRowData"
    :title="PURCHASE_NEW_SPEC.title"
    :grid-hint="PURCHASE_NEW_SPEC.gridHint"
    :header-fields="PURCHASE_NEW_SPEC.headerFields"
    :navigation-spec="PURCHASE_NEW_SPEC.navigationSpec"
    :header="purchaseHeader"
    :column-defs="purchaseColumnDefs"
    :default-col-def="defaultColDef"
    :get-row-id="getRowId as (params: { data: unknown }) => string"
    :parties="parties"
    :products="products"
    @grid-ready="onGridReady"
    @cell-value-changed="onCellValueChanged"
    @cell-editing-stopped="purchaseNav.onCellEditingStopped"
    @new="handleNew"
    @save="handleSave"
    @date-focus="onDateFieldFocus"
  />
</template>
