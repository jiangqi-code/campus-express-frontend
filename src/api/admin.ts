import type { AxiosRequestConfig } from 'axios'
import { http, sleep } from './request'

export type AdminUser = {
  id: string
  name: string
  role: 'user' | 'runner' | 'admin'
  runnerStatus: 'none' | 'pending' | 'approved' | 'rejected'
}

export type AdminDashboardStatKey = 'todayOrders' | 'weekOrders' | 'totalOrders' | 'totalAmount' | 'activeUsers'

export type AdminDashboardTrendPoint = {
  date: string
  orders: number
}

export type AdminDashboardRunnerRankItem = {
  id: string
  name: string
  orders: number
  amount: number
}

export type AdminDashboard = {
  todayOrders: number
  weekOrders: number
  totalOrders: number
  totalAmount: number
  activeUsers: number
  trend7d: AdminDashboardTrendPoint[]
  runnerRank: AdminDashboardRunnerRankItem[]
}

export type AdminHeatmapRegion = {
  name: string
  value: number
}

const mockUsers: AdminUser[] = [
  { id: 'u_1', name: 'alice', role: 'user', runnerStatus: 'none' },
  { id: 'u_2', name: 'bob', role: 'runner', runnerStatus: 'approved' },
  { id: 'u_3', name: 'admin', role: 'admin', runnerStatus: 'none' },
]

export async function listUsers() {
  await sleep(250)
  return mockUsers
}

export type AdminUserStatus = 'active' | 'frozen' | 'disabled' | 'enabled' | string

export type AdminUserRow = {
  id: string
  studentNo: string
  phone: string
  nickname: string
  role: 'user' | 'runner' | 'admin' | string
  status: AdminUserStatus
  frozen: boolean
}

export type AdminUserListQuery = {
  page: number
  pageSize: number
  keyword?: string
  role?: string
  status?: string
  page_size?: number
}

export type AdminUserListResult = {
  list: AdminUserRow[]
  total: number
}

function normalizeBoolean(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase()
    if (s === 'true' || s === '1' || s === 'yes') return true
    if (s === 'false' || s === '0' || s === 'no') return false
  }
  return null
}

function normalizeAdminUser(raw: any): AdminUserRow {
  const r = raw?.data ?? raw
  const id = String(r?.id ?? r?.userId ?? r?.uid ?? r?._id ?? '').trim() || 'unknown'
  const studentNo = String(r?.studentNo ?? r?.student_no ?? r?.sid ?? r?.studentId ?? r?.student_id ?? '').trim()
  const phone = String(r?.phone ?? r?.mobile ?? r?.tel ?? r?.phoneNumber ?? '').trim()
  const nickname =
    String(r?.nickname ?? r?.nickName ?? r?.name ?? r?.realName ?? r?.displayName ?? '').trim() ||
    studentNo ||
    phone ||
    id
  const role = String(r?.role ?? r?.userRole ?? r?.type ?? 'user').trim() || 'user'

  const frozenDirect =
    normalizeBoolean(r?.frozen) ??
    normalizeBoolean(r?.isFrozen) ??
    normalizeBoolean(r?.freeze) ??
    normalizeBoolean(r?.is_freeze)

  const statusRaw = String(r?.status ?? r?.state ?? '').trim()
  const statusFromFrozen =
    frozenDirect === true || statusRaw.toLowerCase() === 'frozen' || statusRaw === '冻结' ? 'frozen' : 'active'

  const frozen = frozenDirect ?? statusFromFrozen === 'frozen'
  const status: AdminUserStatus = statusRaw || statusFromFrozen

  return { id, studentNo, phone, nickname, role, status, frozen }
}

function normalizeAdminUserListResponse(data: any): AdminUserListResult {
  if (Array.isArray(data)) {
    return { list: data.map((it) => normalizeAdminUser(it)), total: data.length }
  }

  const root = data?.data ?? data
  const listRaw =
    root?.list ??
    root?.rows ??
    root?.items ??
    root?.records ??
    root?.result ??
    root?.users ??
    root?.data ??
    []
  const arr = Array.isArray(listRaw) ? listRaw : []
  const total = Number(root?.total ?? root?.count ?? root?.pagination?.total ?? arr.length)
  return { list: arr.map((it) => normalizeAdminUser(it)), total: Number.isFinite(total) ? total : arr.length }
}

export async function listAdminUsers(query: AdminUserListQuery): Promise<AdminUserListResult> {
  const params: Record<string, any> = {
    page: query.page,
    pageSize: query.pageSize,
    page_size: query.page_size ?? query.pageSize,
    keyword: query.keyword,
    q: query.keyword,
    role: query.role,
    status: query.status,
  }
  Object.keys(params).forEach((k) => {
    const v = params[k]
    if (v === undefined || v === null || v === '') delete params[k]
  })

  const response = await http.get('/admin/users', { params })
  return normalizeAdminUserListResponse(response.data)
}

export async function freezeAdminUser(id: string, freeze: boolean) {
  const response = await http.put(`/admin/users/${id}/freeze`, { freeze, frozen: freeze, isFrozen: freeze })
  return response.data
}

