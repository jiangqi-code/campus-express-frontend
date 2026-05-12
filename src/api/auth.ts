import { http } from './request'

export type LoginPayload = {
  account: string
  password: string
}

export async function loginApi(payload: LoginPayload) {
  const response = await http.post('/auth/login', payload)
  return response.data
}

export type RegisterPayload = {
  student_id: string
  phone: string
  password: string
  nickname: string
}

export async function registerApi(payload: RegisterPayload) {
  const response = await http.post('/auth/register', payload)
  return response.data
}
