import { http } from './request'

export type OrderListItem = {
  id: string
  taskId: string
  pickupAddress: string
  deliveryAddress: string
  amount: number
  status: string
  publisherId?: string
  takerId?: string
  createdAt?: string
}

export type OrderListQuery = {
  type?: 'published' | 'taken'
  publisher_id?: string
  taker_id?: string
  status?: string
  page?: number
  pageSize?: number
  page_size?: number
}

type OrderListResult = {
  list: OrderListItem[]
  total: number
}

function normalizeNumber(v: unknown, fallback = 0) {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : fallback
}

function pickList(data: any): unknown[] {
  if (Array.isArray(data)) return data
  const root = data?.data ?? data
  const list = root?.list ?? root?.rows ?? root?.items ?? root?.records ?? root?.result ?? root?.orders ?? []
  return Array.isArray(list) ? list : []
}

function mapOrder(raw: any): OrderListItem {
  const root = raw?.data ?? raw
  const id = String(root?.id ?? root?.order_id ?? root?.orderId ?? root?.sn ?? root?.no ?? '').trim()
  const taskId = String(root?.task_id ?? root?.taskId ?? root?.task?.id ?? id).trim()

  const pickupAddress = String(
    root?.pickup_address ?? root?.pickupAddress ?? root?.task?.pickup_address ?? root?.task?.pickupAddress ?? '',
  ).trim()
  const deliveryAddress = String(
    root?.delivery_address ??
    root?.deliveryAddress ??
    root?.task?.delivery_address ??
    root?.task?.deliveryAddress ??
    '',
  ).trim()

  const explicitAmount =
    root?.amount ?? root?.total_amount ?? root?.totalAmount ?? root?.pay_amount ?? root?.payAmount ?? undefined
  const feeTotal = normalizeNumber(root?.fee_total ?? root?.feeTotal ?? root?.task?.fee_total ?? root?.task?.feeTotal, 0)
  const tip = normalizeNumber(root?.tip ?? root?.task?.tip, 0)
  const amount = explicitAmount !== undefined ? normalizeNumber(explicitAmount, 0) : feeTotal + tip

  const status = String(root?.status ?? root?.order_status ?? root?.orderStatus ?? '').trim() || 'unknown'
  const createdAt = root?.created_at ? String(root.created_at) : root?.createdAt ? String(root.createdAt) : undefined
  const publisherId =
    root?.publisher_id !== undefined
      ? String(root.publisher_id)
      : root?.publisherId !== undefined
        ? String(root.publisherId)
        : undefined
  const takerId =
    root?.taker_id !== undefined ? String(root.taker_id) : root?.takerId !== undefined ? String(root.takerId) : undefined

  return { id: id || taskId || 'unknown', taskId: taskId || id || 'unknown', pickupAddress, deliveryAddress, amount, status, publisherId, takerId, createdAt }
}

function normalizeListResponse(data: any): OrderListResult {
  const list = pickList(data).map(mapOrder)
  const root = data?.data ?? data
  const total = Number(root?.total ?? root?.count ?? root?.pagination?.total ?? list.length)
  return { list, total: Number.isFinite(total) ? total : list.length }
}

export async function listOrders(query: OrderListQuery = {}): Promise<OrderListItem[]> {
  const params: Record<string, any> = {
    ...query,
    page_size: query.page_size ?? query.pageSize,
  }
  Object.keys(params).forEach((k) => {
    const v = params[k]
    if (v === undefined || v === null || v === '') delete params[k]
  })

  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (Array.isArray(v)) {
      v.forEach((item) => searchParams.append(k, String(item)))
      return
    }
    searchParams.set(k, String(v))
  })

  const qs = searchParams.toString()
  const url = qs ? `/order/list?${qs}` : '/order/list'
  const response = await http.get(url)
  return normalizeListResponse(response.data).list
}

export async function listMyOrders(): Promise<OrderListItem[]> {
  return listOrders()
}

export const acceptTask = (taskId: string) => http.post(`/order/accept/${encodeURIComponent(taskId)}`)

export const pickupOrder = (orderId: string, photoUrl?: string) => {
  const url = String(photoUrl ?? '').trim()
  return http.put(`/order/pickup/${encodeURIComponent(orderId)}`, url ? { pickup_photo_url: url } : {})
}

export const deliverOrder = (orderId: string) =>
  http.put(`/order/deliver/${encodeURIComponent(orderId)}`)

export const completeOrder = (orderId: string) =>
  http.put(`/order/complete/${encodeURIComponent(orderId)}`)

export const cancelOrder = (orderId: string) =>
  http.put(`/order/${encodeURIComponent(orderId)}/cancel`)

export const confirmOrder = (orderId: string) =>
  http.post(`/order/confirm/${encodeURIComponent(orderId)}`)

export const urgeOrder = (orderId: string) =>
  http.post(`/order/${encodeURIComponent(orderId)}/urge`)

export type OrderReviewPayload = {
  rating: number
  tags: string[]
  content: string
  images: string[]
  anonymous: boolean
}

export async function submitOrderReview(id: string, payload: OrderReviewPayload) {
  const response = await http.post(`/order/${encodeURIComponent(id)}/review`, payload)
  return response.data
}

export const reviewOrder = submitOrderReview


export async function saveDeliveryPhoto(id: string, deliveryPhotoUrl: string) {
  const url = String(deliveryPhotoUrl ?? '').trim()
  const response = await http.put(`/order/${encodeURIComponent(id)}/delivery-photo`, { delivery_photo_url: url })
  return response.data
}


export type OrderTrack = {
  pickup_photo_url?: string
  delivery_photo_url?: string
  pickup_time?: string
  delivery_time?: string
  eta_minutes?: number
  current_location?: any
}

export type OrderDetail = Record<string, any>

export async function getOrderDetail(orderId: string): Promise<OrderDetail> {
  const id = String(orderId ?? '').trim()
  if (!id) return {}
  const response = await http.get(`/order/${encodeURIComponent(id)}`)
  const root = response.data?.data ?? response.data
  return (root ?? {}) as OrderDetail
}

export async function getOrderTrack(orderId: string): Promise<OrderTrack> {
  const id = String(orderId ?? '').trim()
  if (!id) return {}
  const response = await http.get(`/order/${encodeURIComponent(id)}/track`)
  const root = response.data?.data ?? response.data
  return (root ?? {}) as OrderTrack
}
