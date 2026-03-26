<script setup lang="ts">
import { AgGridVue } from 'ag-grid-vue3'
import {
  AllCommunityModule,
  ModuleRegistry,
  type CellEditingStoppedEvent,
  type CellValueChangedEvent,
  type ColDef,
  type GridApi,
  type GridReadyEvent,
  type SuppressKeyboardEventParams,
} from 'ag-grid-community'
import { computed, onMounted, onUnmounted, ref, shallowRef } from 'vue'
import MasterCombobox from '@/components/MasterCombobox.vue'
import ProductCodeCellEditor from '@/components/grid/ProductCodeCellEditor.vue'
import { PARTIES, PRODUCTS } from '@/constants/mockData'
import type { CodeMasterItem } from '@/constants/mockData'
import type { OrderLine } from '@/types/order'

import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-balham.css'

ModuleRegistry.registerModules([AllCommunityModule])

const popupParentEl = shallowRef<HTMLElement | null>(null)

type OrderLineRow = OrderLine & { lineNo: number }

const INITIAL_ROWS = 18

function createEmptyRows(): OrderLineRow[] {
  return Array.from({ length: INITIAL_ROWS }, (_, i) => ({
    lineNo: i + 1,
    productCode: '',
    productName: '',
    quantity: 0,
    unitPrice: 0,
    amount: 0,
  }))
}

const EDIT_COLS = ['productCode', 'quantity', 'unitPrice'] as const
const ENTER_NAV_COL_KEYS = new Set<string>(['quantity', 'unitPrice'])

function isAutocompleteListOpen(input: EventTarget | null): boolean {
  if (!(input instanceof HTMLInputElement)) return false
  return input.getAttribute('aria-expanded') === 'true'
}

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

const contractParty = ref<CodeMasterItem | null>(null)
const deliveryParty = ref<CodeMasterItem | null>(null)
const deliveryLocation = ref('')
const dueDate = ref('')
const forecastNumber = ref('')

const rowData = ref<OrderLineRow[]>(createEmptyRows())
const gridApi = shallowRef<GridApi<OrderLineRow> | null>(null)
const advanceRowOnStop = ref(false)

const refContract = ref<InstanceType<typeof MasterCombobox> | null>(null)
const refDelivery = ref<InstanceType<typeof MasterCombobox> | null>(null)
const refLocation = ref<HTMLInputElement | null>(null)
const refDue = ref<HTMLInputElement | null>(null)
const refForecast = ref<HTMLInputElement | null>(null)

function focusNextHeader(index: number) {
  const chain = [
    () => refContract.value?.focus(),
    () => refDelivery.value?.focus(),
    () => refLocation.value?.focus(),
    () => refDue.value?.focus(),
    () => refForecast.value?.focus(),
    () => {
      const api = gridApi.value
      if (!api) return
      api.setFocusedCell(0, 'productCode')
      api.startEditingCell({ rowIndex: 0, colKey: 'productCode' })
    },
  ]
  const next = chain[index + 1]
  if (next) requestAnimationFrame(() => next())
}

function handleNew() {
  advanceRowOnStop.value = false
  gridApi.value?.stopEditing(true)
  contractParty.value = null
  deliveryParty.value = null
  deliveryLocation.value = ''
  dueDate.value = ''
  forecastNumber.value = ''
  rowData.value = createEmptyRows()
  requestAnimationFrame(() => refContract.value?.focus())
}

function handleSave() {
  const header = {
    contractPartyCode: contractParty.value?.code ?? '',
    deliveryPartyCode: deliveryParty.value?.code ?? '',
    deliveryLocation: deliveryLocation.value,
    dueDate: dueDate.value,
    forecastNumber: forecastNumber.value,
  }
  const lines = rowData.value.filter(
    (r) => r.productCode.trim() !== '' || r.quantity > 0 || r.unitPrice > 0,
  )
  console.info('[保存モック]', { header, lines })
  alert('保存しました（コンソールにモック出力）')
  handleNew()
}

function onGridReady(e: GridReadyEvent<OrderLineRow>) {
  gridApi.value = e.api
}

