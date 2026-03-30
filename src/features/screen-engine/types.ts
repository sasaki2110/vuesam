import type { ICellEditorParams } from 'ag-grid-community'
import type { CodeMasterItem } from '@/constants/mockData'

/** field type `codeAutocomplete` 用。列の `cellEditorParams` で必ず渡す */
export type CodeAutocompleteCellEditorParams = ICellEditorParams & {
  options: readonly CodeMasterItem[]
}
