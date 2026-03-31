import { ORDER_LIST_SPEC } from '@/features/order-screen/orderListSpec'
import type { ListScreenSpec } from '@/features/screen-engine/screenSpecTypes'

const byId: Record<string, ListScreenSpec> = {
  [ORDER_LIST_SPEC.id]: ORDER_LIST_SPEC,
}

export function resolveListScreenSpec(screenId: string): ListScreenSpec {
  const spec = byId[screenId]
  if (!spec) {
    console.warn(`Unknown list screen id "${screenId}", falling back to order-list`)
    return ORDER_LIST_SPEC
  }
  return spec
}
