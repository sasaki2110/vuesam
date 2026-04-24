<script setup lang="ts">
import { AgGridVue } from 'ag-grid-vue3'
import {
  AllCommunityModule,
  ModuleRegistry,
  type CellClassParams,
  type ColDef,
  type EditableCallbackParams,
  type GridApi,
  type GridReadyEvent,
  type SpanRowsParams,
  type ValueFormatterParams,
} from 'ag-grid-community'
import { computed, defineComponent, h, markRaw, onMounted, reactive, ref, shallowRef } from 'vue'
import { RouterLink } from 'vue-router'

const HEADER_LINES = 3

const MultiLineHeader = markRaw(
  defineComponent({
    name: 'MultiLineHeader',
    props: {
      params: { type: Object, required: true },
    },
    setup(props) {
      return () => {
        const extra = (props.params as { labels?: string[] }).labels ?? []
        const lines: string[] = [
          String(props.params.displayName ?? ''),
          ...extra.map((s) => String(s ?? '')),
        ].slice(0, HEADER_LINES)
        while (lines.length < HEADER_LINES) lines.push('')
        return h(
          'div',
          { class: 'multi-line-header' },
          lines.map((text, i) =>
            h(
              'div',
              { class: ['th-line', i === 0 ? 'th-top' : 'th-sub'] },
              text || ' ',
            ),
          ),
        )
      }
    },
  }),
)

import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-balham.css'

ModuleRegistry.registerModules([AllCommunityModule])

type RowKind = 'sales-normal' | 'sales-case' | 'sales-box' | 'tehai'

interface OrderLineRow {
  itemId: number
  rowKind: RowKind
  rowOrder: number
  region: string
  productCode: string
  productName: string
  unit: string
  quantity: number | null
  unitPrice: number | null
  amount: number | null
  dueDate: string
  shipStatus: string
  tehaiPartyCode?: string
  tehaiPartyName?: string
}

const UNIT_LABEL: Record<RowKind, string> = {
  'sales-normal': '通常',
  'sales-case': 'ケース',
  'sales-box': '箱',
  tehai: '手配',
}

function makeItemGroup(
  itemId: number,
  opts: {
    productCode: string
    productName: string
    unitPrices: { normal: number; case: number; box: number }
    dueDate: string
    withTehai?: { partyCode: string; partyName: string }
  },
): OrderLineRow[] {
  const base: Omit<OrderLineRow, 'rowKind' | 'rowOrder' | 'unit' | 'quantity' | 'unitPrice' | 'amount'> = {
    itemId,
    region: '売上',
    productCode: opts.productCode,
    productName: opts.productName,
    dueDate: opts.dueDate,
    shipStatus: '未完',
  }
  const rows: OrderLineRow[] = [
    {
      ...base,
      rowKind: 'sales-normal',
      rowOrder: 0,
      unit: UNIT_LABEL['sales-normal'],
      quantity: 50,
      unitPrice: opts.unitPrices.normal,
      amount: 50 * opts.unitPrices.normal,
    },
    {
      ...base,
      rowKind: 'sales-case',
      rowOrder: 1,
      unit: UNIT_LABEL['sales-case'],
      quantity: 0,
      unitPrice: opts.unitPrices.case,
      amount: 0,
    },
    {
      ...base,
      rowKind: 'sales-box',
      rowOrder: 2,
      unit: UNIT_LABEL['sales-box'],
      quantity: 50,
      unitPrice: opts.unitPrices.box,
      amount: 50 * opts.unitPrices.box,
    },
  ]
  if (opts.withTehai) {
    rows.push({
      ...base,
      rowKind: 'tehai',
      rowOrder: 3,
      unit: UNIT_LABEL['tehai'],
      quantity: null,
      unitPrice: null,
      amount: null,
      tehaiPartyCode: opts.withTehai.partyCode,
      tehaiPartyName: opts.withTehai.partyName,
    })
  }
  return rows
}

const orderHeader = reactive({
  orderNo: '00000306',
  orderDate: '2021-10-30',
  dueDate: '2021-11-05',
  shipDate: '2021-11-04',
  partyCode: '6900000001',
  partyName: '(株)アイル',
  staffCode: '600001',
  staffName: '担当者 1',
  orderKind: '0',
})

const rowData = ref<OrderLineRow[]>([
  ...makeItemGroup(1, {
    productCode: '001011',
    productName: 'トイレットペーパー',
    unitPrices: { normal: 220, case: 200, box: 150 },
    dueDate: '2021-11-05',
  }),
  ...makeItemGroup(2, {
    productCode: '001003',
    productName: 'ボディーソープ',
    unitPrices: { normal: 340, case: 200, box: 160 },
    dueDate: '2021-11-05',
  }),
  ...makeItemGroup(3, {
    productCode: '001004',
    productName: '洗顔スクラブ アロエエキス配合',
    unitPrices: { normal: 340, case: 200, box: 170 },
    dueDate: '2021-11-05',
    withTehai: { partyCode: '0000200001', partyName: '(株)マツナガ東京' },
  }),
])

