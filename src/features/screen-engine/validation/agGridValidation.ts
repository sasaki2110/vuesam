import type { CellClassParams, ColDef } from 'ag-grid-community'
import type { Ref } from 'vue'
import type { FieldError } from './validationTypes'

/** グリッド外観用。AG Grid のテーマ配下で定義（RegistrationScreenShell のグローバル CSS） */
export const AG_GRID_VALIDATION_ERROR_CLASS = 'ag-cell-validation-error'

function resolveBaseCellClass<T>(
  prev: ColDef<T>['cellClass'],
  params: CellClassParams<T>,
): string {
  if (prev == null) return ''
  if (typeof prev === 'function') {
    const r = prev(params)
    if (Array.isArray(r)) return r.filter(Boolean).join(' ')
    return r ? String(r) : ''
  }
  if (Array.isArray(prev)) return prev.filter(Boolean).join(' ')
  return String(prev)
}

/**
 * バリデーションエラーを cellClass で表す（cellStyle のインラインは解除されず残る事例への対策）。
 */
export function mergeColDefWithValidation<T>(
  col: ColDef<T>,
  validationErrors: Ref<FieldError[]>,
): ColDef<T> {
  const prevClass = col.cellClass
  const prevTooltip = col.tooltipValueGetter

  return {
    ...col,
    cellClass: (params: CellClassParams<T>) => {
      const base = resolveBaseCellClass(prevClass, params).trim()
      const rowIdx = params.node?.rowIndex
      const column = params.column
      const colId = column && 'getColId' in column ? column.getColId() : undefined
      if (rowIdx == null || colId == null) return base || undefined
      const key = `${rowIdx}:${colId}`
      const err = validationErrors.value.find((e) => e.fieldKey === key)
      if (!err) return base || undefined
      return base ? `${base} ${AG_GRID_VALIDATION_ERROR_CLASS}` : AG_GRID_VALIDATION_ERROR_CLASS
    },
    tooltipValueGetter: (params) => {
      const rowIdx = params.node?.rowIndex
      const column = params.column
      const colId = column && 'getColId' in column ? column.getColId() : undefined
      if (rowIdx != null && colId != null) {
        const key = `${rowIdx}:${colId}`
        const msg = validationErrors.value.find((e) => e.fieldKey === key)?.message
        if (msg) return msg
      }
      if (typeof prevTooltip === 'function') return prevTooltip(params)
      return undefined
    },
  }
}
