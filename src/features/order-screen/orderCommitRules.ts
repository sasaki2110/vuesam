import type { CellValueChangedEvent } from 'ag-grid-community'
import type { CodeMasterItem } from '@/types/master'
import { applyCommitSpec, type CommitRule } from '@/features/screen-engine/applyCommitSpec'
import type { OrderLineRow } from '@/features/order-screen/orderNewSpec'

export type OrderCommitContext = {
  event: CellValueChangedEvent<OrderLineRow>
  products: readonly CodeMasterItem[]
}

export const orderCommitRules: CommitRule<OrderLineRow, OrderCommitContext>[] = [
  {
    onFields: ['productCode'],
    apply: ({ event, products }) => {
      const { node } = event
      if (!node) return

      const raw = String(event.newValue ?? '').trim()
      const upper = raw.toUpperCase()
      const hit =
        products.find((p) => p.code === raw) ??
        products.find((p) => p.code.toUpperCase() === upper)
      node.setDataValue('productName', hit?.name ?? '')

      if (!raw) return
      const row = node.rowIndex ?? 0
      requestAnimationFrame(() => {
        event.api.setFocusedCell(row, 'quantity')
        event.api.startEditingCell({ rowIndex: row, colKey: 'quantity' })
      })
    },
  },
  {
    onFields: ['quantity', 'unitPrice'],
    apply: ({ event }) => {
      const { node, data } = event
      if (!node || !data) return
      const q = Number(data.quantity) || 0
      const u = Number(data.unitPrice) || 0
      node.setDataValue('amount', q * u)
    },
  },
]

export function applyOrderCommitSpec(
  event: CellValueChangedEvent<OrderLineRow>,
  products: readonly CodeMasterItem[],
) {
  applyCommitSpec(orderCommitRules, { event, products })
}
