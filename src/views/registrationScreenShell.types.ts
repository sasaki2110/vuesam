import type {
  CellEditingStoppedEvent,
  CellValueChangedEvent,
  ColDef,
  GridReadyEvent,
} from 'ag-grid-community'
import type { HeaderFieldSpec, NavigationSpec } from '@/features/screen-engine/screenSpecTypes'
import type { CodeMasterItem } from '@/types/master'

/** 行データは `v-model:row-data` で渡す（ag-grid の v-model と整合） */
export type RegistrationShellProps = {
  title: string
  gridHint: string
  headerFields: HeaderFieldSpec[]
  navigationSpec: NavigationSpec
  header: Record<string, unknown>
  columnDefs: ColDef[]
  defaultColDef: ColDef
  getRowId: (params: { data: unknown }) => string
  parties: CodeMasterItem[]
  products: CodeMasterItem[]
}

export type RegistrationShellEmits = {
  gridReady: [event: GridReadyEvent]
  cellValueChanged: [event: CellValueChangedEvent]
  cellEditingStopped: [event: CellEditingStoppedEvent]
  new: []
  save: []
  dateFocus: [field: HeaderFieldSpec]
}
