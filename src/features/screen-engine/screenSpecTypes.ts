import type { ValidationRule } from './validation/validationTypes'

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
  validation?: ValidationRule[]
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
  /** true: 連続する同一値のセルを結合（AG Grid Row Spanning / enableCellSpan 必須） */
  spanRows?: boolean
  /** セル・ヘッダの横位置。`right` は AG Grid の右詰めクラスを付与 */
  align?: 'left' | 'right' | 'center'
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
  /**
   * グリッド行の一意キー（1受注が複数行になるときは明細 ID など）。
   * 未指定時は deleteAction.idField → rowNavigation.paramField の順で使う。
   */
  listRowIdField?: string
  /**
   * ツールバーに「明細 N 行 · 受注 M 件」と出すときの M の重複排除キー（例: 受注ヘッダ id）。
   */
  toolbarOrderDistinctField?: string
  /**
   * `spanRows: true` の列で、**隣接行のこのフィールドが同じ**ときだけ縦結合する（例: 受注ヘッダ `id`）。
   * 未指定時は AG Grid 既定（セル値の一致）のみ。
   */
  spanRowsGroupField?: string
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
