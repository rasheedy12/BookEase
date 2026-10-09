import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { getApiErrorMessage } from '../services/apiError'
import {
  deleteService,
  formatCurrency,
  getVendorAvailability,
  getVendorBookings,
  getVendorProfile,
  getVendorServices,
  saveService,
  saveVendorAvailability,
  saveVendorProfile,
  updateBookingStatus,
  weekDays,
} from '../services/catalog'
import type {
  Booking,
  BookingStatus,
  ServiceInput,
  ServiceListing,
  VendorAvailability,
  VendorProfileInput,
} from '../services/catalog'

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

const emptyAvailability: VendorAvailability = {
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  is_configured: false,
  days: weekDays.map((_, day_of_week) => ({
    day_of_week,
    is_closed: true,
    opens_at: null,
    closes_at: null,
  })),
}

type VendorSection = 'dashboard' | 'services' | 'bookings' | 'profile'

function VendorIcon({ name }: { name: 'grid' | 'users' | 'scissors' | 'calendar' | 'check' | 'clock' }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, strokeWidth: 1.8 }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" {...common}>
      {name === 'grid' && <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>}
      {name === 'users' && <><path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20" /><circle cx="10" cy="8" r="3.5" /><path d="M16 4.7a3.5 3.5 0 0 1 0 6.6M20 20v-1.5a3.5 3.5 0 0 0-2.6-3.4" /></>}
      {name === 'scissors' && <><circle cx="6" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><path d="m8 8 12 12M8 16 20 4M14 10l-2 2" /></>}
      {name === 'calendar' && <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>}
      {name === 'check' && <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>}
      {name === 'clock' && <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>}
    </svg>
  )
}

