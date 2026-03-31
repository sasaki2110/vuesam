import type { FieldError } from './validationTypes'

export type ApiErrorResponse = {
  code: string
  message: string
  details: { field: string; reason: string }[]
}

/** API の `field`（Spring FieldError パス）→ フロントの fieldKey（ヘッダ id） */
export const ORDER_FIELD_MAPPING: Record<string, string> = {
  contractPartyCode: 'contractParty',
  deliveryPartyCode: 'deliveryParty',
  deliveryLocation: 'deliveryLocation',
  dueDate: 'dueDate',
  forecastNumber: 'forecastNumber',
}

export function mapFieldPath(path: string, mapping: Record<string, string>): string {
  const lineMatch = path.match(/^lines\[(\d+)]\.(.+)$/)
  if (lineMatch) {
    return `${lineMatch[1]}:${lineMatch[2]}`
  }
  return mapping[path] ?? path
}

/**
 * API の 400 レスポンスを FieldError[] に変換する。
 * details が空の場合（業務ルールエラー）は message をグローバルエラーとして返す。
 */
export function parseApiErrors(
  apiErrors: ApiErrorResponse,
  fieldMapping?: Record<string, string>,
): { fieldErrors: FieldError[]; globalMessage: string | null } {
  if (apiErrors.details.length === 0) {
    return { fieldErrors: [], globalMessage: apiErrors.message }
  }

  const map = fieldMapping ?? {}
  const fieldErrors = apiErrors.details.map((d) => ({
    fieldKey: mapFieldPath(d.field, map),
    message: d.reason,
  }))

  return { fieldErrors, globalMessage: null }
}