function onCellValueChanged(e: CellValueChangedEvent<OrderLineRow>) {
  const { colDef, node, data } = e
  if (!node || !data || !colDef.field) return

  if (colDef.field === 'productCode') {
    const raw = String(e.newValue ?? '').trim()
    const upper = raw.toUpperCase()
    const hit =
      PRODUCTS.find((p) => p.code === raw) ?? PRODUCTS.find((p) => p.code.toUpperCase() === upper)
    node.setDataValue('productName', hit?.name ?? '')
    if (raw) {
      const row = node.rowIndex ?? 0
      requestAnimationFrame(() => {
        e.api.setFocusedCell(row, 'quantity')
        e.api.startEditingCell({ rowIndex: row, colKey: 'quantity' })
      })
    }
  }

  if (colDef.field === 'quantity' || colDef.field === 'unitPrice') {
    const q = Number(data.quantity) || 0
    const u = Number(data.unitPrice) || 0
    node.setDataValue('amount', q * u)
  }
}

function moveToNextCellAfterEdit(e: CellEditingStoppedEvent<OrderLineRow>) {
  if (!advanceRowOnStop.value) return
  advanceRowOnStop.value = false

  const api = e.api
  const colId = e.column.getColId()
  const idx = EDIT_COLS.indexOf(colId as (typeof EDIT_COLS)[number])
  if (idx === -1) return

  const row = e.node.rowIndex ?? 0
  const nextIdx = idx + 1

  if (nextIdx < EDIT_COLS.length) {
    const colKey = EDIT_COLS[nextIdx]!
    api.setFocusedCell(row, colKey)
    api.startEditingCell({ rowIndex: row, colKey })
    return
  }

  const nextRow = row + 1
  const col0 = EDIT_COLS[0]!
  const rowCount = api.getDisplayedRowCount()

  if (nextRow < rowCount) {
    api.setFocusedCell(nextRow, col0)
    api.startEditingCell({ rowIndex: nextRow, colKey: col0 })
    return
  }

  rowData.value = (() => {
    const prev = rowData.value
    const lineNo = prev.length > 0 ? Math.max(...prev.map((r) => r.lineNo)) + 1 : 1
    const added: OrderLineRow = {
      lineNo,
      productCode: '',
      productName: '',
      quantity: 0,
      unitPrice: 0,
      amount: 0,
    }
    return [...prev, added]
  })()

  setTimeout(() => {
    const api2 = gridApi.value
    if (!api2) return
    api2.setFocusedCell(nextRow, col0)
    api2.startEditingCell({ rowIndex: nextRow, colKey: col0 })
  }, 0)
}

function suppressEnterWhileEditing(params: SuppressKeyboardEventParams<OrderLineRow, unknown>) {
  if (!params.editing) return false
  const ev = params.event
  const colId = params.column.getColId()

  // 製品コードポップアップ: グリッドが ArrowDown/ArrowUp を奪うとプルダウン操作できない
  if (
    colId === 'productCode' &&
    !ev.shiftKey &&
    !ev.ctrlKey &&
    !ev.altKey &&
    (ev.key === 'ArrowDown' || ev.key === 'ArrowUp')
  ) {
    return true
  }

  if (ev.key !== 'Enter' || ev.shiftKey || ev.ctrlKey || ev.altKey) {
    return false
  }
  if (colId === 'productCode') {
    if (
      isAutocompleteListOpen(ev.target) ||
      isAutocompleteListOpen(document.activeElement)
    ) {
      return true
    }
  }
  if (!ENTER_NAV_COL_KEYS.has(colId)) return false
  ev.preventDefault()
  advanceRowOnStop.value = true
  params.api.stopEditing(false)
  return true
}