const gridApi = shallowRef<GridApi<OrderLineRow> | null>(null)

function spanByItemId(p: SpanRowsParams<OrderLineRow, unknown>): boolean {
  return (
    p.nodeA?.data?.itemId != null &&
    p.nodeA?.data?.itemId === p.nodeB?.data?.itemId
  )
}

const isMainRow = (p: { data?: OrderLineRow | null | undefined }) =>
  p.data?.rowKind === 'sales-normal'

const isTehaiRow = (p: { data?: OrderLineRow | null | undefined }) =>
  p.data?.rowKind === 'tehai'

const formatNumber = (p: ValueFormatterParams<OrderLineRow>) =>
  p.value == null || p.value === '' ? '' : Number(p.value).toLocaleString('ja-JP')

function amountCellClass(p: CellClassParams<OrderLineRow>) {
  const classes: string[] = ['ag-right-aligned-cell']
  if (p.data?.rowKind === 'tehai') classes.push('cell-dim')
  return classes
}

const columnDefs = computed((): ColDef<OrderLineRow>[] => [
  {
    headerName: '行',
    colId: 'lineNo',
    width: 60,
    editable: false,
    valueGetter: (p) => (p.data?.rowKind === 'sales-normal' ? p.data.itemId : ''),
    spanRows: spanByItemId,
    cellClass: 'cell-line-no',
    headerComponent: MultiLineHeader,
    headerComponentParams: { labels: ['', ''] },
  },
  {
    headerName: '区分',
    field: 'region',
    width: 84,
    editable: false,
    spanRows: spanByItemId,
    headerComponent: MultiLineHeader,
    headerComponentParams: { labels: ['見積NO', 'ロット'] },
  },
  {
    headerName: '商品',
    field: 'productCode',
    width: 112,
    editable: (p: EditableCallbackParams<OrderLineRow>) => isMainRow(p) || isTehaiRow(p),
    valueGetter: (p) => {
      if (p.data?.rowKind === 'sales-normal') return p.data.productCode
      if (p.data?.rowKind === 'tehai') return p.data.tehaiPartyCode ?? ''
      return ''
    },
    valueSetter: (p) => {
      if (!p.data) return false
      const v = String(p.newValue ?? '')
      if (p.data.rowKind === 'sales-normal') {
        p.data.productCode = v
        return true
      }
      if (p.data.rowKind === 'tehai') {
        p.data.tehaiPartyCode = v
        return true
      }
      return false
    },
    headerComponent: MultiLineHeader,
    headerComponentParams: { labels: ['手配', '仕入先CD'] },
  },
  {
    headerName: '商品名',
    field: 'productName',
    width: 260,
    editable: (p: EditableCallbackParams<OrderLineRow>) => isMainRow(p) || isTehaiRow(p),
    valueGetter: (p) => {
      if (p.data?.rowKind === 'sales-normal') return p.data.productName
      if (p.data?.rowKind === 'tehai') return p.data.tehaiPartyName ?? ''
      return ''
    },
    valueSetter: (p) => {
      if (!p.data) return false
      const v = String(p.newValue ?? '')
      if (p.data.rowKind === 'sales-normal') {
        p.data.productName = v
        return true
      }
      if (p.data.rowKind === 'tehai') {
        p.data.tehaiPartyName = v
        return true
      }
      return false
    },
    headerComponent: MultiLineHeader,
    headerComponentParams: { labels: ['仕入先名', '摘要'] },
  },
  {
    headerName: '単位',
    field: 'unit',
    width: 80,
    editable: false,
    cellClass: 'cell-unit',
    headerComponent: MultiLineHeader,
    headerComponentParams: { labels: ['状態', '区分'] },
  },
  {
    headerName: '入数',
    field: 'quantity',
    width: 92,
    editable: (p: EditableCallbackParams<OrderLineRow>) => !isTehaiRow(p),
    type: 'numericColumn',
    cellClass: 'ag-right-aligned-cell',
    valueFormatter: formatNumber,
    valueParser: (p) => {
      const n = Number(p.newValue)
      return Number.isFinite(n) ? n : null
    },
    headerComponent: MultiLineHeader,
    headerComponentParams: { labels: ['受注数', '発注数'] },
  },
  {
    headerName: '上代単価',
    field: 'unitPrice',
    width: 104,
    editable: (p: EditableCallbackParams<OrderLineRow>) => !isTehaiRow(p),
    type: 'numericColumn',
    cellClass: 'ag-right-aligned-cell',
    valueFormatter: formatNumber,
    valueParser: (p) => {
      const n = Number(p.newValue)
      return Number.isFinite(n) ? n : null
    },
    headerComponent: MultiLineHeader,
    headerComponentParams: { labels: ['原価単価', '率(%)'] },
  },
  {
    headerName: '受注金額',
    field: 'amount',
    width: 112,
    editable: (p: EditableCallbackParams<OrderLineRow>) => !isTehaiRow(p),
    type: 'numericColumn',
    cellClass: amountCellClass,
    valueFormatter: formatNumber,
    valueParser: (p) => {
      const n = Number(p.newValue)
      return Number.isFinite(n) ? n : null
    },
    headerComponent: MultiLineHeader,
    headerComponentParams: { labels: ['原価金額', '消費税'] },
  },
  {
    headerName: '指定納期',
    field: 'dueDate',
    width: 124,
    editable: (p: EditableCallbackParams<OrderLineRow>) => !isTehaiRow(p),
    headerComponent: MultiLineHeader,
    headerComponentParams: { labels: ['出荷予定日', '納品日'] },
  },
  {
    headerName: '付箋',
    field: 'shipStatus',
    width: 96,
    editable: false,
    headerComponent: MultiLineHeader,
    headerComponentParams: { labels: ['出荷状況', '備考'] },
  },
])

