/**
 * 受注ヘッダ（契約先・納入先・場所・納期・内示番号）
 */
export type OrderHeader = {
  contractPartyCode: string
  deliveryPartyCode: string
  deliveryLocation: string
  dueDate: string
  forecastNumber: string
}

/**
 * 受注明細（製品・数量・単価・金額）
 */
export type OrderLine = {
  productCode: string
  productName: string
  quantity: number
  unitPrice: number
  amount: number
}
