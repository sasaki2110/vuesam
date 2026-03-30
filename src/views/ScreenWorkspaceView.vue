<script setup lang="ts">
import { AgGridVue } from 'ag-grid-vue3'
import {
  AllCommunityModule,
  ModuleRegistry,
  type CellValueChangedEvent,
  type ColDef,
  type GridApi,
  type GridReadyEvent,
} from 'ag-grid-community'
import { computed, nextTick, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import ScreenHeaderField from '@/components/ScreenHeaderField.vue'
import { createOrder, fetchParties, fetchProducts } from '@/api/client'
import { PARTIES as MOCK_PARTIES, PRODUCTS as MOCK_PRODUCTS } from '@/constants/mockData'
import type { CodeMasterItem } from '@/types/master'
import type { HeaderFieldSpec } from '@/features/screen-engine/screenSpecTypes'
import { resolveScreenBundle } from '@/features/screen-engine/screenSpecRegistry'
import { useGridEnterNav } from '@/features/screen-engine/useGridEnterNav'
import { useHeaderEnterNav } from '@/features/screen-engine/useHeaderEnterNav'
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
import { applyPurchaseCommitSpec } from '@/features/purchase-screen/purchaseCommitRules'
import {
  buildPurchaseColumnDefs,
  createEmptyPurchaseRows,
  createNextPurchaseRow,
} from '@/features/purchase-screen/purchaseGrid'
import { PURCHASE_NEW_SPEC } from '@/features/purchase-screen/purchaseNewSpec'
import type { PurchaseLineRow } from '@/features/purchase-screen/purchaseTypes'

import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-balham.css'

ModuleRegistry.registerModules([AllCommunityModule])

const popupParentEl = shallowRef<HTMLElement | null>(null)
const route = useRoute()

const screenSpecId = computed(
  () => (route.meta.screenSpecId ?? route.meta.orderScreenSpec ?? 'order-new') as string,
)

const bundle = computed(() => resolveScreenBundle(screenSpecId.value))

function initHeaderRecord(fields: readonly HeaderFieldSpec[]): Record<string, unknown> {
  const o: Record<string, unknown> = {}
  for (const f of fields) {
    o[f.id] = f.editorType === 'masterCombobox' ? null : ''
  }
  return o
}

const orderHeader = reactive<Record<string, unknown>>(initHeaderRecord(ORDER_HEADER_FIELDS))
const purchaseHeader = reactive<Record<string, unknown>>(
  initHeaderRecord(PURCHASE_NEW_SPEC.headerFields),
)

const orderRowData = ref<OrderLineRow[]>(createEmptyOrderRows())
const purchaseRowData = ref<PurchaseLineRow[]>(createEmptyPurchaseRows())

const parties = ref<CodeMasterItem[]>([])
const products = ref<CodeMasterItem[]>([])

const gridApiOrder = shallowRef<GridApi<OrderLineRow> | null>(null)
const gridApiPurchase = shallowRef<GridApi<PurchaseLineRow> | null>(null)
const activeGridApi = shallowRef<GridApi | null>(null)

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

/** インライン :ref だと再レンダーごとに関数参照が変わり、子の ref が毎回外れることがある */
const headerFieldRefCallbacks = new Map<string, (el: unknown) => void>()
function headerFieldRef(fieldId: string) {
  let cb = headerFieldRefCallbacks.get(fieldId)
  if (!cb) {
    cb = (el: unknown) => bindHeaderRef(fieldId, el)
    headerFieldRefCallbacks.set(fieldId, cb)
  }
  return cb
}

const orderSpecResolved = computed(() => resolveOrderScreenSpec(screenSpecId.value))

const orderNav = useGridEnterNav<OrderLineRow>({
  editChainColIds: computed(() => orderSpecResolved.value.navigationSpec.gridEditChainColIds),
  enterStopEditingColIds: computed(
    () => orderSpecResolved.value.navigationSpec.gridEnterStopEditingColIds,
  ),
  gridApi: gridApiOrder,
  rowData: orderRowData,
  createNextRow: createNextOrderRow,
  autocompleteAwareColId: 'productCode',
})

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

const navigationSpec = computed(() => bundle.value.spec.navigationSpec)

const { focusNextAfter, focusFirstInHeaderChain } = useHeaderEnterNav({
  navigationSpec,
  getHeaderFocusMap: () => headerRefs.value,
  gridApi: activeGridApi,
})

watch(
  () => bundle.value.kind,
  () => {
    activeGridApi.value =
      bundle.value.kind === 'order' ? gridApiOrder.value : gridApiPurchase.value
  },
)

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
  const store = bundle.value.kind === 'order' ? orderHeader : purchaseHeader
  if (String(store[field.id] ?? '') === '') {
    store[field.id] = formatJstCalendarDatePlusDays(field.defaultDatePlusDays)
  }
}

