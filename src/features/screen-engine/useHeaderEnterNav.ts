import type { GridApi } from 'ag-grid-community'
import type { ComputedRef, ShallowRef } from 'vue'
import type { NavigationSpec } from '@/features/screen-engine/screenSpecTypes'

export type HeaderFocusRegistry = () => Map<string, { focus: () => void }>

export function useHeaderEnterNav(options: {
  navigationSpec: ComputedRef<NavigationSpec>
  getHeaderFocusMap: HeaderFocusRegistry
  gridApi: ShallowRef<GridApi | null>
}) {
  function focusNextAfter(currentFieldId: string) {
    const nav = options.navigationSpec.value
    const order = nav.headerEnterOrder
    const i = order.indexOf(currentFieldId)
    if (i === -1) return
    const nextId = order[i + 1]
    const map = options.getHeaderFocusMap()
    if (nextId) {
      map.get(nextId)?.focus()
      return
    }
    const api = options.gridApi.value
    if (!api) return
    const col = nav.gridEntryColumnField
    api.setFocusedCell(0, col)
    api.startEditingCell({ rowIndex: 0, colKey: col })
  }

  function focusFirstInHeaderChain() {
    const first = options.navigationSpec.value.headerEnterOrder[0]
    if (!first) return
    options.getHeaderFocusMap().get(first)?.focus()
  }

  return { focusNextAfter, focusFirstInHeaderChain }
}
