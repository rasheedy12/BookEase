import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { getApiErrorMessage } from '../services/apiError'
import {
  deleteService,
  getVendorProfile,
  getVendorServices,
  saveService,
  saveVendorProfile,
} from '../services/catalog'
import type { ServiceInput, ServiceListing, VendorProfileInput } from '../services/catalog'

const emptyProfile: VendorProfileInput = {
  business_name: '',
  description: '',
  phone: '',
  location: '',
}

const emptyService: ServiceInput = {
  name: '',
  description: '',
  category: '',
  duration_minutes: 60,
  price: 0,
  is_active: true,
}

export function VendorDashboardPage() {
  const { error: authError, logout } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<VendorProfileInput>(emptyProfile)
  const [services, setServices] = useState<ServiceListing[]>([])
  const [serviceForm, setServiceForm] = useState<ServiceInput>(emptyService)
  const [editingServiceId, setEditingServiceId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function reloadVendorData() {
    const [savedProfile, savedServices] = await Promise.all([
      getVendorProfile(),
      getVendorServices(),
    ])
    if (savedProfile) {
      setProfile({
        business_name: savedProfile.business_name,
        description: savedProfile.description ?? '',
        phone: savedProfile.phone ?? '',
        location: savedProfile.location ?? '',
      })
    }
    setServices(savedServices)
  }

  useEffect(() => {
    let active = true
    Promise.all([getVendorProfile(), getVendorServices()])
      .then(([savedProfile, savedServices]) => {
        if (!active) return
        if (savedProfile) {
          setProfile({
            business_name: savedProfile.business_name,
            description: savedProfile.description ?? '',
            phone: savedProfile.phone ?? '',
            location: savedProfile.location ?? '',
          })
        }
        setServices(savedServices)
      })
      .catch((requestError: unknown) => {
        if (active) setError(getApiErrorMessage(requestError))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setNotice(null)
    try {
      const savedProfile = await saveVendorProfile(profile)
      setProfile({
        business_name: savedProfile.business_name,
        description: savedProfile.description ?? '',
        phone: savedProfile.phone ?? '',
        location: savedProfile.location ?? '',
      })
      setNotice('Business profile saved.')
    } catch (requestError: unknown) {
      setError(getApiErrorMessage(requestError))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleServiceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setNotice(null)
    try {
      await saveService(serviceForm, editingServiceId ?? undefined)
      await reloadVendorData()
      setServiceForm(emptyService)
      setEditingServiceId(null)
      setNotice('Service saved.')
    } catch (requestError: unknown) {
      setError(getApiErrorMessage(requestError))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(serviceId: number) {
    setSubmitting(true)
    setError(null)
    setNotice(null)
    try {
      await deleteService(serviceId)
      setServices((current) => current.filter((service) => service.id !== serviceId))
      setNotice('Service deleted.')
      if (editingServiceId === serviceId) {
        setEditingServiceId(null)
        setServiceForm(emptyService)
      }
    } catch (requestError: unknown) {
      setError(getApiErrorMessage(requestError))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleLogout() {
    setSubmitting(true)
    const loggedOut = await logout()
    setSubmitting(false)
    if (loggedOut) navigate('/', { replace: true })
  }

  function editService(service: ServiceListing) {
    setEditingServiceId(service.id)
    setServiceForm({
      name: service.name,
      description: service.description,
      category: service.category,
      duration_minutes: service.duration_minutes,
      price: Number(service.price),
      is_active: service.is_active,
    })
    setNotice(null)
  }

  return (
    <main className="page">
      <section className="welcome-card catalog-card" aria-labelledby="vendor-title">
        <Link className="brand-link" to="/">BookEase</Link>
        <p className="eyebrow">BOOKEASE · VENDOR WORKSPACE</p>
        <h1 id="vendor-title">Your business.</h1>
        <p className="intro">Manage your public business profile and the services customers can discover.</p>
        <p className="dashboard-links"><Link to="/services">View service directory</Link></p>
        <button className="secondary-button signout-button" type="button" onClick={() => void handleLogout()} disabled={submitting}>
          Sign out
        </button>
        {loading && <p role="status">Loading your workspace…</p>}
        {(error || authError) && <p className="form-error" role="alert">{error ?? authError}</p>}
        {notice && <p className="success-message" role="status">{notice}</p>}

        <form className="catalog-form" onSubmit={handleProfileSubmit}>
          <h2>Business profile</h2>
          <label htmlFor="business-name">Business name</label>
          <input id="business-name" maxLength={255} required value={profile.business_name}
            onChange={(event) => setProfile({ ...profile, business_name: event.target.value })} />
          <label htmlFor="business-description">About your business</label>
          <textarea id="business-description" maxLength={5000} rows={3} value={profile.description ?? ''}
            onChange={(event) => setProfile({ ...profile, description: event.target.value })} />
          <div className="form-row">
            <div>
              <label htmlFor="business-phone">Phone</label>
              <input id="business-phone" maxLength={50} value={profile.phone ?? ''}
                onChange={(event) => setProfile({ ...profile, phone: event.target.value })} />
            </div>
            <div>
              <label htmlFor="business-location">Location</label>
              <input id="business-location" maxLength={255} value={profile.location ?? ''}
                onChange={(event) => setProfile({ ...profile, location: event.target.value })} />
            </div>
          </div>
          <button className="auth-submit" type="submit" disabled={submitting || loading}>
            Save business profile
          </button>
        </form>

        <form className="catalog-form" onSubmit={handleServiceSubmit}>
          <h2>{editingServiceId ? 'Edit service' : 'Add a service'}</h2>
          <label htmlFor="service-name">Service name</label>
          <input id="service-name" maxLength={255} required value={serviceForm.name}
            onChange={(event) => setServiceForm({ ...serviceForm, name: event.target.value })} />
          <label htmlFor="service-description">Description</label>
          <textarea id="service-description" maxLength={5000} rows={3} required value={serviceForm.description}
            onChange={(event) => setServiceForm({ ...serviceForm, description: event.target.value })} />
          <div className="form-row">
            <div>
              <label htmlFor="service-category">Category</label>
              <input id="service-category" maxLength={100} required value={serviceForm.category}
                onChange={(event) => setServiceForm({ ...serviceForm, category: event.target.value })} />
            </div>
            <div>
              <label htmlFor="service-duration">Duration (minutes)</label>
              <input id="service-duration" type="number" min={5} max={1440} required
                value={serviceForm.duration_minutes}
                onChange={(event) => setServiceForm({ ...serviceForm, duration_minutes: Number(event.target.value) })} />
            </div>
            <div>
              <label htmlFor="service-price">Price ($)</label>
              <input id="service-price" type="number" min={0} max={99999999.99} step="0.01" required
                value={serviceForm.price}
                onChange={(event) => setServiceForm({ ...serviceForm, price: Number(event.target.value) })} />
            </div>
          </div>
          <label className="checkbox-label">
            <input type="checkbox" checked={serviceForm.is_active ?? true}
              onChange={(event) => setServiceForm({ ...serviceForm, is_active: event.target.checked })} />
            Show this service in the public directory
          </label>
          <div className="form-actions">
            <button className="auth-submit" type="submit" disabled={submitting || loading}>
              {editingServiceId ? 'Save changes' : 'Add service'}
            </button>
            {editingServiceId && <button className="secondary-button" type="button" onClick={() => {
              setEditingServiceId(null)
              setServiceForm(emptyService)
            }}>Cancel edit</button>}
          </div>
        </form>

        <section className="vendor-service-list" aria-labelledby="vendor-services-title">
          <h2 id="vendor-services-title">Your services</h2>
          {!loading && services.length === 0 && <p className="empty-state">You haven’t added any services yet.</p>}
          {services.map((service) => (
            <article className="service-card" key={service.id}>
              <div className="service-card__heading">
                <div>
                  <p className="service-category">{service.category} · {service.is_active ? 'Published' : 'Hidden'}</p>
                  <h3>{service.name}</h3>
                </div>
                <p className="service-price">${Number(service.price).toFixed(2)}</p>
              </div>
              <p>{service.description}</p>
              <div className="form-actions">
                <button className="secondary-button" type="button" onClick={() => editService(service)}>Edit</button>
                <button className="secondary-button" type="button" disabled={submitting}
                  onClick={() => void handleDelete(service.id)}>Delete</button>
              </div>
            </article>
          ))}
        </section>
      </section>
    </main>
  )
}