export function VendorDashboardPage() {
  const { error: authError, logout } = useAuth()
  const navigate = useNavigate()
  const [vendorSection, setVendorSection] = useState<VendorSection>('dashboard')
  const [profile, setProfile] = useState<VendorProfileInput>(emptyProfile)
  const [services, setServices] = useState<ServiceListing[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [availability, setAvailability] = useState<VendorAvailability>(emptyAvailability)
  const [profileSaved, setProfileSaved] = useState(false)
  const [serviceForm, setServiceForm] = useState<ServiceInput>(emptyService)
  const [editingServiceId, setEditingServiceId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const pendingBookings = bookings.filter((booking) => booking.status === 'pending').length
  const confirmedBookings = bookings.filter((booking) => booking.status === 'confirmed').length

  async function reloadVendorData() {
    const [savedProfile, savedServices, savedBookings, savedAvailability] = await Promise.all([
      getVendorProfile(),
      getVendorServices(),
      getVendorBookings(),
      getVendorAvailability(),
    ])
    if (savedProfile) {
      setProfileSaved(true)
      setProfile({
        business_name: savedProfile.business_name,
        description: savedProfile.description ?? '',
        phone: savedProfile.phone ?? '',
        location: savedProfile.location ?? '',
      })
    }
    setServices(savedServices)
    setBookings(savedBookings)
    setAvailability(savedAvailability.is_configured ? savedAvailability : {
      ...savedAvailability,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || savedAvailability.timezone,
    })
  }

  useEffect(() => {
    let active = true
    Promise.all([getVendorProfile(), getVendorServices(), getVendorBookings(), getVendorAvailability()])
      .then(([savedProfile, savedServices, savedBookings, savedAvailability]) => {
        if (!active) return
        if (savedProfile) {
          setProfileSaved(true)
          setProfile({
            business_name: savedProfile.business_name,
            description: savedProfile.description ?? '',
            phone: savedProfile.phone ?? '',
            location: savedProfile.location ?? '',
          })
        }
        setServices(savedServices)
        setBookings(savedBookings)
        setAvailability(savedAvailability.is_configured ? savedAvailability : {
          ...savedAvailability,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || savedAvailability.timezone,
        })
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
      setProfileSaved(true)
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

  async function handleAvailabilitySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setNotice(null)
    try {
      const savedAvailability = await saveVendorAvailability(availability)
      setAvailability(savedAvailability)
      setNotice('Weekly opening hours saved.')
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

  async function handleBookingStatus(bookingId: number, status: BookingStatus) {
    setSubmitting(true)
    setError(null)
    setNotice(null)
    try {
      const updated = await updateBookingStatus(bookingId, status, 'vendor')
      setBookings((current) => current.map((booking) =>
        booking.id === updated.id ? updated : booking,
      ))
      setNotice(`Booking ${status}.`)
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
    <main className="page vendor-page vendor-dashboard" aria-labelledby="vendor-title">
      <aside className="vendor-sidebar">
        <Link className="vendor-brand" to="/"><span className="vendor-brand__icon"><VendorIcon name="calendar" /></span>BookEase</Link>
        <nav className="vendor-side-nav" aria-label="Vendor navigation">
          <button className={`vendor-side-link${vendorSection === 'dashboard' ? ' vendor-side-link--active' : ''}`}
            type="button" aria-current={vendorSection === 'dashboard' ? 'page' : undefined}
            onClick={() => setVendorSection('dashboard')}><VendorIcon name="grid" />Dashboard</button>
          <button className={`vendor-side-link${vendorSection === 'services' ? ' vendor-side-link--active' : ''}`}
            type="button" aria-current={vendorSection === 'services' ? 'page' : undefined}
            onClick={() => setVendorSection('services')}><VendorIcon name="scissors" />My services</button>
          <button className={`vendor-side-link${vendorSection === 'bookings' ? ' vendor-side-link--active' : ''}`}
            type="button" aria-current={vendorSection === 'bookings' ? 'page' : undefined}
            onClick={() => setVendorSection('bookings')}><VendorIcon name="calendar" />Bookings</button>
          <button className={`vendor-side-link${vendorSection === 'profile' ? ' vendor-side-link--active' : ''}`}
            type="button" aria-current={vendorSection === 'profile' ? 'page' : undefined}
            onClick={() => setVendorSection('profile')}><VendorIcon name="users" />Profile</button>
        </nav>
        <button className="vendor-signout" type="button" onClick={() => void handleLogout()} disabled={submitting}>Sign out</button>
      </aside>

      <div className="vendor-workspace">
        <header className="vendor-topbar">
          <div className="vendor-breadcrumb">BookEase <span>/</span> Vendor workspace</div>
          <div className="vendor-profile">
            <span className="vendor-profile__avatar">{(profile.business_name || 'V').charAt(0).toUpperCase()}</span>
            <span><strong>{profile.business_name || 'Your business'}</strong><small>Vendor</small></span>
          </div>
        </header>

        <div className="vendor-content">
          <div className="vendor-intro" id="vendor-title">
            <div>
              <p className="eyebrow">BOOKEASE · VENDOR WORKSPACE</p>
              <h1>{vendorSection === 'dashboard' ? 'Dashboard' : vendorSection === 'services' ? 'My services' : vendorSection === 'bookings' ? 'Bookings' : 'Profile'}</h1>
              <p className="intro">{vendorSection === 'dashboard'
                ? 'A quick overview of your business activity.'
                : vendorSection === 'services'
                  ? 'Manage the services customers can discover and book.'
                  : vendorSection === 'bookings'
                    ? 'Review appointments and respond to your customers.'
                    : 'Manage your business details and weekly opening hours.'}</p>
            </div>
            {vendorSection === 'services' && <button className="vendor-primary-link" type="button"
              onClick={() => document.getElementById('vendor-add-service')?.scrollIntoView({ behavior: 'smooth' })}>Add service</button>}
          </div>
          <section className="vendor-overview" aria-label="Business summary" hidden={vendorSection !== 'dashboard'}>
            <article className="vendor-stat"><div><span>Total services</span><VendorIcon name="scissors" /></div><strong>{services.length.toLocaleString()}</strong><small>In your service list</small></article>
            <article className="vendor-stat"><div><span>Published</span><VendorIcon name="check" /></div><strong>{services.filter((service) => service.is_active).length.toLocaleString()}</strong><small>Visible to customers</small></article>
            <article className="vendor-stat vendor-stat--pending"><div><span>Pending requests</span><VendorIcon name="clock" /></div><strong>{pendingBookings.toLocaleString()}</strong><small>Waiting for your response</small></article>
            <article className="vendor-stat"><div><span>Confirmed bookings</span><VendorIcon name="calendar" /></div><strong>{confirmedBookings.toLocaleString()}</strong><small>Scheduled appointments</small></article>
          </section>
          {loading && <p role="status">Loading your workspace…</p>}
          {(error || authError) && <p className="form-error" role="alert">{error ?? authError}</p>}
          {notice && <p className="success-message" role="status">{notice}</p>}

          <div className="vendor-work-grid">
            <section id="vendor-services" className="vendor-service-list vendor-panel vendor-dashboard-panel" aria-labelledby="vendor-services-title" hidden={vendorSection !== 'services'}>
              <div className="vendor-panel__heading">
                <div><p className="eyebrow">YOUR OFFERINGS</p><h2 id="vendor-services-title">My services</h2><p>Manage the listings customers can discover.</p></div>
                <span className="vendor-count">{services.length} {services.length === 1 ? 'service' : 'services'}</span>
              </div>
              {!loading && services.length === 0 && <p className="empty-state">You haven’t added any services yet.</p>}
              {services.length > 0 && <div className="vendor-table-wrap"><table className="vendor-table">
                <thead><tr><th>Service</th><th>Duration</th><th>Price</th><th>Status</th><th /></tr></thead>
                <tbody>{services.map((service) => <tr key={service.id}>
                  <td className="vendor-table__primary">{service.name}<small>{service.category}</small></td>
                  <td>{service.duration_minutes} min</td><td>{formatCurrency(service.price)}</td>
                  <td><span className={`vendor-status${service.is_active ? ' vendor-status--active' : ''}`}>{service.is_active ? 'Published' : 'Draft'}</span></td>
                  <td><button className="vendor-action" type="button" onClick={() => editService(service)}>Edit</button><button className="vendor-action vendor-action--danger" type="button" disabled={submitting} onClick={() => void handleDelete(service.id)}>Delete</button></td>
                </tr>)}</tbody>
              </table></div>}
            </section>

            <section id="vendor-bookings" className="vendor-service-list vendor-panel vendor-dashboard-panel" aria-labelledby="vendor-bookings-title" hidden={vendorSection !== 'bookings'}>
              <div className="vendor-panel__heading">
                <div><p className="eyebrow">CUSTOMER ACTIVITY</p><h2 id="vendor-bookings-title">Booking requests</h2><p>Review appointments and respond to customers.</p></div>
                <span className="vendor-count">{bookings.length} {bookings.length === 1 ? 'booking' : 'bookings'}</span>
              </div>
              {!loading && bookings.length === 0 && <p className="empty-state">You don’t have any booking requests yet.</p>}
              <div className="vendor-booking-list">
                {bookings.map((booking) => (
                  <article className="vendor-booking" key={booking.id}>
                    <div className="vendor-booking__top"><span className={`vendor-status${booking.status === 'confirmed' ? ' vendor-status--active' : ''}`}>{booking.status}</span><strong>{formatCurrency(booking.price)}</strong></div>
                    <h3>{booking.service_name}</h3>
                    <p>{booking.customer_name ?? 'Customer'} · {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(booking.starts_at))}</p>
                    <small>Payment: {booking.payment_status}</small>
                    {booking.notes && <p>{booking.notes}</p>}
                    <div className="vendor-booking__actions">
                      {booking.status === 'pending' && <>
                        <button className="vendor-action vendor-action--primary" type="button" disabled={submitting} onClick={() => void handleBookingStatus(booking.id, 'confirmed')}>Accept</button>
                        <button className="vendor-action" type="button" disabled={submitting} onClick={() => void handleBookingStatus(booking.id, 'rejected')}>Decline</button>
                      </>}
                      {booking.status === 'confirmed' && <button className="vendor-action" type="button" disabled={submitting} onClick={() => void handleBookingStatus(booking.id, 'completed')}>Mark complete</button>}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>

        <div className={`vendor-settings-grid vendor-settings-grid--${vendorSection}`}>
        <form id="vendor-profile" className="catalog-form vendor-panel vendor-settings-panel" onSubmit={handleProfileSubmit} hidden={vendorSection !== 'profile'}>
          <h2>Business profile</h2>
          <p className="form-hint">This information helps customers understand and find your business.</p>
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

        <form id="vendor-availability" className="catalog-form vendor-panel vendor-settings-panel" onSubmit={handleAvailabilitySubmit} hidden={vendorSection !== 'profile'}>
          <h2>Weekly opening hours</h2>
          <p className="form-hint">Bookings must fit completely within your opening hours.</p>
          <label htmlFor="availability-timezone">Business timezone</label>
          <input id="availability-timezone" required maxLength={64} value={availability.timezone}
            onChange={(event) => setAvailability({ ...availability, timezone: event.target.value })} />
          {availability.days.map((day) => (
            <div className="availability-day" key={day.day_of_week}>
              <label className="checkbox-label">
                <input type="checkbox" checked={!day.is_closed}
                  onChange={(event) => setAvailability({
                    ...availability,
                    days: availability.days.map((item) => item.day_of_week === day.day_of_week
                      ? {
                        ...item,
                        is_closed: !event.target.checked,
                        opens_at: item.opens_at ?? '09:00',
                        closes_at: item.closes_at ?? '17:00',
                      }
                      : item),
                  })} />
                {weekDays[day.day_of_week]}
              </label>
              <input aria-label={`${weekDays[day.day_of_week]} opens`} type="time"
                disabled={day.is_closed} required={!day.is_closed} value={day.opens_at ?? ''}
                onChange={(event) => setAvailability({
                  ...availability,
                  days: availability.days.map((item) => item.day_of_week === day.day_of_week
                    ? { ...item, opens_at: event.target.value }
                    : item),
                })} />
              <span>to</span>
              <input aria-label={`${weekDays[day.day_of_week]} closes`} type="time"
                disabled={day.is_closed} required={!day.is_closed} value={day.closes_at ?? ''}
                onChange={(event) => setAvailability({
                  ...availability,
                  days: availability.days.map((item) => item.day_of_week === day.day_of_week
                    ? { ...item, closes_at: event.target.value }
                    : item),
                })} />
            </div>
          ))}
          {!profileSaved && (
            <p className="form-hint">Save your business profile before setting opening hours.</p>
          )}
          <button className="auth-submit" type="submit"
            disabled={submitting || loading || !profileSaved}>
            Save opening hours
          </button>
        </form>

        <form id="vendor-add-service" className="catalog-form vendor-panel vendor-settings-panel" onSubmit={handleServiceSubmit} hidden={vendorSection !== 'services'}>
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
              <label htmlFor="service-price">Price (NGN)</label>
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

        </div>
        </div>
      </div>
    </main>
  )
}
