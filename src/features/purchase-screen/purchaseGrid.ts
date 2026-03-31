import type { ColDef } from 'ag-grid-community'
import { resolveGridFieldTypePartial } from '@/features/screen-engine/editorRegistry'
import type { PurchaseLineRow } from '@/features/purchase-screen/purchaseTypes'
import { PURCHASE_INITIAL_ROWS } from '@/features/purchase-screen/purchaseNewSpec'

export function createEmptyPurchaseRows(): PurchaseLineRow[] {
  return Array.from({ length: PURCHASE_INITIAL_ROWS }, (_, i) => ({
    lineNo: i + 1,
    materialCode: '',
    qty: 0,
  }))
}

export function createNextPurchaseRow(prev: PurchaseLineRow[]): PurchaseLineRow {
  const lineNo = prev.length > 0 ? Math.max(...prev.map((r) => r.lineNo)) + 1 : 1
  return { lineNo, materialCode: '', qty: 0 }
}

export function isPurchaseLineFilled(row: PurchaseLineRow): boolean {
  return row.materialCode.trim() !== '' || row.qty > 0
}

export function buildPurchaseColumnDefs(): ColDef<PurchaseLineRow>[] {
  return [
    {
      headerName: '行',
      field: 'lineNo',
      width: 52,
      pinned: 'left',
      ...resolveGridFieldTypePartial<PurchaseLineRow>({ fieldType: 'readOnlyText' }),
    },
    {
      headerName: '品目コード',
      field: 'materialCode',
      width: 200,
      ...resolveGridFieldTypePartial<PurchaseLineRow>({ fieldType: 'text' }),
    },
    {
      headerName: '数量',
      field: 'qty',
      width: 100,
      ...resolveGridFieldTypePartial<PurchaseLineRow>({ fieldType: 'numeric' }),
    },
  ]
}