export async function resetAdminUserPassword(id: string): Promise<{ password?: string; raw: any }> {
  const response = await http.put(`/admin/users/${id}/reset-password`)
  const root = response.data?.data ?? response.data
  const password =
    typeof root?.password === 'string'
      ? root.password
      : typeof root?.newPassword === 'string'
        ? root.newPassword
        : typeof root?.data?.password === 'string'
          ? root.data.password
          : undefined
  return { password, raw: response.data }
}

export async function deleteAdminUser(id: string) {
  const response = await http.delete(`/admin/users/${id}`)
  return response.data
}

export type AdminAuthStatus = 'pending' | 'approved' | 'rejected' | string

export type AdminAuthRow = {
  id: string
  applicantName: string
  studentId?: string
  phone?: string
  idCardNo?: string
  dormBuilding?: string
  applyReason?: string
  card_image_url?: string
  campusCardPhotoUrl: string
  appliedAt?: string
  status: AdminAuthStatus
  rejectReason?: string
}

export type AdminAuthListQuery = {
  page: number
  pageSize: number
  page_size?: number
}

export type AdminAuthListResult = {
  list: AdminAuthRow[]
  total: number
}

function pickListForAdminAuth(data: any): any[] {
  if (Array.isArray(data)) return data
  const root = data?.data ?? data
  const list =
    root?.list ??
    root?.rows ??
    root?.items ??
    root?.records ??
    root?.result ??
    root?.auths ??
    root?.authList ??
    root?.data ??
    []
  return Array.isArray(list) ? list : []
}

function normalizeAdminAuthRow(raw: any): AdminAuthRow {
  const r = raw?.data ?? raw
  const id = String(r?.id ?? r?.authId ?? r?.auth_id ?? r?.applyId ?? r?.apply_id ?? r?._id ?? '').trim() || 'unknown'

  const applicantName =
    String(
      r?.applicantName ??
      r?.applicant_name ??
      r?.name ??
      r?.realName ??
      r?.real_name ??
      r?.nickname ??
      r?.userName ??
      r?.user_name ??
      r?.user?.name ??
      r?.user?.realName ??
      r?.user?.nickname ??
      '',
    ).trim() || id

  const studentId = String(
    r?.student_id ??
      r?.studentId ??
      r?.sid ??
      r?.user?.student_id ??
      r?.user?.studentId ??
      r?.user?.sid ??
      '',
  ).trim()

  const phone = String(r?.phone ?? r?.mobile ?? r?.tel ?? r?.user?.phone ?? r?.user?.mobile ?? r?.user?.tel ?? '').trim()

  const idCardNo = String(
    r?.id_card_no ??
      r?.idCardNo ??
      r?.idcard ??
      r?.id_card ??
      r?.identity_no ??
      r?.identityNo ??
      r?.user?.id_card_no ??
      r?.user?.idCardNo ??
      '',
  ).trim()

  const dormBuilding = String(
    r?.dorm_building ?? r?.dormBuilding ?? r?.dorm ?? r?.dormitory ?? r?.dormitory_building ?? '',
  ).trim()

  const applyReason = String(
    r?.apply_reason ??
      r?.applyReason ??
      r?.reason ??
      r?.advantage ??
      r?.advantages ??
      r?.apply_advantage ??
      r?.applyAdvantages ??
      '',
  ).trim()

  const card_image_url = String(r?.card_image_url ?? r?.cardImageUrl ?? r?.cardImageURL ?? '').trim()

  const campusCardPhotoUrl = String(
    r?.campusCardPhotoUrl ??
    r?.campus_card_photo_url ??
    r?.campusCardPhoto ??
    r?.campus_card_photo ??
    r?.cardPhoto ??
    r?.card_photo ??
    r?.cardImage ??
    r?.card_image_url ??
    r?.card_image ??
    r?.photo ??
    r?.img ??
    r?.image ??
    r?.url ??
    '',
  ).trim()

  const appliedAt =
    r?.appliedAt !== undefined
      ? String(r.appliedAt)
      : r?.applied_at !== undefined
        ? String(r.applied_at)
        : r?.applyTime !== undefined
          ? String(r.applyTime)
          : r?.apply_time !== undefined
            ? String(r.apply_time)
            : r?.createdAt !== undefined
              ? String(r.createdAt)
              : r?.created_at !== undefined
                ? String(r.created_at)
                : r?.time !== undefined
                  ? String(r.time)
                  : undefined

  const status = String(r?.status ?? r?.state ?? r?.auditStatus ?? r?.audit_status ?? r?.resultStatus ?? r?.result_status ?? '').trim()

  const rejectReason = String(r?.rejectReason ?? r?.reject_reason ?? r?.reason ?? r?.auditReason ?? r?.audit_reason ?? '').trim()

  return {
    id,
    applicantName,
    studentId: studentId || undefined,
    phone: phone || undefined,
    idCardNo: idCardNo || undefined,
    dormBuilding: dormBuilding || undefined,
    applyReason: applyReason || undefined,
    card_image_url: card_image_url || undefined,
    campusCardPhotoUrl: campusCardPhotoUrl || card_image_url,
    appliedAt,
    status: (status || 'pending') as AdminAuthStatus,
    rejectReason: rejectReason || undefined,
  }
}

