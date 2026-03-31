export type FieldError = {
  /** ヘッダ: field id、グリッド: `${rowIndex}:${colId}` */
  fieldKey: string
  message: string
}

export type ValidationResult = {
  valid: boolean
  errors: FieldError[]
}

export type ValidationRule =
  | { type: 'required'; message?: string }
  | { type: 'minLength'; value: number; message?: string }
  | { type: 'maxLength'; value: number; message?: string }
  | { type: 'pattern'; regex: string; message?: string }
  | { type: 'custom'; validate: (value: unknown) => string | null }
