import type { CodeMasterItem } from '@/types/master'

const baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''

export function getApiBaseUrl(): string {
  return baseUrl
}

function authHeader(): HeadersInit {
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
  const res = await fetch(url, { headers: authHeader() })
  if (!res.ok) {
    throw new Error(`projects failed: ${res.status}`)
  }
  return res.json()
}

export async function fetchParties(): Promise<CodeMasterItem[]> {
  const url = `${baseUrl}/api/masters/parties`
  const res = await fetch(url, { headers: authHeader() })
  if (!res.ok) throw new Error(`fetchParties failed: ${res.status}`)
  return (await res.json()) as CodeMasterItem[]
}

export async function fetchProducts(): Promise<CodeMasterItem[]> {
  const url = `${baseUrl}/api/masters/products`
  const res = await fetch(url, { headers: authHeader() })
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
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`createOrder failed: ${res.status}`)
  return (await res.json()) as OrderCreateResponse
}
