import { api } from './api'

export type UserRole = 'admin' | 'vendor' | 'customer'

export interface AuthUser {
  id: number
  name: string
  email: string
  role: UserRole
}

interface UserResponse {
  data: {
    user: AuthUser
  }
}

export interface RegistrationData {
  name: string
  email: string
  password: string
  password_confirmation: string
  role: Exclude<UserRole, 'admin'>
}

export async function getCurrentUser(): Promise<AuthUser> {
  const { data } = await api.get<UserResponse>('/api/v1/auth/me')
  return data.data.user
}

export async function login(email: string, password: string): Promise<AuthUser> {
  await api.get('/sanctum/csrf-cookie')
  const { data } = await api.post<UserResponse>('/api/v1/auth/login', { email, password })
  return data.data.user
}

export async function register(input: RegistrationData): Promise<AuthUser> {
  await api.get('/sanctum/csrf-cookie')
  const { data } = await api.post<UserResponse>('/api/v1/auth/register', input)
  return data.data.user
}

export async function logout(): Promise<void> {
  await api.get('/sanctum/csrf-cookie')
  await api.post('/api/v1/auth/logout')
}