function normalizeAdminAuthListResponse(data: any): AdminAuthListResult {
  const list = pickListForAdminAuth(data).map((it) => normalizeAdminAuthRow(it))
  const root = data?.data ?? data
  const total = Number(root?.total ?? root?.count ?? root?.pagination?.total ?? list.length)
  return { list, total: Number.isFinite(total) ? total : list.length }
}

export async function listAdminAuth(query: AdminAuthListQuery): Promise<AdminAuthListResult> {
  const params: Record<string, any> = {
    page: query.page,
    pageSize: query.pageSize,
    page_size: query.page_size ?? query.pageSize,
    limit: query.pageSize,
    per_page: query.pageSize,
  }
  Object.keys(params).forEach((k) => {
    const v = params[k]
    if (v === undefined || v === null || v === '') delete params[k]
  })

  const response = await http.get('/admin/auth/list', { params })
  return normalizeAdminAuthListResponse(response.data)
}

export async function listAdminRunnerAuthAll(): Promise<AdminAuthRow[]> {
  const response = await http.get('/admin/auth/list')
  const res = normalizeAdminAuthListResponse(response.data)
  return res.list
}

export async function auditAdminAuth(id: string, audit: { approved: boolean; reason?: string }) {
  const approved = Boolean(audit.approved)
  const reason = String(audit.reason ?? '').trim()
  const payload: Record<string, any> = {
    approved,
    pass: approved,
    action: approved ? 'approve' : 'reject',
    status: approved ? 'approved' : 'rejected',
    auditStatus: approved ? 'approved' : 'rejected',
    reason: reason || undefined,
    rejectReason: approved ? undefined : reason || undefined,
    reject_reason: approved ? undefined : reason || undefined,
  }
  Object.keys(payload).forEach((k) => {
    const v = payload[k]
    if (v === undefined || v === null || v === '') delete payload[k]
  })
  const response = await http.post(`/admin/auth/${id}/audit`, payload)
  return response.data
}

export async function auditAdminRunnerAuth(authId: string, payload: { action: 'approve' | 'reject'; reason?: string }) {
  const action = payload.action
  const reason = String(payload.reason ?? '').trim()
  const body: Record<string, any> = { action }
  if (action === 'reject' && reason) body.reason = reason
  const response = await http.post(`/admin/auth/${authId}/audit`, body)
  return response.data
}

export type AdminOrderRow = {
  id: string
  pickupAddress: string
  deliveryAddress: string
  taskAddress: string
  userNickname: string
  runnerNickname: string
  amount: number
  status: string
  createdAt?: string
}

export type AdminOrderListQuery = {
  page: number
  pageSize: number
  status?: string
  startDate?: string
  endDate?: string
  startTime?: string
  endTime?: string
  page_size?: number
}

export type AdminOrderListResult = {
  list: AdminOrderRow[]
  total: number
}

function pickListForOrders(data: any): any[] {
  if (Array.isArray(data)) return data
  const root = data?.data ?? data
  const list =
    root?.list ??
    root?.rows ??
    root?.items ??
    root?.records ??
    root?.result ??
    root?.orders ??
    root?.data ??
    []
  return Array.isArray(list) ? list : []
}

function normalizeAdminOrder(raw: any): AdminOrderRow {
  const root = raw?.data ?? raw
  const id = String(root?.id ?? root?.order_id ?? root?.orderId ?? root?.sn ?? root?.no ?? '').trim() || 'unknown'

  const pickupAddress = String(
    root?.pickup_address ??
    root?.pickupAddress ??
    root?.task?.pickup_address ??
    root?.task?.pickupAddress ??
    root?.task?.pickup ??
    '',
  ).trim()
  const deliveryAddress = String(
    root?.delivery_address ??
    root?.deliveryAddress ??
    root?.task?.delivery_address ??
    root?.task?.deliveryAddress ??
    root?.task?.delivery ??
    '',
  ).trim()

  const taskAddress = pickupAddress && deliveryAddress ? `${pickupAddress} → ${deliveryAddress}` : pickupAddress || deliveryAddress || '-'

  const userNickname = String(
    root?.userNickname ??
    root?.user_nickname ??
    root?.publisherNickname ??
    root?.publisher_nickname ??
    root?.user?.nickname ??
    root?.publisher?.nickname ??
    root?.user?.name ??
    root?.publisher?.name ??
    '',
  ).trim()

  const runnerNickname = String(
    root?.runnerNickname ??
    root?.runner_nickname ??
    root?.takerNickname ??
    root?.taker_nickname ??
    root?.runner?.nickname ??
    root?.taker?.nickname ??
    root?.runner?.name ??
    root?.taker?.name ??
    '',
  ).trim()

  const explicitAmount =
    root?.amount ??
    root?.total_amount ??
    root?.totalAmount ??
    root?.pay_amount ??
    root?.payAmount ??
    root?.price ??
    root?.money ??
    undefined
  const feeTotal = normalizeNumber(root?.fee_total ?? root?.feeTotal ?? root?.task?.fee_total ?? root?.task?.feeTotal, 0)
  const tip = normalizeNumber(root?.tip ?? root?.task?.tip, 0)
  const amount = explicitAmount !== undefined ? normalizeNumber(explicitAmount, 0) : feeTotal + tip

  const status = String(root?.status ?? root?.order_status ?? root?.orderStatus ?? root?.state ?? '').trim() || 'unknown'
  const createdAt =
    root?.created_at !== undefined
      ? String(root.created_at)
      : root?.createdAt !== undefined
        ? String(root.createdAt)
        : root?.time !== undefined
          ? String(root.time)
          : undefined

  return {
    id,
    pickupAddress,
    deliveryAddress,
    taskAddress,
    userNickname: userNickname || '-',
    runnerNickname: runnerNickname || '-',
    amount,
    status,
    createdAt,
  }
}

