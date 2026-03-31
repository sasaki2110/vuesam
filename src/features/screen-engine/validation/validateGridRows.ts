import type { FieldError, ValidationResult, ValidationRule } from './validationTypes'
import { executeRule } from './validateFields'

export type GridColumnValidation = {
  colId: string
  label: string
  validation: ValidationRule[]
}

/**
 * グリッドの行データをバリデーションし、エラーの配列を返す。
 * fieldKey は `${rowIndex}:${colId}` の形式。
 */
export function validateGridRows(
  rows: Record<string, unknown>[],
  columns: GridColumnValidation[],
  isRowFilled: (row: Record<string, unknown>) => boolean,
): ValidationResult {
  const errors: FieldError[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (!row || !isRowFilled(row)) continue
    for (const col of columns) {
      for (const rule of col.validation) {
        const message = executeRule(rule, row[col.colId], col.label)
        if (message) {
          errors.push({ fieldKey: `${i}:${col.colId}`, message })
          break
        }
      }
    }
  }

  return { valid: errors.length === 0, errors }
}