/** ag-grid-vue3 は v-model が無いと編集内容が親の ref に戻らない。保存時は API から読むのが確実。 */
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

function handleNew() {
  if (bundle.value.kind === 'order') {
    orderNav.resetEnterNavAdvance()
  } else {
    purchaseNav.resetEnterNavAdvance()
  }
  activeGridApi.value?.stopEditing(true)
  Object.assign(orderHeader, initHeaderRecord(ORDER_HEADER_FIELDS))
  Object.assign(purchaseHeader, initHeaderRecord(PURCHASE_NEW_SPEC.headerFields))
  orderRowData.value = createEmptyOrderRows()
  purchaseRowData.value = createEmptyPurchaseRows()
  requestAnimationFrame(() => focusFirstInHeaderChain())
}

async function handleSave() {
  if (bundle.value.kind === 'order') {
    // F12 はグリッドより先に window で拾われるため、編集中のセルは未コミットのまま。
    // 保存前に確定させてから rowData を読む。
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
  } else {
    gridApiPurchase.value?.stopEditing(false)
    await nextTick()
    console.info('[発注保存モック]', {
      header: { ...purchaseHeader },
      lines: snapshotPurchaseRowsFromGrid().filter(
        (r) => r.materialCode.trim() !== '' || r.qty > 0,
      ),
    })
    alert('発注を保存しました（コンソールにモック出力）')
  }
  handleNew()
}

function onMockF8() {
  alert('F8 モック（受注 Spec の keySpec のみ）')
}

useKeySpec(
  () => bundle.value.spec.keySpec,
  {
    new: handleNew,
    save: handleSave,
    mockAlert: onMockF8,
  },
)

watch(screenSpecId, (id, prev) => {
  if (id === prev) return
  const wasPurchase = prev === PURCHASE_NEW_SPEC.id
  const isPurchase = id === PURCHASE_NEW_SPEC.id
  if (isPurchase || wasPurchase) {
    Object.assign(orderHeader, initHeaderRecord(ORDER_HEADER_FIELDS))
    Object.assign(purchaseHeader, initHeaderRecord(PURCHASE_NEW_SPEC.headerFields))
    orderRowData.value = createEmptyOrderRows()
    purchaseRowData.value = createEmptyPurchaseRows()
  }
})

function onOrderGridReady(e: GridReadyEvent<OrderLineRow>) {
  gridApiOrder.value = e.api
  if (bundle.value.kind === 'order') activeGridApi.value = e.api
}

function onPurchaseGridReady(e: GridReadyEvent<PurchaseLineRow>) {
  gridApiPurchase.value = e.api
  if (bundle.value.kind === 'purchase') activeGridApi.value = e.api
}

function onOrderCellValueChanged(e: CellValueChangedEvent<OrderLineRow>) {
  applyOrderCommitSpec(e, products.value)
}

function onPurchaseCellValueChanged(e: CellValueChangedEvent<PurchaseLineRow>) {
  applyPurchaseCommitSpec(e)
}

const orderColumnDefs = computed(() => buildColumnsBySpec(orderSpecResolved.value, products.value))

const purchaseColumnDefs = computed(() => buildPurchaseColumnDefs())