const defaultColDef = computed(
  (): ColDef => ({
    sortable: false,
    filter: false,
    resizable: true,
    suppressHeaderMenuButton: true,
    singleClickEdit: true,
  }),
)

function onGridReady(e: GridReadyEvent<OrderLineRow>) {
  gridApi.value = e.api
}

function getRowId(p: { data: OrderLineRow }) {
  return `${p.data.itemId}#${p.data.rowKind}`
}

function handleAddItemGroup() {
  const nextId = (rowData.value.reduce((m, r) => Math.max(m, r.itemId), 0) || 0) + 1
  rowData.value = [
    ...rowData.value,
    ...makeItemGroup(nextId, {
      productCode: '',
      productName: '',
      unitPrices: { normal: 0, case: 0, box: 0 },
      dueDate: '',
    }),
  ]
}

function handleDeleteItemGroup() {
  const api = gridApi.value
  if (!api) return
  const cell = api.getFocusedCell()
  if (!cell) {
    alert('削除する明細のセルを選択してください。')
    return
  }
  const node = api.getDisplayedRowAtIndex(cell.rowIndex)
  const target = node?.data?.itemId
  if (target == null) return
  rowData.value = rowData.value.filter((r) => r.itemId !== target)
}

function handleAddTehaiRow() {
  const api = gridApi.value
  if (!api) return
  const cell = api.getFocusedCell()
  if (!cell) {
    alert('手配段を追加する明細のセルを選択してください。')
    return
  }
  const node = api.getDisplayedRowAtIndex(cell.rowIndex)
  const target = node?.data?.itemId
  if (target == null) return
  if (rowData.value.some((r) => r.itemId === target && r.rowKind === 'tehai')) {
    alert('この明細にはすでに手配段があります。')
    return
  }
  const out: OrderLineRow[] = []
  for (const r of rowData.value) {
    out.push(r)
    if (
      r.itemId === target &&
      r.rowKind === 'sales-box' &&
      !rowData.value.some((x) => x.itemId === target && x.rowKind === 'tehai')
    ) {
      out.push({
        itemId: target,
        rowKind: 'tehai',
        rowOrder: 3,
        region: '売上',
        productCode: r.productCode,
        productName: r.productName,
        unit: UNIT_LABEL['tehai'],
        quantity: null,
        unitPrice: null,
        amount: null,
        dueDate: r.dueDate,
        shipStatus: '未完',
        tehaiPartyCode: '',
        tehaiPartyName: '',
      })
    }
  }
  rowData.value = out
}

const summaryText = computed(() => {
  const itemIds = new Set(rowData.value.map((r) => r.itemId))
  return `明細 ${itemIds.size} 件 / 物理行 ${rowData.value.length} 行`
})

onMounted(() => {
  // no-op: モックのため初期データはトップで構築済み
})
</script>

