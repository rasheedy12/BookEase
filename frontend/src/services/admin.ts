import { api } from './api'
import type { BookingStatus } from './catalog'
import type { UserRole } from './auth'

export type AdminSection = 'users' | 'vendors' | 'services' | 'bookings'

export interface AdminPagination {
  current_page: number
  last_page: number
  total: number
}

export interface AdminOverview {
  users_total: number
  users_active: number
  vendors_total: number
  services_published: number
  bookings_pending: number
}

export interface AdminUser {
  id: number
  name: string
  email: string
  role: UserRole
  is_active: boolean
  created_at: string
}

export interface AdminVendor {
  id: number
  business_name: string
  location: string | null
  description: string | null
  services_count: number
  user: Pick<AdminUser, 'id' | 'name' | 'email' | 'is_active'> | null
}

export interface AdminService {
  id: number
  name: string
  category: string
  price: string
  is_active: boolean
  business_name: string | null
}

export interface AdminBooking {
  id: number
  service_name: string
  business_name: string
  customer_name: string | null
  customer_email: string | null
  starts_at: string
  ends_at: string
  price: string
  status: BookingStatus
}

export type AdminRecord = AdminUser | AdminVendor | AdminService | AdminBooking

const endpoints: Record<AdminSection, string> = {
  users: '/api/v1/admin/users',
  vendors: '/api/v1/admin/vendors',
  services: '/api/v1/admin/services',
  bookings: '/api/v1/admin/bookings',
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const { data } = await api.get<{ data: AdminOverview }>('/api/v1/admin/overview')
  return data.data
}

export async function getAdminRecords<T extends AdminRecord>(
  section: AdminSection,
  page: number,
): Promise<{ data: T[]; meta: AdminPagination }> {
  const { data } = await api.get<{ data: T[]; meta: AdminPagination }>(
    `${endpoints[section]}?page=${page}`,
  )
  return data
}

export async function setAdminUserActive(userId: number, isActive: boolean): Promise<void> {
  await api.patch(`/api/v1/admin/users/${userId}/status`, { is_active: isActive })
}

export async function setAdminServiceVisible(serviceId: number, isActive: boolean): Promise<void> {
  await api.patch(`/api/v1/admin/services/${serviceId}/visibility`, { is_active: isActive })
}

export async function moderateAdminBooking(
  bookingId: number,
  status: 'cancelled' | 'rejected',
): Promise<void> {
  await api.patch(`/api/v1/admin/bookings/${bookingId}/status`, { status })
}
