import type { CellValueChangedEvent } from 'ag-grid-community'

export type CommitRule<TRow, TCtx extends { event: CellValueChangedEvent<TRow> }> = {
  onFields: readonly string[]
  apply: (ctx: TCtx) => void
}

/**
 * 値確定イベントに対し、該当フィールドのルールを順に実行する。
 */
export function applyCommitSpec<TRow, TCtx extends { event: CellValueChangedEvent<TRow> }>(
  rules: readonly CommitRule<TRow, TCtx>[],
  ctx: TCtx,
): void {
  const field = ctx.event.colDef.field as string | undefined
  if (!field) return
  for (const rule of rules) {
    if (rule.onFields.includes(field)) {
      rule.apply(ctx)
    }
  }
}
