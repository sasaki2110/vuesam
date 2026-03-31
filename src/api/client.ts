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

export async function createOrder(body: OrderCreateRequest): Promise<OrderCreateResponse> {
  const url = `${baseUrl}/api/orders`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`createOrder failed: ${res.status}`)
  return (await res.json()) as OrderCreateResponse
}

export type OrderListItem = {
  id: number
  orderNumber: string
  contractPartyCode: string
  contractPartyName: string
  deliveryPartyCode: string
  deliveryPartyName: string
  deliveryLocation: string
  dueDate: string
  forecastNumber: string
  totalAmount: number
  lineCount: number
  createdAt: string
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
