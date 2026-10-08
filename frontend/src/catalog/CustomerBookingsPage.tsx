import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useSearchParams } from 'react-router-dom'
import { getApiErrorMessage } from '../services/apiError'
import { formatCurrency, getCustomerBookings, getPublicServices, updateBookingStatus } from '../services/catalog'
import type { Booking, ServiceListing } from '../services/catalog'

function formatBookingTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function CustomerBookingsPage() {
  const { user, error: authError, logout } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [services, setServices] = useState<ServiceListing[]>([])
  const [serviceSearch, setServiceSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [loading, setLoading] = useState(true)
  const [servicesLoading, setServicesLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [servicesError, setServicesError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setBookings(await getCustomerBookings())
  }, [])

  useEffect(() => {
    let active = true
    getCustomerBookings()
      .then((results) => {
        if (active) setBookings(results)
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

  useEffect(() => {
    let active = true
    getPublicServices()
      .then((listings) => {
        if (active) setServices(listings)
      })
      .catch((requestError: unknown) => {
        if (active) setServicesError(getApiErrorMessage(requestError))
      })
      .finally(() => {
        if (active) setServicesLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const categories = [...new Set(services.map((service) => service.category))]
    .sort((first, second) => first.localeCompare(second))
  const query = serviceSearch.trim().toLocaleLowerCase()
  const matchingServices = services.filter((service) => {
    const matchesCategory = !selectedCategory || service.category === selectedCategory
    const matchesSearch = !query || [
      service.name,
      service.description,
      service.category,
      service.vendor_profile?.business_name,
      service.vendor_profile?.location,
    ].some((field) => field?.toLocaleLowerCase().includes(query))
    return matchesCategory && matchesSearch
  })
  const upcomingBookings = bookings.filter((booking) =>
    ['pending', 'confirmed'].includes(booking.status) && new Date(booking.starts_at) > new Date(),
  ).length
  const pendingBookings = bookings.filter((booking) => booking.status === 'pending').length

  async function cancelBooking(bookingId: number) {
    setSubmitting(true)
    setError(null)
    try {
      await updateBookingStatus(bookingId, 'cancelled', 'customer')
      await reload()
    } catch (requestError: unknown) {
      setError(getApiErrorMessage(requestError))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleLogout() {
    const loggedOut = await logout()
    if (loggedOut) navigate('/', { replace: true })
  }

  return (
    <main className="page customer-page">
      <section className="welcome-card catalog-card customer-card" aria-labelledby="customer-bookings-title">
        <header className="customer-header">
          <Link className="brand-link" to="/">BookEase</Link>
          <div className="customer-header__account">
            <span>{user?.name}</span>
            <button className="secondary-button" type="button" onClick={() => void handleLogout()} disabled={submitting}>
              Sign out
            </button>
          </div>
        </header>
        <div className="customer-intro">
          <p className="eyebrow">BOOKEASE · CUSTOMER ACCOUNT</p>
          <h1 id="customer-bookings-title">Your bookings</h1>
          <p className="intro">Welcome back, {user?.name}. Keep track of appointments and find your next service.</p>
        </div>
        <section className="customer-overview" aria-label="Booking summary">
          <article className="customer-stat">
            <span>Total bookings</span>
            <strong>{bookings.length.toLocaleString()}</strong>
            <small>Your booking history</small>
          </article>
          <article className="customer-stat">
            <span>Upcoming</span>
            <strong>{upcomingBookings.toLocaleString()}</strong>
            <small>Pending or confirmed</small>
          </article>
          <article className="customer-stat customer-stat--pending">
            <span>Awaiting confirmation</span>
            <strong>{pendingBookings.toLocaleString()}</strong>
            <small>Pending requests</small>
          </article>
        </section>
        <section className="customer-discovery" aria-labelledby="customer-services-title">
          <div className="customer-discovery__heading">
            <div>
              <p className="eyebrow">DISCOVER SOMETHING NEW</p>
              <h2 id="customer-services-title">Explore local services</h2>
              <p className="form-hint">Search by service, category, business, or location.</p>
            </div>
            <Link className="auth-link auth-link--primary" to="/services">Browse full directory</Link>
          </div>
          <div className="service-filters">
            <label className="sr-only" htmlFor="customer-service-search">Search services</label>
            <input
              id="customer-service-search"
              className="catalog-search"
              type="search"
              value={serviceSearch}
              onChange={(event) => setServiceSearch(event.target.value)}
              placeholder="What service are you looking for?"
            />
            <label className="sr-only" htmlFor="customer-service-category">Filter by category</label>
            <select
              id="customer-service-category"
              className="category-select"
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
            >
              <option value="">All categories</option>
              {categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </div>
          {servicesLoading && <p role="status">Loading services…</p>}
          {servicesError && <p className="form-error" role="alert">{servicesError}</p>}
          {!servicesLoading && !servicesError && matchingServices.length === 0 && (
            <p className="empty-state">
              {services.length === 0
                ? 'No services are available yet. Please check back soon.'
                : 'No services match those filters. Try a different search or category.'}
            </p>
          )}
          <div className="service-list">
            {matchingServices.map((service) => (
              <article className="service-card" key={service.id}>
                <div className="service-card__heading">
                  <div>
                    <p className="service-category">{service.category}</p>
                    <h3>{service.name}</h3>
                  </div>
                  <p className="service-price">{formatCurrency(service.price)}</p>
                </div>
                <p>{service.description}</p>
                <p className="service-meta">
                  {service.vendor_profile?.business_name ?? 'Local provider'}
                  {service.vendor_profile?.location ? ` · ${service.vendor_profile.location}` : ''}
                  {' · '}{service.duration_minutes} min
                </p>
                <Link
                  className="secondary-button service-book-link"
                  to={`/services?search=${encodeURIComponent(service.name)}`}
                >
                  View booking options
                </Link>
              </article>
            ))}
          </div>
        </section>
        <section className="customer-bookings" aria-labelledby="customer-bookings-list-title">
          <div className="customer-section-heading">
            <div>
              <p className="eyebrow">YOUR ACTIVITY</p>
              <h2 id="customer-bookings-list-title">Booking history</h2>
              <p>Review appointment details and manage upcoming bookings.</p>
            </div>
            <span className="customer-count">{bookings.length} {bookings.length === 1 ? 'booking' : 'bookings'}</span>
          </div>
          {(error || authError) && <p className="form-error" role="alert">{error ?? authError}</p>}
          {searchParams.get('payment') === 'success' && (
            <p className="success-message" role="status">
              Payment submitted. Your booking and payment status will update when Paystack confirms it.
            </p>
          )}
          {loading && <p role="status">Loading your bookings…</p>}
          {!loading && bookings.length === 0 && <p className="empty-state">You don’t have any bookings yet.</p>}
          <div className="service-list">
            {bookings.map((booking) => (
              <article className="service-card" key={booking.id}>
                <div className="service-card__heading">
                  <div>
                    <p className="service-category">Booking #{booking.id}</p>
                    <h2>{booking.service_name}</h2>
                  </div>
                  <p className="service-price">{formatCurrency(booking.price)}</p>
                </div>
                <span className={`customer-booking-status customer-booking-status--${booking.status}`}>
                  {booking.status}
                </span>
                <p className="service-meta">Payment: {booking.payment_status}</p>
                <p>{booking.business_name}</p>
                <p className="service-meta">{formatBookingTime(booking.starts_at)}</p>
                {booking.notes && <p>{booking.notes}</p>}
                {['pending', 'confirmed'].includes(booking.status) && (
                  <button className="secondary-button" type="button" disabled={submitting}
                    onClick={() => void cancelBooking(booking.id)}>Cancel booking</button>
                )}
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  )
}
