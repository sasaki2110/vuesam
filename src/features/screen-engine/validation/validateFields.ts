import type { HeaderFieldSpec } from '../screenSpecTypes'
import type { FieldError, ValidationResult, ValidationRule } from './validationTypes'

/**
 * 1 つのルールを値に適用し、エラーメッセージまたは null を返す。
 * ヘッダ・グリッド両方から利用するためエクスポートする。
 */
export function executeRule(
  rule: ValidationRule,
  value: unknown,
  label: string,
): string | null {
  switch (rule.type) {
    case 'required': {
      const empty =
        value == null ||
        (typeof value === 'string' && value.trim() === '') ||
        (typeof value === 'object' &&
          value !== null &&
          'code' in value &&
          !(value as { code?: string }).code)
      return empty ? (rule.message ?? `${label}は必須です`) : null
    }
    case 'minLength': {
      const s = String(value ?? '')
      return s.length < rule.value
        ? (rule.message ?? `${label}は${rule.value}文字以上で入力してください`)
        : null
    }
    case 'maxLength': {
      const s = String(value ?? '')
      return s.length > rule.value
        ? (rule.message ?? `${label}は${rule.value}文字以下で入力してください`)
        : null
    }
    case 'pattern': {
      const s = String(value ?? '')
      return !new RegExp(rule.regex).test(s)
        ? (rule.message ?? `${label}の形式が正しくありません`)
        : null
    }
    case 'custom':
      return rule.validate(value)
  }
}

/**
 * ヘッダフィールドの値をバリデーションし、エラーの配列を返す。
 */
export function validateHeaderFields(
  fields: readonly HeaderFieldSpec[],
  values: Record<string, unknown>,
): ValidationResult {
  const errors: FieldError[] = []

  for (const field of fields) {
    if (!field.validation) continue
    const value = values[field.id]
    for (const rule of field.validation) {
      const message = executeRule(rule, value, field.label)
      if (message) {
        errors.push({ fieldKey: field.id, message })
        break
      }
    }
  }

  return { valid: errors.length === 0, errors }
}
