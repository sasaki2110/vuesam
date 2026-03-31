import type { ColDef } from 'ag-grid-community'
import type { OrderLine } from '@/types/order'
import type { CodeMasterItem } from '@/types/master'
import { resolveGridFieldTypePartial } from '@/features/screen-engine/editorRegistry'
import type {
  HeaderFieldSpec,
  KeySpec,
  NavigationSpec,
  OrderScreenSpec,
} from '@/features/screen-engine/screenSpecTypes'
import type { GridColumnValidation } from '@/features/screen-engine/validation/validateGridRows'

export type { OrderScreenSpec } from '@/features/screen-engine/screenSpecTypes'

export type OrderLineRow = OrderLine & { lineNo: number }

export const INITIAL_ROWS = 18

const DEFAULT_GRID_EDIT_CHAIN = ['productCode', 'quantity', 'unitPrice'] as const
const DEFAULT_GRID_ENTER_STOP = ['quantity', 'unitPrice'] as const

/** 受注ヘッダ（備考は Enter テスト用。チェーンから外すときは navigationSpec.headerEnterOrder から除く） */
export const ORDER_HEADER_FIELDS: HeaderFieldSpec[] = [
  {
    id: 'contractParty',
    label: '契約先コード',
    editorType: 'masterCombobox',
    optionsRef: 'parties',
    placeholder: '例: 1001',
    validation: [{ type: 'required' }],
  },
  {
    id: 'deliveryParty',
    label: '納入先コード',
    editorType: 'masterCombobox',
    optionsRef: 'parties',
    placeholder: '例: 3001',
    validation: [{ type: 'required' }],
  },
  {
    id: 'deliveryLocation',
    label: '納入場所',
    editorType: 'text',
  },
  {
    id: 'dueDate',
    label: '納期',
    editorType: 'date',
    defaultDatePlusDays: 7,
  },
  {
    id: 'forecastNumber',
    label: '内示番号',
    editorType: 'text',
    gridColumnSpan: 2,
  },
  {
    id: 'memoNote',
    label: '備考（Enterテスト用）',
    editorType: 'text',
    placeholder: 'Enter チェーンに含める／除外は headerEnterOrder で切替',
  },
]

const ORDER_NAV_WITH_MEMO: NavigationSpec = {
  headerEnterOrder: [
    'contractParty',
    'deliveryParty',
    'deliveryLocation',
    'dueDate',
    'forecastNumber',
    'memoNote',
  ],
  gridEntryColumnField: 'productCode',
  gridEditChainColIds: DEFAULT_GRID_EDIT_CHAIN,
  gridEnterStopEditingColIds: DEFAULT_GRID_ENTER_STOP,
}

/** order-new-alt: 備考は表示するが Enter チェーンから除外 */
const ORDER_NAV_ALT: NavigationSpec = {
  headerEnterOrder: [
    'contractParty',
    'deliveryParty',
    'deliveryLocation',
    'dueDate',
    'forecastNumber',
  ],
  gridEntryColumnField: 'productCode',
  gridEditChainColIds: DEFAULT_GRID_EDIT_CHAIN,
  gridEnterStopEditingColIds: DEFAULT_GRID_ENTER_STOP,
}

const ORDER_KEY_SPEC = {
  F8: 'mockAlert',
} satisfies KeySpec

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

export const ORDER_GRID_VALIDATIONS: GridColumnValidation[] = [
  { colId: 'productCode', label: '製品コード', validation: [{ type: 'required' }] },
  {
    colId: 'quantity',
    label: '数量',
    validation: [
      {
        type: 'custom',
        validate: (v) =>
          typeof v === 'number' && v > 0 ? null : '数量は1以上の整数を入力してください',
      },
    ],
  },
  {
    colId: 'unitPrice',
    label: '単価',
    validation: [
      {
        type: 'custom',
        validate: (v) =>
          typeof v === 'number' && v > 0 ? null : '単価は1以上の整数を入力してください',
      },
    ],
  },
  {
    colId: 'amount',
    label: '金額',
    validation: [
      {
        type: 'custom',
        validate: (v) =>
          typeof v === 'number' && v > 0 ? null : '金額は必須です',
      },
    ],
  },
]

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
  headerFields: ORDER_HEADER_FIELDS,
  navigationSpec: ORDER_NAV_WITH_MEMO,
  keySpec: ORDER_KEY_SPEC,
  columnPreset: 'default',
}

export const ORDER_NEW_ALT_SPEC: OrderScreenSpec = {
  id: 'order-new-alt',
  title: '受注登録（横展開サンプル）',
  gridHint:
    '明細（横展開サンプル: 基本挙動は同一、末尾に読み取り専用の商品分類列を追加）',
  headerFields: ORDER_HEADER_FIELDS,
  navigationSpec: ORDER_NAV_ALT,
  keySpec: ORDER_KEY_SPEC,
  columnPreset: 'alt',
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
