import type { CellValueChangedEvent } from 'ag-grid-community'
import { applyCommitSpec, type CommitRule } from '@/features/screen-engine/applyCommitSpec'
import type { PurchaseLineRow } from '@/features/purchase-screen/purchaseTypes'

export type PurchaseCommitContext = {
  event: CellValueChangedEvent<PurchaseLineRow>
}

const purchaseCommitRules: CommitRule<PurchaseLineRow, PurchaseCommitContext>[] = []

export function applyPurchaseCommitSpec(event: CellValueChangedEvent<PurchaseLineRow>) {
  applyCommitSpec(purchaseCommitRules, { event })
}
