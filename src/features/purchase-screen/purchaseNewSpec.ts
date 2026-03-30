import type { PurchaseScreenSpec } from '@/features/screen-engine/screenSpecTypes'

export const PURCHASE_INITIAL_ROWS = 10

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
