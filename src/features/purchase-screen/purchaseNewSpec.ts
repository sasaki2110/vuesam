import type { PurchaseScreenSpec } from '@/features/screen-engine/screenSpecTypes'
import type { GridColumnValidation } from '@/features/screen-engine/validation/validateGridRows'

export const PURCHASE_INITIAL_ROWS = 10

export const PURCHASE_GRID_VALIDATIONS: GridColumnValidation[] = [
  { colId: 'materialCode', label: '品目コード', validation: [{ type: 'required' }] },
  {
    colId: 'qty',
    label: '数量',
    validation: [
      {
        type: 'custom',
        validate: (v) =>
          typeof v === 'number' && v > 0 ? null : '数量は1以上で入力してください',
      },
    ],
  },
]

export const PURCHASE_NEW_SPEC: PurchaseScreenSpec = {
  id: 'purchase-new',
  title: '発注登録（デモ）',
  gridHint: '明細（品目コード・数量のみの簡易グリッド／Enter で右・最終で次行）',
  headerFields: [
    {
      id: 'supplier',
      label: '仕入先コード',
      editorType: 'masterCombobox',
      optionsRef: 'parties',
      placeholder: '例: 1001',
      validation: [{ type: 'required' }],
    },
    {
      id: 'note',
      label: '備考',
      editorType: 'text',
      placeholder: '発注メモ',
    },
  ],
  navigationSpec: {
    headerEnterOrder: ['supplier', 'note'],
    gridEntryColumnField: 'materialCode',
    gridEditChainColIds: ['materialCode', 'qty'],
    gridEnterStopEditingColIds: ['materialCode', 'qty'],
  },
  keySpec: {},
}
