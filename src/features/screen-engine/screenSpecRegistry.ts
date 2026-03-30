import { resolveOrderScreenSpec, type OrderScreenSpec } from '@/features/order-screen/orderNewSpec'
import { PURCHASE_NEW_SPEC } from '@/features/purchase-screen/purchaseNewSpec'
import type { PurchaseScreenSpec } from '@/features/screen-engine/screenSpecTypes'

export type ScreenBundle =
  | { kind: 'order'; spec: OrderScreenSpec }
  | { kind: 'purchase'; spec: PurchaseScreenSpec }

export function resolveScreenBundle(screenId: string): ScreenBundle {
  if (screenId === PURCHASE_NEW_SPEC.id) {
    return { kind: 'purchase', spec: PURCHASE_NEW_SPEC }
  }
  return { kind: 'order', spec: resolveOrderScreenSpec(screenId) }
}
