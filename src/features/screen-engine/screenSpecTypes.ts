/** ヘッダ1項目の宣言（テンプレは v-for で描画） */
export type HeaderEditorType = 'masterCombobox' | 'text' | 'date'

export type HeaderFieldSpec = {
  id: string
  label: string
  editorType: HeaderEditorType
  placeholder?: string
  /** 768px 以上で grid-column: span N */
  gridColumnSpan?: number
  /** masterCombobox 用。実行時にマスタ解決 */
  optionsRef?: 'parties'
  /** date: 空のときフォーカスで入れる既定日（今日＋日数） */
  defaultDatePlusDays?: number
}

export type NavigationSpec = {
  /** Enter で順に移動するヘッダ項目 id（ここに無い項目は Enter チェーンに含めない） */
  headerEnterOrder: readonly string[]
  /** ヘッダチェーンの次にフォーカスするグリッド列 field */
  gridEntryColumnField: string
  gridEditChainColIds: readonly string[]
  gridEnterStopEditingColIds: readonly string[]
}

export type KeyActionId = 'new' | 'save' | 'mockAlert' | 'search' | 'clearSearch'

export type ListResultColumn = {
  field: string
  headerName: string
  width?: number
  format?: 'date' | 'number' | 'text'
}

export type ListScreenSpec = {
  id: string
  title: string
  searchFields: HeaderFieldSpec[]
  resultColumns: ListResultColumn[]
  rowNavigation: {
    routeName: string
    paramField: string
  }
  deleteAction: {
    apiPath: string
    idField: string
    confirmMessage: string
  } | null
  searchAction: {
    apiPath: string
  }
  searchParamMapping?: Record<string, string>
  searchFieldEnterOrder: readonly string[]
  keySpec: KeySpec
}

export type FunctionKey =
  | 'F1'
  | 'F2'
  | 'F3'
  | 'F4'
  | 'F5'
  | 'F6'
  | 'F7'
  | 'F8'
  | 'F9'
  | 'F10'
  | 'F11'
  | 'F12'

/** Spec で上書きする F キーだけ定義。未定義キーは何もしない */
export type KeySpec = Partial<Record<FunctionKey, KeyActionId>>

/** 画面共通 + 受注グリッド用オプション */
export type OrderScreenSpec = {
  id: string
  title: string
  gridHint: string
  headerFields: HeaderFieldSpec[]
  navigationSpec: NavigationSpec
  keySpec: KeySpec
  columnPreset: 'default' | 'alt'
}

/** 別業務（発注デモ）用。グリッドは adapter 側で解決 */
export type PurchaseScreenSpec = {
  id: string
  title: string
  gridHint: string
  headerFields: HeaderFieldSpec[]
  navigationSpec: NavigationSpec
  keySpec: KeySpec
}
