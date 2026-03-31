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
    { field: 'orderNumber', headerName: '受注番号', width: 160 },
    { field: 'lineNo', headerName: '行', width: 72 },
    { field: 'productCode', headerName: '製品コード', width: 120 },
    { field: 'productName', headerName: '製品名', width: 200 },
    { field: 'quantity', headerName: '数量', width: 88, format: 'number' },
    { field: 'unitPrice', headerName: '単価', width: 100, format: 'number' },
    { field: 'amount', headerName: '明細金額', width: 120, format: 'number' },
    { field: 'contractPartyName', headerName: '契約先', width: 160 },
    { field: 'deliveryPartyName', headerName: '納入先', width: 160 },
    { field: 'dueDate', headerName: '納期', width: 112, format: 'date' },
    { field: 'totalAmount', headerName: '受注合計', width: 120, format: 'number' },
    { field: 'lineCount', headerName: '明細行数', width: 96, format: 'number' },
    { field: 'createdAt', headerName: '登録日時', width: 168, format: 'date' },
  ],
  listRowIdField: 'lineId',
  toolbarOrderDistinctField: 'id',
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
