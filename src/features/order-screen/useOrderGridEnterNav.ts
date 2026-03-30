import type {
  CellEditingStoppedEvent,
  GridApi,
  SuppressKeyboardEventParams,
} from 'ag-grid-community'
import type { ShallowRef, Ref, ComputedRef } from 'vue'
import { computed, ref } from 'vue'
import type { OrderLineRow } from '@/features/order-screen/orderNewSpec'

function isAutocompleteListOpen(input: EventTarget | null): boolean {
  if (!(input instanceof HTMLInputElement)) return false
  return input.getAttribute('aria-expanded') === 'true'
}

export type UseOrderGridEnterNavOptions = {
  editChainColIds: ComputedRef<readonly string[]>
  enterStopEditingColIds: ComputedRef<readonly string[]>
  gridApi: ShallowRef<GridApi<OrderLineRow> | null>
  rowData: Ref<OrderLineRow[]>
  createNextRow: (prev: OrderLineRow[]) => OrderLineRow
}

/** 製品コードセルでオートコンプリートの Enter 競合を避ける対象列 ID */
const productCodeColId = 'productCode'

export function useOrderGridEnterNav(options: UseOrderGridEnterNavOptions) {
  const advanceRowOnStop = ref(false)

  const enterStopSet = computed(
    () => new Set(options.enterStopEditingColIds.value),
  )

  function resetEnterNavAdvance() {
    advanceRowOnStop.value = false
  }

  function suppressEnterWhileEditing(
    params: SuppressKeyboardEventParams<OrderLineRow, unknown>,
  ) {
    if (!params.editing) return false
    const ev = params.event
    const colId = params.column.getColId()

    if (
      colId === productCodeColId &&
      !ev.shiftKey &&
      !ev.ctrlKey &&
      !ev.altKey &&
      (ev.key === 'ArrowDown' || ev.key === 'ArrowUp')
    ) {
      return true
    }

    if (ev.key !== 'Enter' || ev.shiftKey || ev.ctrlKey || ev.altKey) {
      return false
    }
    if (colId === productCodeColId) {
      if (
        isAutocompleteListOpen(ev.target) ||
        isAutocompleteListOpen(document.activeElement)
      ) {
        return true
      }
    }
    if (!enterStopSet.value.has(colId)) return false
    ev.preventDefault()
    advanceRowOnStop.value = true
    params.api.stopEditing(false)
    return true
  }

  function onCellEditingStopped(e: CellEditingStoppedEvent<OrderLineRow>) {
    if (!advanceRowOnStop.value) return
    advanceRowOnStop.value = false

    const chain = options.editChainColIds.value
    const api = e.api
    const colId = e.column.getColId()
    const idx = chain.indexOf(colId)
    if (idx === -1) return

    const row = e.node.rowIndex ?? 0
    const nextIdx = idx + 1

    if (nextIdx < chain.length) {
      const colKey = chain[nextIdx]!
      api.setFocusedCell(row, colKey)
      api.startEditingCell({ rowIndex: row, colKey })
      return
    }

    const nextRow = row + 1
    const col0 = chain[0]!
    const rowCount = api.getDisplayedRowCount()

    if (nextRow < rowCount) {
      api.setFocusedCell(nextRow, col0)
      api.startEditingCell({ rowIndex: nextRow, colKey: col0 })
      return
    }

    options.rowData.value = (() => {
      const prev = options.rowData.value
      return [...prev, options.createNextRow(prev)]
    })()

    setTimeout(() => {
      const api2 = options.gridApi.value
      if (!api2) return
      api2.setFocusedCell(nextRow, col0)
      api2.startEditingCell({ rowIndex: nextRow, colKey: col0 })
    }, 0)
  }

  return {
    suppressEnterWhileEditing,
    onCellEditingStopped,
    resetEnterNavAdvance,
  }
}
