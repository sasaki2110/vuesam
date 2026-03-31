import type { ComputedRef } from 'vue'

export type HeaderFocusRegistry = () => Map<string, { focus: () => void }>

/** 一覧画面の検索条件のみ（グリッド Enter 連携なし） */
export function useListSearchEnterNav(options: {
  enterOrder: ComputedRef<readonly string[]>
  getHeaderFocusMap: HeaderFocusRegistry
}) {
  function focusNextAfter(currentFieldId: string) {
    const order = options.enterOrder.value
    const i = order.indexOf(currentFieldId)
    if (i === -1) return
    const nextId = order[i + 1]
    if (nextId) options.getHeaderFocusMap().get(nextId)?.focus()
  }

  function focusFirstInSearchChain() {
    const first = options.enterOrder.value[0]
    if (first) options.getHeaderFocusMap().get(first)?.focus()
  }

  return { focusNextAfter, focusFirstInSearchChain }
}
