import { http } from './request'

export type Coupon = { id:string; name:string; code:string; type:'DISCOUNT'|'CASH'; value:number|string; min_order_amount:number|string; max_discount:number|string; usage_limit:number; total_limit:number; received_count:number; used_count:number; start_date:string; end_date:string; status:'ACTIVE'|'EXPIRED'|'DISABLED'; can_receive?:boolean }
export type UserCoupon = { id:string; status:'UNUSED'|'USED'|'EXPIRED'; received_at:string; created_at?:string; used_at?:string; expired_at:string; claimed_at?:string|null; coupon:Coupon }
export type CouponEvent = { id:string; coupon_id:string; trigger_type:'NEW_USER'|'BIRTHDAY'|'HOLIDAY'; start_date?:string; end_date?:string; is_active:boolean; coupon:Coupon }
const data = (response:any) => response.data?.data ?? response.data

export const getAvailableCoupons = async (orderAmount?:number) => data(await http.get('/coupons/available',{params:{orderAmount}})) as UserCoupon[]
export const getMyCoupons = async (params:Record<string,unknown>) => data(await http.get('/coupons/my',{ params })) as {list:UserCoupon[];total:number}
export const receiveCoupon = async (id:string) => data(await http.post(`/coupons/receive/${encodeURIComponent(id)}`))
export const applyCoupon = async (payload:Record<string,unknown>) => data(await http.post('/coupons/apply',payload))
export const getAdminCoupons = async (params:Record<string,unknown>) => data(await http.get('/admin/coupons',{params}))
export const createCoupon = async (payload:Record<string,unknown>) => data(await http.post('/admin/coupons',payload))
export const updateCoupon = async (id:string,payload:Record<string,unknown>) => data(await http.put(`/admin/coupons/${id}`,payload))
export const deleteCoupon = async (id:string) => data(await http.delete(`/admin/coupons/${id}`))
export const getCouponUsage = async (id:string) => data(await http.get(`/admin/coupons/usage/${id}`))
export const giveCoupon = async (payload:{userId:number;couponId:string}) => data(await http.post('/admin/coupons/give',payload))
export const checkCouponNotification = async () => data(await http.get('/coupons/check-notification')) as UserCoupon[]
export const claimCoupon = async (userCouponId:string) => data(await http.post('/coupons/claim',{userCouponId}))
export const checkWelcomeCoupons = async () => data(await http.post('/coupons/welcome',{})) as {issued:UserCoupon[];coupons:UserCoupon[]}
export const getUsableCoupons = async (amount?:number) => data(await http.get('/coupons/usable',{params:{amount}})) as UserCoupon[]
export const getCouponEvents = async (params:Record<string,unknown>) => data(await http.get('/admin/coupons/events',{params}))
export const createCouponEvent = async (payload:Record<string,unknown>) => data(await http.post('/admin/coupons/events',payload))
export const updateCouponEvent = async (id:string,payload:Record<string,unknown>) => data(await http.put(`/admin/coupons/events/${id}`,payload))
export const deleteCouponEvent = async (id:string) => data(await http.delete(`/admin/coupons/events/${id}`))
export const getCouponRecords = async (params:Record<string,unknown>) => data(await http.get('/admin/coupons/records',{params}))
export const triggerCouponDistribution = async (date?:string) => data(await http.post('/admin/coupons/trigger',{date}))
