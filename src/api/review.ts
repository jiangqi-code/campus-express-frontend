import { http } from './request'

export type ReviewListQuery = {
  page?: number
  pageSize?: number
  rating?: number
}

export type ReviewListItem = {
  id: string
  rating: number
  content: string
  tags: string[]
  orderId: string
  createdAt: string
  reviewerNickname: string
  revieweeNickname: string
  images: string[]
}

export type ReviewListResult = {
  items: ReviewListItem[]
  total: number
  page: number
  pageSize: number
}

function toNumber(value: unknown, fallback = 0) {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').trim())
  return Number.isFinite(n) ? n : fallback
}

function toString(value: unknown) {
  return String(value ?? '').trim()
}

function toStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => toString(item))
      .filter(Boolean)
  }

  if (typeof value === 'string') {
    return value
      .split(/[，,、|]/)
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return []
}

function normalizeReviewItem(raw: any): ReviewListItem {
  const root = raw?.data ?? raw ?? {}

  const reviewerNickname = toString(
    root?.reviewer_nickname ??
    root?.reviewerNickname ??
    root?.from_nickname ??
    root?.fromNickname ??
    root?.from_user_nickname ??
    root?.fromUserNickname ??
    root?.reviewer?.nickname ??
    root?.fromUser?.nickname ??
    root?.user?.nickname,
  )

  const revieweeNickname = toString(
    root?.reviewee_nickname ??
    root?.revieweeNickname ??
    root?.to_nickname ??
    root?.toNickname ??
    root?.to_user_nickname ??
    root?.toUserNickname ??
    root?.reviewee?.nickname ??
    root?.toUser?.nickname ??
    root?.targetUser?.nickname,
  )

  const tags = toStringArray(root?.tags ?? root?.labels ?? root?.tag_list ?? root?.tagList)
  const images = toStringArray(root?.images ?? root?.image_urls ?? root?.imageUrls ?? root?.photos)

  return {
    id: toString(root?.id ?? root?.review_id ?? root?.reviewId ?? root?.uuid) || crypto.randomUUID(),
    rating: Math.min(5, Math.max(0, toNumber(root?.rating ?? root?.score ?? root?.stars, 0))),
    content: toString(root?.content ?? root?.comment ?? root?.text ?? root?.description),
    tags,
    orderId: toString(root?.order_id ?? root?.orderId ?? root?.order?.id ?? root?.order?.order_id ?? root?.order_no ?? root?.orderNo),
    createdAt: toString(root?.created_at ?? root?.createdAt ?? root?.review_time ?? root?.reviewTime ?? root?.time),
    reviewerNickname,
    revieweeNickname,
    images,
  }
}

function normalizeReviewListResponse(data: any, page = 1, pageSize = 10): ReviewListResult {
  const root = data?.data ?? data ?? {}
  const list =
    root?.items ?? root?.list ?? root?.rows ?? root?.records ?? root?.result ?? root?.reviews ?? []

  const items = Array.isArray(list) ? list.map((item) => normalizeReviewItem(item)) : []
  const total = toNumber(root?.total ?? root?.count ?? root?.pagination?.total ?? items.length, items.length)
  const currentPage = toNumber(root?.page ?? root?.current ?? root?.pagination?.page ?? page, page)
  const currentPageSize = toNumber(
    root?.pageSize ?? root?.page_size ?? root?.pagination?.pageSize ?? root?.pagination?.page_size ?? pageSize,
    pageSize,
  )

  return {
    items,
    total,
    page: currentPage,
    pageSize: currentPageSize,
  }
}

async function getReviewList(url: string, query: ReviewListQuery = {}) {
  const page = query.page ?? 1
  const pageSize = query.pageSize ?? 10
  const params: Record<string, number> = { page, pageSize }

  if (query.rating) params.rating = query.rating

  const response = await http.get(url, { params })
  return normalizeReviewListResponse(response.data, page, pageSize)
}

export function getReceivedReviews(query: ReviewListQuery = {}) {
  return getReviewList('/reviews/received', query)
}

export function getGivenReviews(query: ReviewListQuery = {}) {
  return getReviewList('/reviews/given', query)
}
