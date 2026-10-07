import { api } from './api'

export interface VendorProfile {
  id: number
  business_name: string
  description: string | null
  phone: string | null
  location: string | null
}

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

export type VendorProfileInput = Omit<VendorProfile, 'id'>

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