function normalizeAdminOrderListResponse(data: any): AdminOrderListResult {
  const list = pickListForOrders(data).map((it) => normalizeAdminOrder(it))
  const root = data?.data ?? data
  const total = Number(root?.total ?? root?.count ?? root?.pagination?.total ?? list.length)
  return { list, total: Number.isFinite(total) ? total : list.length }
}

export async function listAdminOrders(
  query: AdminOrderListQuery,
  config?: Pick<AxiosRequestConfig, 'timeout' | 'signal'>,
): Promise<AdminOrderListResult> {
  const params: Record<string, any> = {
    page: query.page,
    pageSize: query.pageSize,
    page_size: query.page_size ?? query.pageSize,
    status: query.status,
    orderStatus: query.status,
    startDate: query.startDate,
    endDate: query.endDate,
    start_time: query.startTime,
    end_time: query.endTime,
    startTime: query.startTime,
    endTime: query.endTime,
    created_from: query.startTime ?? query.startDate,
    created_to: query.endTime ?? query.endDate,
  }
  Object.keys(params).forEach((k) => {
    const v = params[k]
    if (v === undefined || v === null || v === '') delete params[k]
  })

  const response = await http.get('/admin/orders', { params, ...config })
  return normalizeAdminOrderListResponse(response.data)
}

export async function cancelAdminOrder(id: string) {
  const response = await http.put(`/admin/order/${id}/cancel`)
  return response.data
}

export async function updateAdminOrderStatus(id: string, status: string) {
  const response = await http.put(`/admin/order/${id}/status`, { status, orderStatus: status, state: status })
  return response.data
}

export async function exportAdminOrdersCsv(query: Partial<AdminOrderListQuery>): Promise<Blob> {
  const params: Record<string, any> = {
    status: query.status,
    orderStatus: query.status,
    startDate: query.startDate,
    endDate: query.endDate,
    start_time: query.startTime,
    end_time: query.endTime,
    startTime: query.startTime,
    endTime: query.endTime,
    created_from: query.startTime ?? query.startDate,
    created_to: query.endTime ?? query.endDate,
  }
  Object.keys(params).forEach((k) => {
    const v = params[k]
    if (v === undefined || v === null || v === '') delete params[k]
  })

  const response = await http.get('/admin/orders/export', { params, responseType: 'blob' })
  return response.data instanceof Blob ? response.data : new Blob([response.data])
}

function normalizeNumber(v: unknown, fallback = 0) {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : fallback
}

function normalizeTrend7d(raw: any): AdminDashboardTrendPoint[] {
  const root = raw?.data ?? raw
  const list = root?.trend7d ?? root?.trend ?? root?.ordersTrend ?? root?.series ?? []
  const arr = Array.isArray(list) ? list : []
  return arr
    .map((p) => {
      const r = p?.data ?? p
      const date = String(r?.date ?? r?.day ?? r?.x ?? '').trim()
      const orders = normalizeNumber(r?.orders ?? r?.count ?? r?.y, 0)
      return date ? { date, orders } : null
    })
    .filter((x): x is AdminDashboardTrendPoint => Boolean(x))
}

function normalizeRunnerRank(raw: any): AdminDashboardRunnerRankItem[] {
  const root = raw?.data ?? raw
  const list = root?.runnerRank ?? root?.runners ?? root?.runnerTop ?? root?.rank ?? []
  const arr = Array.isArray(list) ? list : []
  return arr.map((it) => {
    const r = it?.data ?? it
    const id = String(r?.id ?? r?.runnerId ?? r?.uid ?? '').trim() || 'unknown'
    const name = String(r?.name ?? r?.runnerName ?? r?.nickname ?? id).trim() || id
    const orders = normalizeNumber(r?.orders ?? r?.count ?? r?.orderCount, 0)
    const amount = normalizeNumber(r?.amount ?? r?.totalAmount ?? r?.income ?? r?.revenue, 0)
    return { id, name, orders, amount }
  })
}

export async function getAdminDashboard(): Promise<AdminDashboard> {
  const response = await http.get('/admin/dashboard')
  const root = response.data?.data ?? response.data
  return {
    todayOrders: normalizeNumber(root?.todayOrders ?? root?.today_order ?? root?.today_count, 0),
    weekOrders: normalizeNumber(root?.weekOrders ?? root?.week_order ?? root?.week_count, 0),
    totalOrders: normalizeNumber(root?.totalOrders ?? root?.total_order ?? root?.total_count, 0),
    totalAmount: normalizeNumber(root?.totalAmount ?? root?.total_amount ?? root?.gmv ?? root?.turnover, 0),
    activeUsers: normalizeNumber(root?.activeUsers ?? root?.active_users ?? root?.activeUserCount, 0),
    trend7d: normalizeTrend7d(root),
    runnerRank: normalizeRunnerRank(root),
  }
}

