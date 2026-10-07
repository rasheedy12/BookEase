import { api } from './api'

export interface VendorProfile {
  id: number
  business_name: string
  description: string | null
  phone: string | null
  location: string | null
  timezone: string
}

export interface VendorOpeningDay {
  day_of_week: number
  is_closed: boolean
  opens_at: string | null
  closes_at: string | null
}

export interface VendorAvailability {
  timezone: string
  is_configured: boolean
  days: VendorOpeningDay[]
}

export const weekDays = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

export interface ServiceListing {
  id: number
  name: string
  description: string
  category: string
  duration_minutes: number
  price: string
  is_active: boolean
  vendor_profile?: {
    id: number
    business_name: string
    location: string | null
    timezone: string
    opening_hours: VendorOpeningDay[]
  }
}

export interface ServiceInput {
  name: string
  description: string
  category: string
  duration_minutes: number
  price: number
  is_active?: boolean
}

export type BookingStatus = 'pending' | 'confirmed' | 'rejected' | 'cancelled' | 'completed'

export interface Booking {
  id: number
  service_id: number | null
  service_name: string
  business_name: string
  customer_name: string | null
  starts_at: string
  ends_at: string
  price: string
  status: BookingStatus
  notes: string | null
}

export type VendorProfileInput = Omit<VendorProfile, 'id' | 'timezone'>

export async function getPublicServices(): Promise<ServiceListing[]> {
  const { data } = await api.get<{ data: ServiceListing[] }>('/api/v1/services')
  return data.data
}

export async function getVendorProfile(): Promise<VendorProfile | null> {
  const { data } = await api.get<{ data: VendorProfile | null }>('/api/v1/vendor/profile')
  return data.data
}

export async function saveVendorProfile(input: VendorProfileInput): Promise<VendorProfile> {
  const { data } = await api.put<{ data: VendorProfile }>('/api/v1/vendor/profile', input)
  return data.data
}

export async function getVendorAvailability(): Promise<VendorAvailability> {
  const { data } = await api.get<{ data: VendorAvailability }>('/api/v1/vendor/availability')
  return data.data
}

export async function saveVendorAvailability(input: VendorAvailability): Promise<VendorAvailability> {
  const { timezone, days } = input
  const { data } = await api.put<{ data: VendorAvailability }>('/api/v1/vendor/availability', {
    timezone,
    days,
  })
  return data.data
}

export async function getVendorServices(): Promise<ServiceListing[]> {
  const { data } = await api.get<{ data: ServiceListing[] }>('/api/v1/vendor/services')
  return data.data
}

export async function saveService(input: ServiceInput, serviceId?: number): Promise<ServiceListing> {
  const path = serviceId
    ? `/api/v1/vendor/services/${serviceId}`
    : '/api/v1/vendor/services'
  const { data } = serviceId
    ? await api.put<{ data: ServiceListing }>(path, input)
    : await api.post<{ data: ServiceListing }>(path, input)
  return data.data
}

export async function deleteService(serviceId: number): Promise<void> {
  await api.delete(`/api/v1/vendor/services/${serviceId}`)
}

export async function getCustomerBookings(): Promise<Booking[]> {
  const { data } = await api.get<{ data: Booking[] }>('/api/v1/customer/bookings')
  return data.data
}

export async function getVendorBookings(): Promise<Booking[]> {
  const { data } = await api.get<{ data: Booking[] }>('/api/v1/vendor/bookings')
  return data.data
}

export async function createBooking(input: {
  service_id: number
  starts_at: string
  notes: string
}): Promise<Booking> {
  const { data } = await api.post<{ data: Booking }>('/api/v1/customer/bookings', input)
  return data.data
}

export async function updateBookingStatus(
  bookingId: number,
  status: BookingStatus,
  audience: 'customer' | 'vendor',
): Promise<Booking> {
  const { data } = await api.patch<{ data: Booking }>(
    `/api/v1/${audience}/bookings/${bookingId}/status`,
    { status },
  )
  return data.data
}
