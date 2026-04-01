import type {
  CellEditingStoppedEvent,
  CellValueChangedEvent,
  ColDef,
  GridReadyEvent,
} from 'ag-grid-community'
import type { HeaderFieldSpec, NavigationSpec } from '@/features/screen-engine/screenSpecTypes'
import type { FieldError } from '@/features/screen-engine/validation/validationTypes'
import type { CodeMasterItem } from '@/types/master'

/** 行データは `v-model:row-data` で渡す（ag-grid の v-model と整合） */
export type RegistrationShellProps = {
  title: string
  /** 例: 受注番号の表示（変更画面用） */
  headerSubtitle?: string
  /** 左ヘッダボタン文言（既定: 新規（F01）） */
  newButtonLabel?: string
  gridHint: string
  headerFields: HeaderFieldSpec[]
  navigationSpec: NavigationSpec
  header: Record<string, unknown>
  columnDefs: ColDef[]
  defaultColDef: ColDef
  getRowId: (params: { data: unknown }) => string
  parties: CodeMasterItem[]
  products: CodeMasterItem[]
  /** ヘッダ field id / グリッド `row:col` / 明細全体は `lines` */
  validationErrors?: FieldError[]
  /** 増やすたびにグリッドを再マウント（エラー表示のリセットを確実にする） */
  gridSessionKey?: number
}

export type RegistrationShellEmits = {
  gridReady: [event: GridReadyEvent]
  cellValueChanged: [event: CellValueChangedEvent]
  cellEditingStopped: [event: CellEditingStoppedEvent]
  new: []
  save: []
  dateFocus: [field: HeaderFieldSpec]
}
