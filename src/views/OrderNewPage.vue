<script setup lang="ts">
import type { CellValueChangedEvent, ColDef, GridApi, GridReadyEvent } from 'ag-grid-community'
import { computed, nextTick, onMounted, reactive, ref, shallowRef } from 'vue'
import type { CodeMasterItem } from '@/types/master'
import { useRoute } from 'vue-router'
import { createOrder, fetchParties, fetchProducts } from '@/api/client'
import { PARTIES as MOCK_PARTIES, PRODUCTS as MOCK_PRODUCTS } from '@/constants/mockData'
import type { HeaderFieldSpec } from '@/features/screen-engine/screenSpecTypes'
import { useGridEnterNav } from '@/features/screen-engine/useGridEnterNav'
import { useKeySpec } from '@/features/screen-engine/useKeySpec'
import { applyOrderCommitSpec } from '@/features/order-screen/orderCommitRules'
import {
  ORDER_HEADER_FIELDS,
  buildColumnsBySpec,
  createEmptyOrderRows,
  createNextOrderRow,
  isOrderLineFilled,
  resolveOrderScreenSpec,
  type OrderLineRow,
} from '@/features/order-screen/orderNewSpec'
import RegistrationScreenShell from '@/views/RegistrationScreenShell.vue'

const route = useRoute()

const spec = computed(() =>
  resolveOrderScreenSpec(route.meta.variant === 'alt' ? 'order-new-alt' : 'order-new'),
)

function initHeaderRecord(fields: readonly HeaderFieldSpec[]): Record<string, unknown> {
  const o: Record<string, unknown> = {}
  for (const f of fields) {
    o[f.id] = f.editorType === 'masterCombobox' ? null : ''
  }
  return o
}

const orderHeader = reactive<Record<string, unknown>>(initHeaderRecord(ORDER_HEADER_FIELDS))
const orderRowData = ref<OrderLineRow[]>(createEmptyOrderRows())
const parties = ref<CodeMasterItem[]>([])
const products = ref<CodeMasterItem[]>([])
const gridApiOrder = shallowRef<GridApi<OrderLineRow> | null>(null)

const orderNav = useGridEnterNav<OrderLineRow>({
  editChainColIds: computed(() => spec.value.navigationSpec.gridEditChainColIds),
  enterStopEditingColIds: computed(() => spec.value.navigationSpec.gridEnterStopEditingColIds),
  gridApi: gridApiOrder,
  rowData: orderRowData,
  createNextRow: createNextOrderRow,
  autocompleteAwareColId: 'productCode',
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
  if (String(orderHeader[field.id] ?? '') === '') {
    orderHeader[field.id] = formatJstCalendarDatePlusDays(field.defaultDatePlusDays)
  }
}

function snapshotOrderRowsFromGrid(): OrderLineRow[] {
  const api = gridApiOrder.value
  if (!api) return orderRowData.value
  const rows: OrderLineRow[] = []
  api.forEachLeafNode((node) => {
    if (node.data) rows.push(node.data)
  })
  rows.sort((a, b) => a.lineNo - b.lineNo)
  return rows
}

function handleNew() {
  orderNav.resetEnterNavAdvance()
  gridApiOrder.value?.stopEditing(true)
  Object.assign(orderHeader, initHeaderRecord(ORDER_HEADER_FIELDS))
  orderRowData.value = createEmptyOrderRows()
  requestAnimationFrame(() => shellRef.value?.focusFirstInHeaderChain())
}

async function handleSave() {
  gridApiOrder.value?.stopEditing(false)
  await nextTick()
  const lines = snapshotOrderRowsFromGrid()
    .filter((r) => isOrderLineFilled(r))
    .map((r) => ({
      productCode: r.productCode,
      productName: r.productName,
      quantity: r.quantity,
      unitPrice: r.unitPrice,
      amount: r.amount,
    }))
  if (lines.length === 0) {
    alert('明細が1行以上必要です。製品コード・数量・単価などを入力してから保存してください。')
    return
  }
  try {
    const result = await createOrder({
      contractPartyCode: (orderHeader.contractParty as { code?: string } | null)?.code ?? '',
      deliveryPartyCode: (orderHeader.deliveryParty as { code?: string } | null)?.code ?? '',
      deliveryLocation: String(orderHeader.deliveryLocation ?? ''),
      dueDate: String(orderHeader.dueDate ?? ''),
      forecastNumber: String(orderHeader.forecastNumber ?? ''),
      lines,
    })
    alert(`受注を登録しました（受注番号: ${result.orderNumber}）`)
  } catch (e) {
    console.error('受注登録失敗:', e)
    alert('受注の登録に失敗しました。コンソールを確認してください。')
    return
  }
  handleNew()
}

function onMockF8() {
  alert('F8 モック（受注 Spec の keySpec のみ）')
}

useKeySpec(
  () => spec.value.keySpec,
  {
    new: handleNew,
    save: handleSave,
    mockAlert: onMockF8,
  },
)

function onGridReady(e: GridReadyEvent<OrderLineRow>) {
  gridApiOrder.value = e.api
}

function onCellValueChanged(e: CellValueChangedEvent<OrderLineRow>) {
  applyOrderCommitSpec(e, products.value)
}

const orderColumnDefs = computed(() => buildColumnsBySpec(spec.value, products.value))

const defaultColDef = computed((): ColDef => ({
  sortable: false,
  filter: false,
  resizable: true,
  suppressHeaderMenuButton: true,
  suppressKeyboardEvent: orderNav.suppressEnterWhileEditing as ColDef['suppressKeyboardEvent'],
}))

function getRowId(p: { data: OrderLineRow }) {
  return String(p.data.lineNo)
}

const shellRef = ref<InstanceType<typeof RegistrationScreenShell> | null>(null)

onMounted(() => {
  void (async () => {
    try {
      const [p, pr] = await Promise.all([fetchParties(), fetchProducts()])
      parties.value = p
      products.value = pr
    } catch (e) {
      console.error('マスタ取得失敗:', e)
      parties.value = [...MOCK_PARTIES]
      products.value = [...MOCK_PRODUCTS]
    }
  })()
})
</script>

<template>
  <RegistrationScreenShell
    ref="shellRef"
    v-model:row-data="orderRowData"
    :title="spec.title"
    :grid-hint="spec.gridHint"
    :header-fields="spec.headerFields"
    :navigation-spec="spec.navigationSpec"
    :header="orderHeader"
    :column-defs="orderColumnDefs"
    :default-col-def="defaultColDef"
    :get-row-id="getRowId as (params: { data: unknown }) => string"
    :parties="parties"
    :products="products"
    @grid-ready="onGridReady"
    @cell-value-changed="onCellValueChanged"
    @cell-editing-stopped="orderNav.onCellEditingStopped"
    @new="handleNew"
    @save="handleSave"
    @date-focus="onDateFieldFocus"
  />
</template>