export async function getAdminHeatmap(): Promise<AdminHeatmapRegion[]> {
  const response = await http.get('/admin/heatmap')
  const root = response.data?.data ?? response.data
  const list = root?.list ?? root?.regions ?? root?.data ?? root ?? []
  const arr = Array.isArray(list) ? list : []
  return arr
    .map((it) => {
      const r = it?.data ?? it
      const name = String(r?.name ?? r?.region ?? r?.area ?? '').trim()
      const value = normalizeNumber(r?.value ?? r?.count ?? r?.orders ?? r?.heat, 0)
      return name ? { name, value } : null
    })
    .filter((x): x is AdminHeatmapRegion => Boolean(x))
}

export type AdminReportStatus = 'pending' | 'processed' | 'rejected' | 'invalid' | string

export type AdminReportRow = {
  id: string
  orderId: string
  reporter: string
  accused: string
  reportType: string
  content: string
  status: AdminReportStatus
  createdAt?: string
  processedAt?: string
  processedBy?: string
  processResult?: string
  orderSnapshot?: any
}

export type AdminReportListQuery = {
  page: number
  pageSize: number
  status?: string
  page_size?: number
}

export type AdminReportListResult = {
  list: AdminReportRow[]
  total: number
}

function pickListForReports(data: any): any[] {
  if (Array.isArray(data)) return data
  const root = data?.data ?? data
  const list =
    root?.list ??
    root?.rows ??
    root?.items ??
    root?.records ??
    root?.result ??
    root?.reports ??
    root?.reportList ??
    root?.data ??
    []
  return Array.isArray(list) ? list : []
}

function normalizeAdminReport(raw: any): AdminReportRow {
  const r = raw?.data ?? raw
  const id = String(r?.id ?? r?.reportId ?? r?.report_id ?? r?._id ?? '').trim() || 'unknown'
  const orderId = String(r?.orderId ?? r?.order_id ?? r?.order?.id ?? r?.order?.orderId ?? r?.orderNo ?? r?.order_no ?? '')
    .trim()
    .replace(/^order[_-]?/i, '')
    .trim()

  const reporter = String(
    r?.reporter ??
    r?.reporterName ??
    r?.reporter_name ??
    r?.fromUserName ??
    r?.from_user_name ??
    r?.userNickname ??
    r?.user_nickname ??
    r?.user?.nickname ??
    r?.user?.name ??
    r?.fromUser?.nickname ??
    r?.fromUser?.name ??
    '',
  ).trim()

  const accused = String(
    r?.accused ??
    r?.accusedName ??
    r?.accused_name ??
    r?.toUserName ??
    r?.to_user_name ??
    r?.targetNickname ??
    r?.target_nickname ??
    r?.target?.nickname ??
    r?.target?.name ??
    r?.toUser?.nickname ??
    r?.toUser?.name ??
    '',
  ).trim()

  const reportType = String(
    r?.reportType ??
    r?.report_type ??
    r?.type ??
    r?.category ??
    r?.reasonType ??
    r?.reason_type ??
    r?.reason ??
    '',
  ).trim()

  const content = String(r?.content ?? r?.description ?? r?.desc ?? r?.remark ?? r?.message ?? '').trim()

  const status = String(r?.status ?? r?.state ?? r?.processStatus ?? r?.process_status ?? r?.result ?? '').trim() || 'pending'

  const createdAt =
    r?.createdAt !== undefined
      ? String(r.createdAt)
      : r?.created_at !== undefined
        ? String(r.created_at)
        : r?.submitTime !== undefined
          ? String(r.submitTime)
          : r?.submit_time !== undefined
            ? String(r.submit_time)
            : r?.time !== undefined
              ? String(r.time)
              : undefined

  const processedAt =
    r?.processedAt !== undefined
      ? String(r.processedAt)
      : r?.processed_at !== undefined
        ? String(r.processed_at)
        : r?.processTime !== undefined
          ? String(r.processTime)
          : r?.process_time !== undefined
            ? String(r.process_time)
            : undefined

  const processedBy = String(
    r?.processedBy ??
    r?.processed_by ??
    r?.processor ??
    r?.processorName ??
    r?.processor_name ??
    r?.adminName ??
    r?.admin_name ??
    r?.admin?.nickname ??
    r?.admin?.name ??
    '',
  ).trim()

  const processResult = String(
    r?.processResult ??
    r?.process_result ??
    r?.result ??
    r?.decision ??
    r?.action ??
    '',
  ).trim()

  const orderSnapshot = r?.orderSnapshot ?? r?.order_snapshot ?? r?.snapshot ?? r?.order ?? r?.orderInfo ?? undefined

  return {
    id,
    orderId: orderId || '-',
    reporter: reporter || '-',
    accused: accused || '-',
    reportType: reportType || '-',
    content: content || '-',
    status,
    createdAt,
    processedAt,
    processedBy: processedBy || undefined,
    processResult: processResult || undefined,
    orderSnapshot,
  }
}