<template>
  <div class="page">
    <header class="hdr">
      <h1 class="hdr-title">受注計上入力（PoC モック）</h1>
      <RouterLink to="/" class="back-link">← ホームへ</RouterLink>
    </header>

    <main class="main">
      <section class="card header-card">
        <div class="grid-2col">
          <label class="fld"><span>受注NO</span><input v-model="orderHeader.orderNo" /></label>
          <label class="fld"><span>受注日</span><input v-model="orderHeader.orderDate" /></label>
          <label class="fld"><span>指定納期</span><input v-model="orderHeader.dueDate" /></label>
          <label class="fld"><span>出荷予定日</span><input v-model="orderHeader.shipDate" /></label>
          <label class="fld">
            <span>得意先</span>
            <input v-model="orderHeader.partyCode" class="w-code" />
            <input v-model="orderHeader.partyName" />
          </label>
          <label class="fld">
            <span>担当者</span>
            <input v-model="orderHeader.staffCode" class="w-code" />
            <input v-model="orderHeader.staffName" />
          </label>
        </div>
      </section>

      <section class="card tools-card">
        <div class="tools">
          <button type="button" class="btn" @click="handleAddItemGroup">
            F9 行追加（明細 1 件 ＝ 3 段）
          </button>
          <button type="button" class="btn" @click="handleAddTehaiRow">
            手配段を追加（選択明細）
          </button>
          <button type="button" class="btn btn-danger" @click="handleDeleteItemGroup">
            F10 行削除（選択明細）
          </button>
          <span class="count">{{ summaryText }}</span>
        </div>
        <p class="hint">
          Tab / Shift+Tab でセル移動、Enter / F2 / ダブルクリックで編集開始。
          商品コード・商品名は段 1（通常）のみ編集可、手配段では手配先のコード／名称を編集。
          単位列・「行」「区分」は rowSpan で明細単位に結合。
        </p>
      </section>

      <section class="card grid-card">
        <div class="ag-theme-balham grid-wrap">
          <AgGridVue
            v-model="rowData"
            theme="legacy"
            style="width: 100%; height: 100%"
            :column-defs="columnDefs"
            :default-col-def="defaultColDef"
            :enable-cell-span="true"
            :header-height="74"
            :get-row-id="getRowId as (p: { data: unknown }) => string"
            :stop-editing-when-cells-lose-focus="true"
            @grid-ready="onGridReady"
          />
        </div>
      </section>
    </main>
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
}
.back-link {
  font-size: 13px;
  color: #1e3a5f;
  text-decoration: none;
}
.back-link:hover {
  text-decoration: underline;
}

.main {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  overflow: hidden;
}

.card {
  background: #fff;
  border: 1px solid #94a3b8;
  border-radius: 4px;
  padding: 8px 10px;
}

.header-card .grid-2col {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px 16px;
}
.fld {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}
.fld > span {
  width: 6em;
  color: #334155;
}
.fld > input {
  flex: 1 1 auto;
  min-width: 0;
  padding: 2px 6px;
  font-size: 13px;
  border: 1px solid #94a3b8;
  border-radius: 2px;
  background: #fff;
}
.fld > input.w-code {
  flex: 0 0 9em;
}

.tools-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.tools {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.btn {
  padding: 4px 10px;
  font-size: 13px;
  border: 1px solid #475569;
  background: #e2e8f0;
  color: #0f172a;
  border-radius: 3px;
  cursor: pointer;
}
.btn:hover {
  background: #cbd5e1;
}
.btn-danger {
  border-color: #b91c1c;
  color: #b91c1c;
  background: #fef2f2;
}
.btn-danger:hover {
  background: #fee2e2;
}
.count {
  margin-left: auto;
  font-size: 13px;
  color: #475569;
}
.hint {
  margin: 0;
  font-size: 12px;
  color: #475569;
  line-height: 1.5;
}

.grid-card {
  flex: 1 1 auto;
  min-height: 0;
  padding: 0;
  overflow: hidden;
  display: flex;
}
.grid-wrap {
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
}

:deep(.cell-line-no) {
  text-align: center;
  font-weight: 600;
  background: #f8fafc;
}
:deep(.cell-unit) {
  color: #1e3a5f;
  font-weight: 600;
}
:deep(.cell-dim) {
  color: #94a3b8;
  background: #f8fafc;
}

:deep(.multi-line-header) {
  display: flex;
  flex-direction: column;
  justify-content: stretch;
  line-height: 1.15;
  width: 100%;
  height: 100%;
  padding: 2px 0;
}
:deep(.multi-line-header .th-line) {
  flex: 1 1 0;
  display: flex;
  align-items: center;
}
:deep(.multi-line-header .th-top) {
  font-weight: 700;
  color: #0f172a;
  font-size: 13px;
}
:deep(.multi-line-header .th-sub) {
  color: #475569;
  font-size: 11px;
  border-top: 1px dotted #cbd5e1;
  padding-top: 2px;
}
</style>
