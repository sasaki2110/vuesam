import type { CellValueChangedEvent } from 'ag-grid-community'
import type { CodeMasterItem } from '@/constants/mockData'
import type { OrderLineRow } from '@/features/order-screen/orderNewSpec'

type CommitContext = {
  event: CellValueChangedEvent<OrderLineRow>
  products: readonly CodeMasterItem[]
}

type CommitRule = {
  fields: Array<keyof OrderLineRow>
  apply: (ctx: CommitContext) => void
}

const orderCommitRules: CommitRule[] = [
  {
    fields: ['productCode'],
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
    fields: ['quantity', 'unitPrice'],
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
  const field = event.colDef.field as keyof OrderLineRow | undefined
  if (!field) return

  for (const rule of orderCommitRules) {
    if (rule.fields.includes(field)) {
      rule.apply({ event, products })
    }
  }
}
