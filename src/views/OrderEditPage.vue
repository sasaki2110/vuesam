<script setup lang="ts">
import type { CellValueChangedEvent, ColDef, GridApi, GridReadyEvent } from 'ag-grid-community'
import { computed, nextTick, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import type { CodeMasterItem } from '@/types/master'
import { useRoute, useRouter } from 'vue-router'
import {
  ApiValidationError,
  fetchOrder,
  fetchParties,
  fetchProducts,
  updateOrder,
} from '@/api/client'
import { PARTIES as MOCK_PARTIES, PRODUCTS as MOCK_PRODUCTS } from '@/constants/mockData'
import type { HeaderFieldSpec } from '@/features/screen-engine/screenSpecTypes'
import { mergeColDefWithValidation } from '@/features/screen-engine/validation/agGridValidation'
import { parseApiErrors, ORDER_FIELD_MAPPING } from '@/features/screen-engine/validation/parseApiErrors'
import type { FieldError } from '@/features/screen-engine/validation/validationTypes'
import { validateHeaderFields } from '@/features/screen-engine/validation/validateFields'
import { validateGridRows } from '@/features/screen-engine/validation/validateGridRows'
import { useGridEnterNav } from '@/features/screen-engine/useGridEnterNav'
import { useKeySpec } from '@/features/screen-engine/useKeySpec'
import { applyOrderCommitSpec } from '@/features/order-screen/orderCommitRules'
import {
  INITIAL_ROWS,
  ORDER_GRID_VALIDATIONS,
  ORDER_HEADER_FIELDS,
  buildColumnsBySpec,
  createNextOrderRow,
  isOrderLineFilled,
  resolveOrderScreenSpec,
  type OrderLineRow,
} from '@/features/order-screen/orderNewSpec'
import RegistrationScreenShell from '@/views/RegistrationScreenShell.vue'

const route = useRoute()
const router = useRouter()

const orderId = computed(() => Number(route.params.id))

const spec = computed(() => resolveOrderScreenSpec('order-new'))

const orderNumber = ref('')
const isLoading = ref(true)

const pageTitle = computed(() =>
  orderNumber.value ? `受注変更（${orderNumber.value}）` : '受注変更',
)

const headerSubtitle = computed(() =>
  orderNumber.value ? `受注番号: ${orderNumber.value}` : '',
)

function initHeaderRecord(fields: readonly HeaderFieldSpec[]): Record<string, unknown> {
  const o: Record<string, unknown> = {}
  for (const f of fields) {
    o[f.id] = f.editorType === 'masterCombobox' ? null : ''
  }
  return o
}

const orderHeader = reactive<Record<string, unknown>>(initHeaderRecord(ORDER_HEADER_FIELDS))
const orderRowData = ref<OrderLineRow[]>([])
const parties = ref<CodeMasterItem[]>([])
const products = ref<CodeMasterItem[]>([])
const gridApiOrder = shallowRef<GridApi<OrderLineRow> | null>(null)
const validationErrors = ref<FieldError[]>([])
const gridSessionKey = ref(0)

watch(validationErrors, async (errs) => {
  await nextTick()
  await nextTick()
  const api = gridApiOrder.value
  if (!api) return
  api.refreshCells({ force: true })
  api.redrawRows()
  const firstGrid = errs.find((e) => /^\d+:/.test(e.fieldKey))
  if (firstGrid) {
    const rowIdx = Number(firstGrid.fieldKey.split(':')[0])
    if (!Number.isNaN(rowIdx)) api.ensureIndexVisible(rowIdx, 'middle')
  }
})

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

function handleBackToList() {
  void router.push({ name: 'order-list' })
}

async function handleSave() {
  gridApiOrder.value?.stopEditing(false)
  await nextTick()
  const snapshot = snapshotOrderRowsFromGrid()
  const headerResult = validateHeaderFields(spec.value.headerFields, orderHeader)
  const filled = snapshot.filter((r) => isOrderLineFilled(r))
  const linesErrors: FieldError[] = []
  if (filled.length === 0) {
    linesErrors.push({
      fieldKey: 'lines',
      message:
        '明細が1行以上必要です。製品コード・数量・単価などを入力してから保存してください。',
    })
  }
  const gridResult = validateGridRows(snapshot, ORDER_GRID_VALIDATIONS, (row) =>
    isOrderLineFilled(row as OrderLineRow),
  )
  const allErrors = [...headerResult.errors, ...linesErrors, ...gridResult.errors]
  if (allErrors.length > 0) {
    validationErrors.value = allErrors
    return
  }
  validationErrors.value = []

  const lines = filled.map((r) => ({
    productCode: r.productCode,
    productName: r.productName,
    quantity: r.quantity,
    unitPrice: r.unitPrice,
    amount: r.amount,
  }))
  try {
    const result = await updateOrder(orderId.value, {
      contractPartyCode: (orderHeader.contractParty as { code?: string } | null)?.code ?? '',
      deliveryPartyCode: (orderHeader.deliveryParty as { code?: string } | null)?.code ?? '',
      deliveryLocation: String(orderHeader.deliveryLocation ?? ''),
      dueDate: String(orderHeader.dueDate ?? ''),
      forecastNumber: String(orderHeader.forecastNumber ?? ''),
      lines,
    })
    alert(`受注を更新しました（受注番号: ${result.orderNumber}）`)
  } catch (e) {
    if (e instanceof ApiValidationError) {
      const { fieldErrors, globalMessage } = parseApiErrors(e.body, ORDER_FIELD_MAPPING)
      if (fieldErrors.length > 0) validationErrors.value = fieldErrors
      if (globalMessage) alert(globalMessage)
      return
    }
    console.error('受注更新失敗:', e)
    alert('受注の更新に失敗しました。コンソールを確認してください。')
  }
}

function onMockF8() {
  alert('F8 モック（受注 Spec の keySpec のみ）')
}

useKeySpec(
  () => ({ ...spec.value.keySpec, F1: 'backToList' }),
  {
    backToList: handleBackToList,
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

const orderColumnDefs = computed(() => {
  void validationErrors.value.map((e) => `${e.fieldKey}\0${e.message}`).join('\n')
  return buildColumnsBySpec(spec.value, products.value).map((c) =>
    mergeColDefWithValidation(c, validationErrors),
  )
})

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

onMounted(() => {
  void (async () => {
    const id = orderId.value
    if (!Number.isFinite(id) || id <= 0) {
      alert('受注 ID が不正です。一覧に戻ります。')
      void router.push({ name: 'order-list' })
      isLoading.value = false
      return
    }

    try {
      const [p, pr] = await Promise.all([fetchParties(), fetchProducts()])
      parties.value = p
      products.value = pr
    } catch (e) {
      console.error('マスタ取得失敗:', e)
      parties.value = [...MOCK_PARTIES]
      products.value = [...MOCK_PRODUCTS]
    }

    try {
      const detail = await fetchOrder(id)
      orderNumber.value = detail.orderNumber

      orderHeader.contractParty =
        parties.value.find((p) => p.code === detail.contractPartyCode) ?? null
      orderHeader.deliveryParty =
        parties.value.find((p) => p.code === detail.deliveryPartyCode) ?? null
      orderHeader.deliveryLocation = detail.deliveryLocation ?? ''
      orderHeader.dueDate = detail.dueDate ?? ''
      orderHeader.forecastNumber = detail.forecastNumber ?? ''
      orderHeader.memoNote = ''

      const rows: OrderLineRow[] = detail.lines.map((l) => ({
        lineNo: l.lineNo,
        productCode: l.productCode,
        productName: l.productName ?? '',
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        amount: l.amount,
      }))
      const maxLineNo = rows.length > 0 ? Math.max(...rows.map((r) => r.lineNo)) : 0
      const emptyCount = Math.max(0, INITIAL_ROWS - rows.length)
      for (let i = 0; i < emptyCount; i++) {
        rows.push({
          lineNo: maxLineNo + i + 1,
          productCode: '',
          productName: '',
          quantity: 0,
          unitPrice: 0,
          amount: 0,
        })
      }
      orderRowData.value = rows
    } catch (e) {
      console.error('受注取得失敗:', e)
      const msg =
        e instanceof Error && e.message === 'fetchOrder:404'
          ? '指定された受注が見つかりません。一覧に戻ります。'
          : '受注データの取得に失敗しました。一覧に戻ります。'
      alert(msg)
      void router.push({ name: 'order-list' })
    } finally {
      isLoading.value = false
    }
  })()
})
</script>

<template>
  <div v-if="isLoading" class="loading-page">
    <p class="loading-msg">読み込み中…</p>
  </div>
  <RegistrationScreenShell
    v-else
    v-model:row-data="orderRowData"
    :title="pageTitle"
    :header-subtitle="headerSubtitle"
    new-button-label="一覧へ戻る（F01）"
    :grid-hint="spec.gridHint"
    :header-fields="spec.headerFields"
    :navigation-spec="spec.navigationSpec"
    :header="orderHeader"
    :column-defs="orderColumnDefs"
    :default-col-def="defaultColDef"
    :get-row-id="getRowId as (params: { data: unknown }) => string"
    :parties="parties"
    :products="products"
    :validation-errors="validationErrors"
    :grid-session-key="gridSessionKey"
    @grid-ready="onGridReady"
    @cell-value-changed="onCellValueChanged"
    @cell-editing-stopped="orderNav.onCellEditingStopped"
    @new="handleBackToList"
    @save="handleSave"
    @date-focus="onDateFieldFocus"
  />
</template>

<style scoped>
.loading-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  margin: 0;
  background: #dfe6ec;
  color: #0f172a;
  font-family: ui-monospace, monospace;
}
.loading-msg {
  margin: 0;
  font-size: 1rem;
}
</style>
