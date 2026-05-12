import { http } from './request'

export type TaskStatus = 'open' | 'assigned' | 'in_progress' | 'done' | 'cancelled'

export type TaskListItem = {
  id: string | number
  pickup_address?: string
  delivery_address?: string
  task_type?: string
  fee_total?: number
  tip?: number
  distance?: number
  created_at?: string
  remark?: string
  item_image?: string
  image?: string
  images?: string[]
  status?: TaskStatus | string
}

export type TaskListQuery = {
  page: number
  pageSize: number
  sort?: string
  lat?: number
  lng?: number
  keyword?: string
  taskType?: string
  task_type?: string
  page_size?: number
}

export type TaskListResult = {
  list: TaskListItem[]
  total: number
}

export type TaskDetail = TaskListItem & Record<string, any>

export type PublishTaskPayload = {
  pickup_address: string
  delivery_address: string
  lat?: number
  lng?: number
  task_type: string
  remark?: string
  tip: number
  images?: string[]
  fee_total?: number
}

function normalizeListResponse(data: any): TaskListResult {
  if (Array.isArray(data)) {
    return { list: data as TaskListItem[], total: data.length }
  }

  const root = data?.data ?? data
  const list: TaskListItem[] =
    root?.list ?? root?.rows ?? root?.items ?? root?.records ?? root?.result ?? root?.tasks ?? []
  const total: number = Number(root?.total ?? root?.count ?? root?.pagination?.total ?? list.length)
  return { list, total }
}

export async function listTasks(query: TaskListQuery): Promise<TaskListResult> {
  const response = await http.get('/task/list', {
    params: {
      ...query,
      page_size: query.page_size ?? query.pageSize,
      task_type: query.task_type ?? query.taskType,
    },
  })
  return normalizeListResponse(response.data)
}

export async function nearbyTasks(query: TaskListQuery): Promise<TaskListResult> {
  const response = await http.get('/task/nearby', {
    params: {
      ...query,
      page_size: query.page_size ?? query.pageSize,
      task_type: query.task_type ?? query.taskType,
    },
  })
  return normalizeListResponse(response.data)
}

export async function acceptTask(taskId: string | number) {
  const encodedId = encodeURIComponent(String(taskId ?? '').trim())
  const response = await http.post(`/order/accept/${encodedId}`)
  return response.data
}

function normalizeUploadUrl(data: any): string {
  const root = data?.data ?? data
  if (typeof root === 'string') return root

  const direct =
    root?.url ??
    root?.path ??
    root?.src ??
    root?.location ??
    root?.data?.url ??
    root?.data?.path ??
    root?.result?.url

  if (typeof direct === 'string' && direct.trim().length > 0) return direct.trim()

  const urls = root?.urls ?? root?.files ?? root?.images
  if (Array.isArray(urls) && typeof urls[0] === 'string' && urls[0].trim().length > 0) {
    return urls[0].trim()
  }

  throw new Error('图片上传失败：未返回可用的图片地址')
}

export async function uploadTaskImage(file: File): Promise<string> {
  const form = new FormData()
  form.append('image', file)
  const response = await http.post('/upload/image', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return normalizeUploadUrl(response.data)
}

export async function publishTask(payload: PublishTaskPayload) {
  const response = await http.post('/task/publish', payload)
  return response.data
}

export async function getTaskDetail(taskId: string | number): Promise<TaskDetail> {
  const id = String(taskId ?? '').trim()
  if (!id) return {} as TaskDetail
  const response = await http.get(`/task/detail/${encodeURIComponent(id)}`)
  const root = response.data?.data ?? response.data
  return (root ?? {}) as TaskDetail
}

export async function cancelTask(taskId: string | number) {
  const id = String(taskId ?? '').trim()
  if (!id) return undefined
  const response = await http.delete(`/task/${encodeURIComponent(id)}/cancel`)
  return response.data
}
