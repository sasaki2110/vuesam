import type { ApiErrorResponse } from '@/features/screen-engine/validation/parseApiErrors'
import type { CodeMasterItem } from '@/types/master'

const baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''

export function getApiBaseUrl(): string {
  return baseUrl
}

export function getAuthHeaders(): HeadersInit {
  const token = sessionStorage.getItem('accessToken')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export type LoginResponse = {
  accessToken: string
  tokenType: string
}

export async function fetchHealth(): Promise<unknown> {
  const url = `${baseUrl}/health`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`health failed: ${res.status}`)
  }
  return res.json()
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  const url = `${baseUrl}/api/auth/login`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) {
    throw new Error(`login failed: ${res.status}`)
  }
  return (await res.json()) as LoginResponse
}

export async function fetchProjects(): Promise<unknown> {
  const url = `${baseUrl}/api/projects`
  const res = await fetch(url, { headers: getAuthHeaders() })
  if (!res.ok) {
    throw new Error(`projects failed: ${res.status}`)
  }
  return res.json()
}

export async function fetchParties(): Promise<CodeMasterItem[]> {
  const url = `${baseUrl}/api/masters/parties`
  const res = await fetch(url, { headers: getAuthHeaders() })
  if (!res.ok) throw new Error(`fetchParties failed: ${res.status}`)
  return (await res.json()) as CodeMasterItem[]
}

export async function fetchProducts(): Promise<CodeMasterItem[]> {
  const url = `${baseUrl}/api/masters/products`
  const res = await fetch(url, { headers: getAuthHeaders() })
  if (!res.ok) throw new Error(`fetchProducts failed: ${res.status}`)
  return (await res.json()) as CodeMasterItem[]
}

export type OrderCreateRequest = {
  contractPartyCode: string
  deliveryPartyCode: string
  deliveryLocation: string
  dueDate: string
  forecastNumber: string
  lines: {
    productCode: string
    productName: string
    quantity: number
    unitPrice: number
    amount: number
  }[]
}

export type OrderCreateResponse = {
  orderId: number
  orderNumber: string
  message: string
}

export class ApiValidationError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiErrorResponse,
  ) {
    super(`Validation failed: ${status}`)
    this.name = 'ApiValidationError'
  }
}

export async function createOrder(body: OrderCreateRequest): Promise<OrderCreateResponse> {
  const url = `${baseUrl}/api/orders`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    if (res.status === 400) {
      try {
        const errorBody = (await res.json()) as ApiErrorResponse
        throw new ApiValidationError(res.status, errorBody)
      } catch (e) {
        if (e instanceof ApiValidationError) throw e
        throw new Error(`createOrder failed: ${res.status}`)
      }
    }
    throw new Error(`createOrder failed: ${res.status}`)
  }
  return (await res.json()) as OrderCreateResponse
}

/** GET /api/orders: 1要素＝明細1行（ヘッダ項目は同一受注で繰り返し） */
export type OrderListItem = {
  id: number
  orderNumber: string
  contractPartyCode: string
  contractPartyName: string | null
  deliveryPartyCode: string
  deliveryPartyName: string | null
  deliveryLocation: string | null
  dueDate: string | null
  forecastNumber: string | null
  totalAmount: number
  lineCount: number
  createdAt: string
  lineId: number
  lineNo: number
  productCode: string
  productName: string | null
  quantity: number
  unitPrice: number
  amount: number
}

export type OrderSearchParams = {
  orderNumber?: string
  contractPartyCode?: string
  dueDateFrom?: string
  dueDateTo?: string
}

export async function fetchOrders(params?: OrderSearchParams): Promise<OrderListItem[]> {
  const query = new URLSearchParams()
  if (params?.orderNumber) query.set('orderNumber', params.orderNumber)
  if (params?.contractPartyCode) query.set('contractPartyCode', params.contractPartyCode)
  if (params?.dueDateFrom) query.set('dueDateFrom', params.dueDateFrom)
  if (params?.dueDateTo) query.set('dueDateTo', params.dueDateTo)
  const qs = query.toString()
  const url = `${baseUrl}/api/orders${qs ? '?' + qs : ''}`
  const res = await fetch(url, { headers: getAuthHeaders() })
  if (!res.ok) throw new Error(`fetchOrders failed: ${res.status}`)
  return (await res.json()) as OrderListItem[]
}

export async function deleteOrder(id: number): Promise<void> {
  const url = `${baseUrl}/api/orders/${id}`
  const res = await fetch(url, { method: 'DELETE', headers: getAuthHeaders() })
  if (!res.ok) throw new Error(`deleteOrder failed: ${res.status}`)
}

export type OrderDetailResponse = {
  id: number
  orderNumber: string
  contractPartyCode: string
  deliveryPartyCode: string
  deliveryLocation: string | null
  dueDate: string | null
  forecastNumber: string | null
  lines: {
    lineId: number
    lineNo: number
    productCode: string
    productName: string | null
    quantity: number
    unitPrice: number
    amount: number
  }[]
}

export async function fetchOrder(id: number): Promise<OrderDetailResponse> {
  const url = `${baseUrl}/api/orders/${id}`
  const res = await fetch(url, { headers: getAuthHeaders() })
  if (res.status === 404) {
    throw new Error('fetchOrder:404')
  }
  if (!res.ok) throw new Error(`fetchOrder failed: ${res.status}`)
  return (await res.json()) as OrderDetailResponse
}

export type OrderUpdateRequest = OrderCreateRequest

export async function updateOrder(
  id: number,
  body: OrderUpdateRequest,
): Promise<OrderCreateResponse> {
  const url = `${baseUrl}/api/orders/${id}`
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    if (res.status === 400) {
      try {
        const errorBody = (await res.json()) as ApiErrorResponse
        throw new ApiValidationError(res.status, errorBody)
      } catch (e) {
        if (e instanceof ApiValidationError) throw e
        throw new Error(`updateOrder failed: ${res.status}`)
      }
    }
    throw new Error(`updateOrder failed: ${res.status}`)
  }
  return (await res.json()) as OrderCreateResponse
}