const defaultColDef = computed((): ColDef => {
  const sup =
    bundle.value.kind === 'order'
      ? orderNav.suppressEnterWhileEditing
      : purchaseNav.suppressEnterWhileEditing
  return {
    sortable: false,
    filter: false,
    resizable: true,
    suppressHeaderMenuButton: true,
    suppressKeyboardEvent: sup as ColDef['suppressKeyboardEvent'],
  }
})

const onCellEditingStopped = computed(() =>
  bundle.value.kind === 'order' ? orderNav.onCellEditingStopped : purchaseNav.onCellEditingStopped,
)

onMounted(() => {
  popupParentEl.value = document.body
  requestAnimationFrame(() => focusFirstInHeaderChain())
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
  <div class="page">
    <header class="hdr">
      <h1 class="hdr-title">{{ bundle.spec.title }}</h1>
      <div class="hdr-actions">
        <button type="button" class="btn btn-outline" @click="handleNew">新規（F01）</button>
        <button type="button" class="btn btn-primary" @click="handleSave">保存 (F12)</button>
      </div>
    </header>

    <div class="body">
      <main class="main">
        <section class="card header-card">
          <p class="hint">ヘッダ（Enter で次項目 ― 順序は Spec の navigationSpec）</p>
          <div class="header-grid">
            <template v-if="bundle.kind === 'order'">
              <ScreenHeaderField
                v-for="field in bundle.spec.headerFields"
                :key="field.id"
                :ref="headerFieldRef(field.id)"
                v-model="orderHeader[field.id]!"
                :field="field"
                :parties="parties"
                @enter-next="focusNextAfter(field.id)"
                @date-focus="onDateFieldFocus(field)"
              />
            </template>
            <template v-else>
              <ScreenHeaderField
                v-for="field in bundle.spec.headerFields"
                :key="field.id"
                :ref="headerFieldRef(field.id)"
                v-model="purchaseHeader[field.id]!"
                :field="field"
                :parties="parties"
                @enter-next="focusNextAfter(field.id)"
                @date-focus="onDateFieldFocus(field)"
              />
            </template>
          </div>
        </section>

        <section class="card grid-card">
          <p class="hint grid-hint">
            {{ bundle.spec.gridHint }}
          </p>
          <div class="ag-theme-balham grid-wrap">
            <AgGridVue
              v-if="bundle.kind === 'order'"
              v-model="orderRowData"
              theme="legacy"
              style="width: 100%; height: 100%"
              :popup-parent="popupParentEl"
              :column-defs="orderColumnDefs"
              :default-col-def="defaultColDef"
              :get-row-id="(p: { data: OrderLineRow }) => String(p.data.lineNo)"
              :single-click-edit="true"
              :enter-navigates-vertically="false"
              :enter-navigates-vertically-after-edit="false"
              @grid-ready="onOrderGridReady"
              @cell-value-changed="onOrderCellValueChanged"
              @cell-editing-stopped="onCellEditingStopped"
            />
            <AgGridVue
              v-else
              v-model="purchaseRowData"
              theme="legacy"
              style="width: 100%; height: 100%"
              :popup-parent="popupParentEl"
              :column-defs="purchaseColumnDefs"
              :default-col-def="defaultColDef"
              :get-row-id="(p: { data: PurchaseLineRow }) => String(p.data.lineNo)"
              :single-click-edit="true"
              :enter-navigates-vertically="false"
              :enter-navigates-vertically-after-edit="false"
              @grid-ready="onPurchaseGridReady"
              @cell-value-changed="onPurchaseCellValueChanged"
              @cell-editing-stopped="onCellEditingStopped"
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

          <h3 class="aside-sub">マスタ一覧（API）</h3>
          <p class="aside-cap">取引先（契約先・納入先）</p>
          <ul class="master-list">
            <li v-for="p in parties" :key="p.code">{{ p.code }}：{{ p.name }}</li>
          </ul>
          <p class="aside-cap">製品（明細）</p>
          <ul class="master-list">
            <li v-for="p in products" :key="p.code">{{ p.code }}：{{ p.name }}</li>
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
