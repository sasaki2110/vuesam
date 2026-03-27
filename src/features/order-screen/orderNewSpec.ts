import type { ColDef } from 'ag-grid-community'
import type { OrderLine } from '@/types/order'
import type { CodeMasterItem } from '@/constants/mockData'

export type OrderLineRow = OrderLine & { lineNo: number }

export const INITIAL_ROWS = 18
export const ORDER_EDIT_COLS = ['productCode', 'quantity', 'unitPrice'] as const
export const ORDER_ENTER_NAV_COL_KEYS = new Set<string>(['quantity', 'unitPrice'])

export type OrderScreenSpec = {
  id: 'order-new' | 'order-new-alt'
  title: string
  gridHint: string
  columnPreset: 'default' | 'alt'
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

function parseNumericCellValue(value: unknown): number {
  if (value === '' || value == null) return 0
  const n = Number(String(value).replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

export function buildOrderColumnDefs(
  products: readonly CodeMasterItem[],
  productCodeCellEditor: unknown,
): ColDef<OrderLineRow>[] {
  return [
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
      cellEditor: productCodeCellEditor,
      cellEditorPopup: true,
      cellEditorPopupPosition: 'over',
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
      valueParser: (p) => parseNumericCellValue(p.newValue),
    },
    {
      headerName: '単価',
      field: 'unitPrice',
      width: 100,
      editable: true,
      singleClickEdit: true,
      type: 'numericColumn',
      valueParser: (p) => parseNumericCellValue(p.newValue),
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
  ]
}

function buildOrderAltColumnDefs(
  products: readonly CodeMasterItem[],
  productCodeCellEditor: unknown,
): ColDef<OrderLineRow>[] {
  const cols = buildOrderColumnDefs(products, productCodeCellEditor)
  return [
    ...cols,
    {
      headerName: '商品分類',
      colId: 'category',
      width: 120,
      editable: false,
      valueGetter: (p) => {
        const code = String(p.data?.productCode ?? '')
        if (!code) return ''
        if (code.startsWith('A')) return '完成品'
        if (code.startsWith('B')) return '部材'
        return 'その他'
      },
    },
  ]
}

export const ORDER_NEW_SPEC: OrderScreenSpec = {
  id: 'order-new',
  title: '受注登録',
  gridHint: '明細（製品はコンボ入力＋リスト／確定で数量へ／数量・単価は Enter で右へ）',
  columnPreset: 'default',
}

export const ORDER_NEW_ALT_SPEC: OrderScreenSpec = {
  id: 'order-new-alt',
  title: '受注登録（横展開サンプル）',
  gridHint:
    '明細（横展開サンプル: 基本挙動は同一、末尾に読み取り専用の商品分類列を追加）',
  columnPreset: 'alt',
}

export function resolveOrderScreenSpec(key: string | undefined): OrderScreenSpec {
  if (key === ORDER_NEW_ALT_SPEC.id) return ORDER_NEW_ALT_SPEC
  return ORDER_NEW_SPEC
}

export function buildColumnsBySpec(
  spec: OrderScreenSpec,
  products: readonly CodeMasterItem[],
  productCodeCellEditor: unknown,
): ColDef<OrderLineRow>[] {
  if (spec.columnPreset === 'alt') {
    return buildOrderAltColumnDefs(products, productCodeCellEditor)
  }
  return buildOrderColumnDefs(products, productCodeCellEditor)
}