function normalizeAdminReportListResponse(data: any): AdminReportListResult {
  const arr = pickListForReports(data)
  const root = data?.data ?? data
  const total = Number(root?.total ?? root?.count ?? root?.pagination?.total ?? arr.length)
  return { list: arr.map((it) => normalizeAdminReport(it)), total: Number.isFinite(total) ? total : arr.length }
}

export async function listAdminReports(query: AdminReportListQuery): Promise<AdminReportListResult> {
  const params: Record<string, any> = {
    page: query.page,
    pageSize: query.pageSize,
    page_size: query.page_size ?? query.pageSize,
    limit: query.pageSize,
    per_page: query.pageSize,
    status: query.status,
    state: query.status,
  }
  Object.keys(params).forEach((k) => {
    const v = params[k]
    if (v === undefined || v === null || v === '') delete params[k]
  })

  const response = await http.get('/admin/reports', { params })
  return normalizeAdminReportListResponse(response.data)
}

export async function getAdminReportDetail(id: string): Promise<AdminReportRow> {
  const rid = String(id ?? '').trim()
  const response = await http.get(`/admin/reports/${encodeURIComponent(rid)}`)
  const root = response.data?.data ?? response.data
  return normalizeAdminReport(root)
}

export async function processAdminReport(
  id: string,
  input: {
    action: 'approve' | 'reject' | 'invalid'
    punish?: 'ban' | 'deduct'
    banDays?: number
    deductPoints?: number
    note?: string
  },
): Promise<{ raw: any }> {
  const rid = String(id ?? '').trim()
  const action = input.action
  const punish = input.punish
  const banDays = Number(input.banDays ?? 0)
  const deductPoints = Number(input.deductPoints ?? 0)
  const note = String(input.note ?? '').trim()

  const approved = action === 'approve'
  const invalid = action === 'invalid'
  const status = invalid ? 'invalid' : approved ? 'processed' : 'rejected'

  const payload: Record<string, any> = {
    action,
    decision: action,
    approved,
    pass: approved,
    invalid,
    status,
    state: status,
    processStatus: status,
    process_status: status,
    processResult: action,
    process_result: action,
    punish: punish || undefined,
    punishment: punish || undefined,
    ban: punish === 'ban' ? true : undefined,
    banDays: punish === 'ban' && Number.isFinite(banDays) && banDays > 0 ? banDays : undefined,
    ban_days: punish === 'ban' && Number.isFinite(banDays) && banDays > 0 ? banDays : undefined,
    deductPoints: punish === 'deduct' && Number.isFinite(deductPoints) && deductPoints > 0 ? deductPoints : undefined,
    deduct_points: punish === 'deduct' && Number.isFinite(deductPoints) && deductPoints > 0 ? deductPoints : undefined,
    note: note || undefined,
    remark: note || undefined,
    comment: note || undefined,
    processNote: note || undefined,
    process_note: note || undefined,
  }
  Object.keys(payload).forEach((k) => {
    const v = payload[k]
    if (v === undefined || v === null || v === '' || (typeof v === 'number' && !Number.isFinite(v))) delete payload[k]
  })

  const response = await http.put(`/admin/reports/${encodeURIComponent(rid)}/process`, payload)
  return { raw: response.data }
}

export type AdminComplaintStatus = 'pending' | 'approved' | 'rejected' | string

export type AdminComplaintType =
  | 'ATTITUDE_BAD'
  | 'DAMAGED'
  | 'TIMEOUT'
  | 'FAKE_COMPLETION'
  | 'OTHER'
  | string

export type AdminComplaintRow = {
  id: string
  orderId: string
  complainant: string
  complainantRole?: 'user' | 'runner' | string
  respondent: string
  complaintType?: AdminComplaintType
  content: string
  evidenceUrls: string[]
  status: AdminComplaintStatus
  createdAt?: string
  processedAt?: string
  processNote?: string
  responsibility?: string
  refundAmount?: number
  compensationAmount?: number
  creditDeduct?: number
}

export type AdminComplaintListQuery = {
  page: number
  pageSize: number
  type?: string
  status?: string
  page_size?: number
}

export type AdminComplaintListResult = {
  list: AdminComplaintRow[]
  total: number
}

function pickListForComplaints(data: any): any[] {
  if (Array.isArray(data)) return data
  const root = data?.data ?? data
  const list =
    root?.list ??
    root?.rows ??
    root?.items ??
    root?.records ??
    root?.result ??
    root?.complaints ??
    root?.data ??
    []
  return Array.isArray(list) ? list : []
}

