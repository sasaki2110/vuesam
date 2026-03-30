import type { ColDef } from 'ag-grid-community'
import type { CodeMasterItem } from '@/types/master'
import ProductCodeCellEditor from '@/components/grid/ProductCodeCellEditor.vue'

export const GRID_FIELD_TYPES = [
  'codeAutocomplete',
  'numeric',
  'text',
  'readOnlyText',
  'readOnlyComputed',
] as const

export type GridFieldType = (typeof GRID_FIELD_TYPES)[number]

export type CodeAutocompleteFieldParams = {
  options: readonly CodeMasterItem[]
}

export type ReadOnlyComputedFieldParams<TData = unknown> = {
  valueGetter: NonNullable<ColDef<TData>['valueGetter']>
}

export type GridFieldResolveInput<TData = unknown> =
  | { fieldType: 'codeAutocomplete'; params: CodeAutocompleteFieldParams }
  | { fieldType: 'numeric' }
  | { fieldType: 'text' }
  | { fieldType: 'readOnlyText' }
  | { fieldType: 'readOnlyComputed'; params: ReadOnlyComputedFieldParams<TData> }

function parseNumericCellValue(value: unknown): number {
  if (value === '' || value == null) return 0
  const n = Number(String(value).replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

/**
 * AG Grid の列定義にマージする断片を、field type から解決する。
 * カスタムセルエディタの import はこのモジュールに集約する。
 */
export function resolveGridFieldTypePartial<TData>(
  input: GridFieldResolveInput<TData>,
): Partial<ColDef<TData>> {
  switch (input.fieldType) {
    case 'codeAutocomplete':
      return {
        editable: true,
        singleClickEdit: true,
        cellEditor: ProductCodeCellEditor,
        cellEditorPopup: true,
        cellEditorPopupPosition: 'over',
        cellEditorParams: {
          options: input.params.options,
        },
      }
    case 'numeric':
      return {
        editable: true,
        singleClickEdit: true,
        type: 'numericColumn',
        valueParser: (p) => parseNumericCellValue(p.newValue),
      }
    case 'text':
      return {
        editable: true,
        singleClickEdit: true,
      }
    case 'readOnlyText':
      return {
        editable: false,
        singleClickEdit: false,
      }
    case 'readOnlyComputed':
      return {
        editable: false,
        singleClickEdit: false,
        valueGetter: input.params.valueGetter,
      }
  }
}
