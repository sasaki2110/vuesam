import type { ListScreenSpec } from '@/features/screen-engine/screenSpecTypes'

export const ORDER_LIST_SPEC: ListScreenSpec = {
  id: 'order-list',
  title: '受注一覧',
  searchFields: [
    {
      id: 'orderNumber',
      label: '受注番号',
      editorType: 'text',
      placeholder: '例: ORD-2026',
    },
    {
      id: 'contractParty',
      label: '契約先',
      editorType: 'masterCombobox',
      optionsRef: 'parties',
    },
    {
      id: 'dueDateFrom',
      label: '納期（From）',
      editorType: 'date',
    },
    {
      id: 'dueDateTo',
      label: '納期（To）',
      editorType: 'date',
    },
  ],
  resultColumns: [
    { field: 'orderNumber', headerName: '受注番号', width: 180 },
    { field: 'contractPartyName', headerName: '契約先', width: 180 },
    { field: 'deliveryPartyName', headerName: '納入先', width: 180 },
    { field: 'dueDate', headerName: '納期', width: 120, format: 'date' },
    { field: 'totalAmount', headerName: '金額合計', width: 140, format: 'number' },
    { field: 'createdAt', headerName: '登録日時', width: 160, format: 'date' },
  ],
  rowNavigation: {
    routeName: 'order-edit',
    paramField: 'id',
  },
  deleteAction: {
    apiPath: '/api/orders',
    idField: 'id',
    confirmMessage: '選択した受注を削除しますか？',
  },
  searchAction: {
    apiPath: '/api/orders',
  },
  searchParamMapping: {
    contractParty: 'contractPartyCode',
  },
  searchFieldEnterOrder: ['orderNumber', 'contractParty', 'dueDateFrom', 'dueDateTo'],
  keySpec: {
    F1: 'clearSearch',
    F12: 'search',
  },
}