function normalizeAdminComplaint(raw: any): AdminComplaintRow {
  const r = raw?.data ?? raw
  const id =
    String(r?.id ?? r?.complaintId ?? r?.complaint_id ?? r?._id ?? '').trim() ||
    String(r?.orderId ?? r?.order_id ?? r?.order?.id ?? r?.order?.orderId ?? '').trim() ||
    'unknown'

  const orderId = String(r?.orderId ?? r?.order_id ?? r?.order?.id ?? r?.order?.orderId ?? r?.orderNo ?? r?.order_no ?? '')
    .trim()
    .replace(/^order[_-]?/i, '')
    .trim()

  const complainant = String(
    r?.complainant ??
    r?.complainantName ??
    r?.complainant_name ??
    r?.fromUserName ??
    r?.from_user_name ??
    r?.userNickname ??
    r?.user_nickname ??
    r?.user?.nickname ??
    r?.user?.name ??
    r?.fromUser?.nickname ??
    r?.fromUser?.name ??
    r?.reporter?.nickname ??
    r?.reporter?.name ??
    '',
  ).trim()

  const complainantRole = String(
    r?.complainantRole ??
    r?.complainant_role ??
    r?.fromRole ??
    r?.from_role ??
    r?.role ??
    r?.userRole ??
    '',
  ).trim()

  const respondent = String(
    r?.respondent ??
    r?.respondentName ??
    r?.respondent_name ??
    r?.toUserName ??
    r?.to_user_name ??
    r?.targetNickname ??
    r?.target_nickname ??
    r?.target?.nickname ??
    r?.target?.name ??
    r?.toUser?.nickname ??
    r?.toUser?.name ??
    r?.accused?.nickname ??
    r?.accused?.name ??
    '',
  ).trim()

  const complaintType = String(
    r?.complaintType ??
    r?.complaint_type ??
    r?.type ??
    r?.category ??
    r?.reasonType ??
    r?.reason_type ??
    '',
  ).trim()

  const content = String(
    r?.content ??
    r?.reason ??
    r?.complaintReason ??
    r?.complaint_reason ??
    r?.description ??
    r?.desc ??
    r?.remark ??
    r?.message ??
    '',
  ).trim()

  const evidenceRaw = r?.evidenceUrls ?? r?.evidence_urls ?? r?.evidence ?? r?.images ?? r?.imageUrls ?? r?.image_urls ?? r?.photos
  const evidenceUrls = Array.isArray(evidenceRaw)
    ? evidenceRaw
      .map((it) => String(it?.url ?? it?.src ?? it?.path ?? it).trim())
      .filter((x) => x)
    : typeof evidenceRaw === 'string'
      ? evidenceRaw
        .split(/[,\n\r]/g)
        .map((x) => x.trim())
        .filter((x) => x)
      : []

  const status = String(r?.status ?? r?.state ?? r?.processStatus ?? r?.process_status ?? r?.result ?? '').trim() || 'pending'

  const createdAt =
    r?.createdAt !== undefined
      ? String(r.createdAt)
      : r?.created_at !== undefined
        ? String(r.created_at)
        : r?.createTime !== undefined
          ? String(r.createTime)
          : r?.create_time !== undefined
            ? String(r.create_time)
            : undefined

  const processedAt =
    r?.processedAt !== undefined
      ? String(r.processedAt)
      : r?.processed_at !== undefined
        ? String(r.processed_at)
        : r?.processTime !== undefined
          ? String(r.processTime)
          : r?.process_time !== undefined
            ? String(r.process_time)
            : undefined

  const processNote = String(
    r?.processNote ??
    r?.process_note ??
    r?.note ??
    r?.remark ??
    r?.comment ??
    r?.resultNote ??
    r?.result_note ??
    '',
  ).trim()

  const responsibility = String(
    r?.responsibility ??
    r?.responsibleParty ??
    r?.responsible_party ??
    r?.liableParty ??
    r?.liable_party ??
    '',
  ).trim()

  const refundAmount = normalizeNumber(r?.refundAmount ?? r?.refund_amount ?? r?.refund ?? 0, 0)
  const compensationAmount = normalizeNumber(
    r?.compensationAmount ?? r?.compensation_amount ?? r?.compensation ?? r?.compensate ?? 0,
    0,
  )
  const creditDeduct = normalizeNumber(r?.creditDeduct ?? r?.credit_deduct ?? r?.deductCredit ?? r?.deduct_credit ?? 0, 0)

  return {
    id,
    orderId: orderId || '-',
    complainant: complainant || '-',
    complainantRole: complainantRole || undefined,
    respondent: respondent || '-',
    complaintType: complaintType || undefined,
    content: content || '-',
    evidenceUrls,
    status,
    createdAt,
    processedAt,
    processNote: processNote || undefined,
    responsibility: responsibility || undefined,
    refundAmount: refundAmount > 0 ? refundAmount : undefined,
    compensationAmount: compensationAmount > 0 ? compensationAmount : undefined,
    creditDeduct: creditDeduct > 0 ? creditDeduct : undefined,
  }
}

function normalizeAdminComplaintListResponse(data: any): AdminComplaintListResult {
  const arr = pickListForComplaints(data)
  const root = data?.data ?? data
  const total = Number(root?.total ?? root?.count ?? root?.pagination?.total ?? arr.length)
  return { list: arr.map((it) => normalizeAdminComplaint(it)), total: Number.isFinite(total) ? total : arr.length }
}

