import type { ColDef } from 'ag-grid-community'
import type { OrderLine } from '@/types/order'
import type { CodeMasterItem } from '@/constants/mockData'
import { resolveGridFieldTypePartial } from '@/features/screen-engine/editorRegistry'

export type OrderLineRow = OrderLine & { lineNo: number }

export const INITIAL_ROWS = 18

/** Enter で巡回する編集列の順（field / colId と一致させる） */
const DEFAULT_EDIT_CHAIN_COL_IDS = ['productCode', 'quantity', 'unitPrice'] as const
/** Enter で編集終了し、次セル／次行へ進む列（製品コードはオートコンプリート側で確定） */
const DEFAULT_ENTER_STOP_COL_IDS = ['quantity', 'unitPrice'] as const

export type OrderScreenSpec = {
  id: 'order-new' | 'order-new-alt'
  title: string
  gridHint: string
  columnPreset: 'default' | 'alt'
  /** Enter で順に移動する列 ID（AG Grid の colId / field に一致） */
  editChainColIds: readonly string[]
  /** Enter で編集を終了してナビ用フラグを立てる列 ID */
  enterStopEditingColIds: readonly string[]
}

export function createEmptyOrderRows(): OrderLineRow[] {
  return Array.from({ length: INITIAL_ROWS }, (_, i) => ({
    lineNo: i + 1,
    productCode: '',
    productName: '',
    quantity: 0,
    unitPrice: 0,
    amount: 0,
  }))
}

export function createNextOrderRow(prev: OrderLineRow[]): OrderLineRow {
  const lineNo = prev.length > 0 ? Math.max(...prev.map((r) => r.lineNo)) + 1 : 1
  return {
    lineNo,
    productCode: '',
    productName: '',
    quantity: 0,
    unitPrice: 0,
    amount: 0,
  }
}

export function isOrderLineFilled(row: OrderLineRow): boolean {
  return row.productCode.trim() !== '' || row.quantity > 0 || row.unitPrice > 0
}

export function buildOrderColumnDefs(
  products: readonly CodeMasterItem[],
): ColDef<OrderLineRow>[] {
  return [
    {
      headerName: '行',
      field: 'lineNo',
      width: 52,
      pinned: 'left',
      ...resolveGridFieldTypePartial<OrderLineRow>({ fieldType: 'readOnlyText' }),
    },
    {
      headerName: '製品コード',
      field: 'productCode',
      width: 200,
      minWidth: 160,
      ...resolveGridFieldTypePartial<OrderLineRow>({
        fieldType: 'codeAutocomplete',
        params: { options: products },
      }),
      valueFormatter: (p) => {
        const code = String(p.value ?? '').trim()
        if (!code) return ''
        const name = products.find((x) => x.code === code)?.name
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
      ...resolveGridFieldTypePartial<OrderLineRow>({ fieldType: 'readOnlyText' }),
    },
    {
      headerName: '数量',
      field: 'quantity',
      width: 88,
      ...resolveGridFieldTypePartial<OrderLineRow>({ fieldType: 'numeric' }),
    },
    {
      headerName: '単価',
      field: 'unitPrice',
      width: 100,
      ...resolveGridFieldTypePartial<OrderLineRow>({ fieldType: 'numeric' }),
    },
    {
      headerName: '金額',
      field: 'amount',
      width: 112,
      type: 'numericColumn',
      valueFormatter: (p) =>
        p.value == null ? '' : Number(p.value).toLocaleString('ja-JP'),
      ...resolveGridFieldTypePartial<OrderLineRow>({ fieldType: 'readOnlyText' }),
    },
  ]
}

function buildOrderAltColumnDefs(products: readonly CodeMasterItem[]): ColDef<OrderLineRow>[] {
  const cols = buildOrderColumnDefs(products)
  return [
    ...cols,
    {
      headerName: '商品分類',
      colId: 'category',
      width: 120,
      ...resolveGridFieldTypePartial<OrderLineRow>({
        fieldType: 'readOnlyComputed',
        params: {
          valueGetter: (p) => {
            const code = String(p.data?.productCode ?? '')
            if (!code) return ''
            if (code.startsWith('A')) return '完成品'
            if (code.startsWith('B')) return '部材'
            return 'その他'
          },
        },
      }),
    },
  ]
}

export const ORDER_NEW_SPEC: OrderScreenSpec = {
  id: 'order-new',
  title: '受注登録',
  gridHint: '明細（製品はコンボ入力＋リスト／確定で数量へ／数量・単価は Enter で右へ）',
  columnPreset: 'default',
  editChainColIds: DEFAULT_EDIT_CHAIN_COL_IDS,
  enterStopEditingColIds: DEFAULT_ENTER_STOP_COL_IDS,
}

export const ORDER_NEW_ALT_SPEC: OrderScreenSpec = {
  id: 'order-new-alt',
  title: '受注登録（横展開サンプル）',
  gridHint:
    '明細（横展開サンプル: 基本挙動は同一、末尾に読み取り専用の商品分類列を追加）',
  columnPreset: 'alt',
  editChainColIds: DEFAULT_EDIT_CHAIN_COL_IDS,
  enterStopEditingColIds: DEFAULT_ENTER_STOP_COL_IDS,
}

export function resolveOrderScreenSpec(key: string | undefined): OrderScreenSpec {
  if (key === ORDER_NEW_ALT_SPEC.id) return ORDER_NEW_ALT_SPEC
  return ORDER_NEW_SPEC
}

export function buildColumnsBySpec(
  spec: OrderScreenSpec,
  products: readonly CodeMasterItem[],
): ColDef<OrderLineRow>[] {
  if (spec.columnPreset === 'alt') {
    return buildOrderAltColumnDefs(products)
  }
  return buildOrderColumnDefs(products)
}