const columnDefs = computed<ColDef<OrderLineRow>[]>(() => [
  {
    headerName: '行',
    field: 'lineNo',
    width: 52,
    editable: false,
    pinned: 'left',
  },
  {
    headerName: '製品コード',
    field: 'productCode',
    width: 200,
    minWidth: 160,
    editable: true,
    singleClickEdit: true,
    cellEditor: ProductCodeCellEditor,
    cellEditorPopup: true,
    cellEditorPopupPosition: 'over',
    valueFormatter: (p) => {
      const code = String(p.value ?? '').trim()
      if (!code) return ''
      const name = PRODUCTS.find((x) => x.code === code)?.name
      return name ? `${code} ${name}` : code
    },
    valueParser: (p) => {
      const s = String(p.newValue ?? '').trim()
      if (!s) return ''
      return s.toUpperCase()
    },
  },
  {
    headerName: '製品名',
    field: 'productName',
    width: 220,
    editable: false,
    singleClickEdit: false,
  },
  {
    headerName: '数量',
    field: 'quantity',
    width: 88,
    editable: true,
    singleClickEdit: true,
    type: 'numericColumn',
    valueParser: (p) => {
      const v = p.newValue
      if (v === '' || v == null) return 0
      const n = Number(String(v).replace(/,/g, ''))
      return Number.isFinite(n) ? n : 0
    },
  },
  {
    headerName: '単価',
    field: 'unitPrice',
    width: 100,
    editable: true,
    singleClickEdit: true,
    type: 'numericColumn',
    valueParser: (p) => {
      const v = p.newValue
      if (v === '' || v == null) return 0
      const n = Number(String(v).replace(/,/g, ''))
      return Number.isFinite(n) ? n : 0
    },
  },
  {
    headerName: '金額',
    field: 'amount',
    width: 112,
    editable: false,
    type: 'numericColumn',
    valueFormatter: (p) =>
      p.value == null ? '' : Number(p.value).toLocaleString('ja-JP'),
  },
])

const defaultColDef = computed<ColDef<OrderLineRow>>(() => ({
  sortable: false,
  filter: false,
  resizable: true,
  suppressHeaderMenuButton: true,
  suppressKeyboardEvent: suppressEnterWhileEditing,
}))

function onDueFocus() {
  if (dueDate.value === '') dueDate.value = formatJstCalendarDatePlusDays(7)
}

function onKeyWindow(e: KeyboardEvent) {
  if (e.key === 'F1') {
    e.preventDefault()
    handleNew()
    return
  }
  if (e.key === 'F12') {
    e.preventDefault()
    handleSave()
  }
}

onMounted(() => {
  popupParentEl.value = document.body
  requestAnimationFrame(() => refContract.value?.focus())
  window.addEventListener('keydown', onKeyWindow, true)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyWindow, true)
})
</script>