export async function listAdminComplaints(query: AdminComplaintListQuery): Promise<AdminComplaintListResult> {
  const params: Record<string, any> = {
    page: query.page,
    pageSize: query.pageSize,
    page_size: query.page_size ?? query.pageSize,
    limit: query.pageSize,
    per_page: query.pageSize,
    type: query.type,
    category: query.type,
    status: query.status,
    state: query.status,
  }
  Object.keys(params).forEach((k) => {
    const v = params[k]
    if (v === undefined || v === null || v === '') delete params[k]
  })

  const response = await http.get('/admin/complaints', { params })
  return normalizeAdminComplaintListResponse(response.data)
}

export async function processAdminComplaint(
  id: string,
  input: {
    decision: 'resolve' | 'reject' | 'approve'
    responsibility?: 'complainant' | 'respondent' | 'both' | 'none' | string
    refundAmount?: number
    compensationAmount?: number
    creditDeduct?: number
    note: string
    notify?: boolean
  },
): Promise<{ raw: any }> {
  const decision = input.decision
  const approved = decision === 'approve' || decision === 'resolve'
  const note = String(input.note ?? '').trim()
  const responsibility = String(input.responsibility ?? '').trim()
  const refundAmount = Number(input.refundAmount ?? 0)
  const compensationAmount = Number(input.compensationAmount ?? 0)
  const creditDeduct = Number(input.creditDeduct ?? 0)
  const notify = Boolean(input.notify ?? true)

  const status = decision === 'reject' ? 'rejected' : 'approved'
  const payload: Record<string, any> = {
    approved,
    pass: approved,
    action: decision,
    decision,
    result: status,
    status,
    state: status,
    processResult: status,
    processStatus: status,
    processed: true,
    responsibility: responsibility || undefined,
    responsibleParty: responsibility || undefined,
    responsible_party: responsibility || undefined,
    refundAmount: Number.isFinite(refundAmount) && refundAmount > 0 ? refundAmount : undefined,
    refund_amount: Number.isFinite(refundAmount) && refundAmount > 0 ? refundAmount : undefined,
    compensationAmount: Number.isFinite(compensationAmount) && compensationAmount > 0 ? compensationAmount : undefined,
    compensation_amount: Number.isFinite(compensationAmount) && compensationAmount > 0 ? compensationAmount : undefined,
    creditDeduct: Number.isFinite(creditDeduct) && creditDeduct > 0 ? creditDeduct : undefined,
    credit_deduct: Number.isFinite(creditDeduct) && creditDeduct > 0 ? creditDeduct : undefined,
    notify,
    notifyBoth: notify,
    notify_both: notify,
    note: note || undefined,
    remark: note || undefined,
    comment: note || undefined,
    processNote: note || undefined,
    process_note: note || undefined,
    description: note || undefined,
  }
  Object.keys(payload).forEach((k) => {
    const v = payload[k]
    if (v === undefined || v === null || v === '') delete payload[k]
  })

  const response = await http.put(`/admin/complaints/${id}/process`, payload)
  return { raw: response.data }
}

export type AdminConfigResponse = Record<string, any> | Array<{ key?: string; name?: string; value?: any }>

export async function getAdminConfig(): Promise<AdminConfigResponse> {
  const response = await http.get('/admin/config')
  return (response.data?.data ?? response.data) as AdminConfigResponse
}

export async function updateAdminConfig(key: string, value: any): Promise<{ raw: any }> {
  const k = encodeURIComponent(String(key))
  // 将 value 转为字符串
  const response = await http.put(`/admin/config/${k}`, { value: String(value) })
  return { raw: response.data }
}

function pickSensitiveWordList(data: any): any[] {
  const root = data?.data ?? data
  const list =
    root?.list ??
    root?.rows ??
    root?.items ??
    root?.records ??
    root?.result ??
    root?.words ??
    root?.sensitiveWords ??
    root?.data ??
    root ??
    []
  return Array.isArray(list) ? list : []
}

function normalizeSensitiveWord(it: any): string {
  if (typeof it === 'string') return it.trim()
  if (typeof it === 'number') return String(it)
  const w = String(it?.word ?? it?.text ?? it?.value ?? it?.name ?? it?.content ?? '').trim()
  return w
}

export async function listSensitiveWords(): Promise<string[]> {
  const response = await http.get('/admin/sensitive-words')
  const arr = pickSensitiveWordList(response.data)
  const words = arr.map((it) => normalizeSensitiveWord(it)).filter((x) => x)
  return Array.from(new Set(words))
}

export async function addSensitiveWord(word: string): Promise<{ raw: any }> {
  const w = String(word ?? '').trim()
  const payload: Record<string, any> = {
    word: w,
    value: w,
    text: w,
    name: w,
    words: [w],
  }
  Object.keys(payload).forEach((k) => {
    const v = payload[k]
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) delete payload[k]
  })
  const response = await http.post('/admin/sensitive-words', payload)
  return { raw: response.data }
}
export async function deleteSensitiveWord(word: string): Promise<{ raw: any }> {
  const w = String(word ?? '').trim()
  // 路径参数：把敏感词本身作为 id 传给后端
  const response = await http.delete(`/admin/sensitive-words/${encodeURIComponent(w)}`)
  return { raw: response.data }
}