<template>
  <div class="page">
    <header class="hdr">
      <h1 class="hdr-title">受注登録</h1>
      <div class="hdr-actions">
        <button type="button" class="btn btn-outline" @click="handleNew">新規（F01）</button>
        <button type="button" class="btn btn-primary" @click="handleSave">保存 (F12)</button>
      </div>
    </header>

    <div class="body">
      <main class="main">
        <section class="card header-card">
          <p class="hint">ヘッダ（Enter で次項目）</p>
          <div class="header-grid">
            <MasterCombobox
              ref="refContract"
              v-model="contractParty"
              label="契約先コード"
              placeholder="例: 1001"
              :options="PARTIES"
              @enter-next="focusNextHeader(0)"
            />
            <MasterCombobox
              ref="refDelivery"
              v-model="deliveryParty"
              label="納入先コード"
              placeholder="例: 3001"
              :options="PARTIES"
              @enter-next="focusNextHeader(1)"
            />
            <div class="field">
              <label class="field-label" for="loc">納入場所</label>
              <input
                id="loc"
                ref="refLocation"
                v-model="deliveryLocation"
                type="text"
                class="field-input"
                @keydown.enter.exact.prevent="focusNextHeader(2)"
              />
            </div>
            <div class="field">
              <label class="field-label" for="due">納期</label>
              <input
                id="due"
                ref="refDue"
                v-model="dueDate"
                type="date"
                class="field-input"
                @focus="onDueFocus"
                @keydown.enter.exact.prevent="focusNextHeader(3)"
              />
            </div>
            <div class="field field-span2">
              <label class="field-label" for="fc">内示番号</label>
              <input
                id="fc"
                ref="refForecast"
                v-model="forecastNumber"
                type="text"
                class="field-input"
                @keydown.enter.exact.prevent="focusNextHeader(4)"
              />
            </div>
          </div>
        </section>

        <section class="card grid-card">
          <p class="hint grid-hint">
            明細（製品はコンボ入力＋リスト／確定で数量へ／数量・単価は Enter で右へ）
          </p>
          <div class="ag-theme-balham grid-wrap">
            <AgGridVue
              theme="legacy"
              style="width: 100%; height: 100%"
              :popup-parent="popupParentEl"
              :row-data="rowData"
              :column-defs="columnDefs"
              :default-col-def="defaultColDef"
              :get-row-id="(p: { data: OrderLineRow }) => String(p.data.lineNo)"
              :single-click-edit="true"
              :enter-navigates-vertically="false"
              :enter-navigates-vertically-after-edit="false"
              @grid-ready="onGridReady"
              @cell-value-changed="onCellValueChanged"
              @cell-editing-stopped="moveToNextCellAfterEdit"
            />
          </div>
        </section>
      </main>

      <aside class="aside">
        <h2 class="aside-title">AI エージェント助言</h2>
        <div class="aside-body">
          <p
            v-for="text in [
              '納期がタイトです。前工程のロットと突合してください。',
              '入力中の単価は過去 6 か月平均より約 8% 低いです。',
              '△△電池工業向けはリコール履歴があるロットを避ける運用が推奨です。',
              'B002（鉛蓄電池パック）は在庫閾値を下回る見込みです。',
            ]"
            :key="text"
            class="advice"
          >
            {{ text }}
          </p>
          <p class="aside-note">※ダミー表示です。実装時はルール／学習モデルと連携してください。</p>

          <h3 class="aside-sub">モックマスタ参照</h3>
          <p class="aside-cap">取引先（契約先・納入先）</p>
          <ul class="master-list">
            <li v-for="p in PARTIES" :key="p.code">{{ p.code }}：{{ p.name }}</li>
          </ul>
          <p class="aside-cap">製品（明細）</p>
          <ul class="master-list">
            <li v-for="p in PRODUCTS" :key="p.code">{{ p.code }}：{{ p.name }}</li>
          </ul>
        </div>
      </aside>
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
  .field-span2 {
    grid-column: span 2;
  }
}
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.field-label {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.6);
}
.field-input {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 12px;
  border: 1px solid rgba(0, 0, 0, 0.23);
  border-radius: 4px;
  font-size: 14px;
  background: #fff;
}
.field-input:focus {
  outline: 2px solid #1976d2;
  outline-offset: 0;
  border-color: #1976d2;
}
.grid-card {
  flex: 1;
  min-height: 280px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #f7f9fc;
}
.grid-hint {
  flex-shrink: 0;
  padding: 4px 8px;
  margin: 0;
  border-bottom: 1px solid #9aa7b8;
}
.grid-wrap {
  flex: 1;
  min-height: 0;
  padding: 4px;
}
.aside {
  width: min(100%, 380px);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-left: 1px solid #94a3b8;
  background: #1e2a38;
  color: #f1f5f9;
  min-height: 0;
}
.aside-title {
  margin: 0;
  padding: 8px 12px;
  font-size: 14px;
  font-weight: 600;
  font-family: ui-monospace, monospace;
  border-bottom: 1px solid #3d4f63;
  flex-shrink: 0;
}
.aside-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.advice {
  margin: 0;
  padding: 8px;
  font-size: 13px;
  line-height: 1.5;
  background: #2a3a4d;
  border-left: 3px solid #5ab0ff;
  border-radius: 4px;
  color: #f8fafc;
}
.aside-note {
  margin: 4px 0 0;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.72);
}
.aside-sub {
  margin: 12px 0 0;
  padding-top: 12px;
  border-top: 1px solid #3d4f63;
  font-size: 14px;
  font-family: ui-monospace, monospace;
}
.aside-cap {
  margin: 0 0 4px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.78);
}
.master-list {
  margin: 0;
  padding: 8px 8px 8px 20px;
  font-size: 12px;
  line-height: 1.65;
  font-family: ui-monospace, monospace;
  background: #243040;
  border: 1px solid #3d4f63;
  border-radius: 4px;
  color: #f8fafc;
}
</style>
