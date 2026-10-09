import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { getApiErrorMessage } from '../services/apiError'
import {
  downloadCustomerReceiptPdf,
  formatCurrency,
  formatPaymentStatus,
  getCustomerBookings,
  getPublicServices,
  updateBookingStatus,
  verifyCustomerPayment,
} from '../services/catalog'
import type { Booking, ServiceListing } from '../services/catalog'

function formatBookingTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

type CustomerSection = 'dashboard' | 'services' | 'bookings' | 'history'

function CustomerIcon({ name }: { name: 'grid' | 'search' | 'calendar' | 'history' | 'clock' | 'check' }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, strokeWidth: 1.8 }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" {...common}>
      {name === 'grid' && <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>}
      {name === 'search' && <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>}
      {name === 'calendar' && <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>}
      {name === 'history' && <><path d="M3 12a9 9 0 1 0 2.6-6.4L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>}
      {name === 'clock' && <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>}
      {name === 'check' && <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>}
    </svg>
  )
}

export function CustomerBookingsPage() {
  const { user, error: authError, logout } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [customerSection, setCustomerSection] = useState<CustomerSection>('dashboard')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [services, setServices] = useState<ServiceListing[]>([])
  const [serviceSearch, setServiceSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [loading, setLoading] = useState(true)
  const [servicesLoading, setServicesLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paymentNotice, setPaymentNotice] = useState<string | null>(null)
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

  const paymentReference = searchParams.get('reference') ?? searchParams.get('trxref')
  useEffect(() => {
    if (!paymentReference) return
    const reference = paymentReference

    let active = true
    async function verifyPaymentOnReturn() {
      try {
        const bookingId = Number(searchParams.get('booking_id'))
        if (!Number.isSafeInteger(bookingId) || bookingId < 1) {
          throw new Error('The payment return did not include a valid booking reference.')
        }

        await verifyCustomerPayment(bookingId, reference)
        if (!active) return
        await reload()
        setPaymentNotice('Payment Successful. Your booking is confirmed and your receipt is ready.')
      } catch (requestError: unknown) {
        if (active) setError(getApiErrorMessage(requestError))
      } finally {
        if (active) navigate('/customer', { replace: true })
      }
    }

    void verifyPaymentOnReturn()
    return () => {
      active = false
    }
  }, [navigate, paymentReference, reload, searchParams])

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
  const activeBookings = bookings.filter((booking) =>
    ['pending', 'confirmed'].includes(booking.status) && new Date(booking.starts_at) > new Date(),
  )
  const historyBookings = bookings.filter((booking) =>
    !['pending', 'confirmed'].includes(booking.status) || new Date(booking.starts_at) <= new Date(),
  )
  const upcomingPreview = activeBookings.slice(0, 3)

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

  function renderBookingCards(items: Booking[]) {
    return items.map((booking) => (
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
        <p className="service-meta">Payment: {formatPaymentStatus(booking.payment_status)}</p>
        <p>{booking.business_name}</p>
        <p className="service-meta">{formatBookingTime(booking.starts_at)}</p>
        {booking.notes && <p>{booking.notes}</p>}
        {(booking.receipt_number || ['pending', 'confirmed'].includes(booking.status)) && (
          <div className="form-actions receipt-actions">
            {booking.receipt_number && <>
              <Link className="auth-link auth-link--primary" to={`/customer/receipts/${booking.id}`}>View receipt</Link>
              <button className="secondary-button" type="button" onClick={async () => {
                setError(null)
                try {
                  const pdf = await downloadCustomerReceiptPdf(booking.id)
                  const url = URL.createObjectURL(pdf)
                  const link = document.createElement('a')
                  link.href = url
                  link.download = `bookease-receipt-${booking.receipt_number}.pdf`
                  link.click()
                  URL.revokeObjectURL(url)
                } catch (requestError: unknown) {
                  setError(getApiErrorMessage(requestError))
                }
              }}>Download PDF</button>
            </>}
            {['pending', 'confirmed'].includes(booking.status) && (
              <button className="secondary-button" type="button" disabled={submitting}
                onClick={() => void cancelBooking(booking.id)}>Cancel booking</button>
            )}
          </div>
        )}
      </article>
    ))
  }

  return (
    <main className="page customer-page customer-dashboard" aria-labelledby="customer-dashboard-title">
      <aside className="customer-sidebar">
        <Link className="customer-brand" to="/"><span className="customer-brand__icon"><CustomerIcon name="calendar" /></span>BookEase</Link>
        <nav className="customer-side-nav" aria-label="Customer navigation">
          <button className={`customer-side-link${customerSection === 'dashboard' ? ' customer-side-link--active' : ''}`} type="button" aria-current={customerSection === 'dashboard' ? 'page' : undefined} onClick={() => setCustomerSection('dashboard')}><CustomerIcon name="grid" />Dashboard</button>
          <button className={`customer-side-link${customerSection === 'services' ? ' customer-side-link--active' : ''}`} type="button" aria-current={customerSection === 'services' ? 'page' : undefined} onClick={() => setCustomerSection('services')}><CustomerIcon name="search" />Browse services</button>
          <button className={`customer-side-link${customerSection === 'bookings' ? ' customer-side-link--active' : ''}`} type="button" aria-current={customerSection === 'bookings' ? 'page' : undefined} onClick={() => setCustomerSection('bookings')}><CustomerIcon name="calendar" />My bookings</button>
          <button className={`customer-side-link${customerSection === 'history' ? ' customer-side-link--active' : ''}`} type="button" aria-current={customerSection === 'history' ? 'page' : undefined} onClick={() => setCustomerSection('history')}><CustomerIcon name="history" />History</button>
        </nav>
        <button className="customer-signout" type="button" onClick={() => void handleLogout()} disabled={submitting}>Sign out</button>
      </aside>

      <div className="customer-workspace">
        <header className="customer-topbar">
          <div className="customer-breadcrumb">BookEase <span>/</span> Customer account</div>
          <div className="customer-profile">
            <span className="customer-profile__avatar">{user?.name?.charAt(0).toUpperCase() ?? 'C'}</span>
            <span><strong>{user?.name ?? 'Customer'}</strong><small>Customer</small></span>
          </div>
        </header>
        <div className="customer-content">
          <div className="customer-intro">
            <div>
              <p className="eyebrow">BOOKEASE · CUSTOMER ACCOUNT</p>
              <h1 id="customer-dashboard-title">{customerSection === 'dashboard' ? `Welcome back, ${user?.name ?? 'Customer'}` : customerSection === 'services' ? 'Browse services' : customerSection === 'bookings' ? 'My bookings' : 'Booking history'}</h1>
              <p className="intro">{customerSection === 'dashboard' ? 'Keep track of appointments and find your next service.' : customerSection === 'services' ? 'Find a local service that fits your schedule.' : customerSection === 'bookings' ? 'View upcoming appointments and manage your requests.' : 'Review past appointments, payments, and receipts.'}</p>
            </div>
          </div>
          {(error || authError) && <p className="form-error" role="alert">{error ?? authError}</p>}
          {paymentNotice && <p className="success-message" role="status">{paymentNotice}</p>}
          {searchParams.get('payment') === 'success' && !paymentReference && (
            <p className="success-message" role="status">Paystack returned successfully. Refresh your bookings to check payment verification.</p>
          )}
          {loading && <p role="status">Loading your bookings…</p>}

          <section className="customer-overview" aria-label="Booking summary" hidden={customerSection !== 'dashboard'}>
          <article className="customer-stat">
            <div><span>Total bookings</span><CustomerIcon name="history" /></div>
            <strong>{bookings.length.toLocaleString()}</strong>
            <small>Your booking history</small>
          </article>
          <article className="customer-stat">
            <div><span>Upcoming</span><CustomerIcon name="calendar" /></div>
            <strong>{upcomingBookings.toLocaleString()}</strong>
            <small>Pending or confirmed</small>
          </article>
          <article className="customer-stat customer-stat--pending">
            <div><span>Awaiting confirmation</span><CustomerIcon name="clock" /></div>
            <strong>{pendingBookings.toLocaleString()}</strong>
            <small>Pending requests</small>
          </article>
        </section>
        {customerSection === 'dashboard' && (
          <>
            <section className="customer-dashboard-panel" aria-labelledby="customer-upcoming-title">
              <div className="customer-section-heading"><div><p className="eyebrow">YOUR SCHEDULE</p><h2 id="customer-upcoming-title">Upcoming appointments</h2></div><button className="customer-text-action" type="button" onClick={() => setCustomerSection('bookings')}>View all</button></div>
              {!loading && upcomingPreview.length === 0 && <p className="empty-state">You don’t have any upcoming appointments yet.</p>}
              <div className="customer-upcoming-list">{upcomingPreview.map((booking) => (
                <article className="customer-upcoming-item" key={booking.id}>
                  <div><h3>{booking.service_name}</h3><p>{booking.business_name} · {formatBookingTime(booking.starts_at)}</p></div>
                  <span className={`customer-booking-status customer-booking-status--${booking.status}`}>{booking.status}</span>
                </article>
              ))}</div>
            </section>
            <section className="customer-discovery customer-discovery--dashboard" aria-labelledby="customer-services-preview-title">
              <div className="customer-discovery__heading"><div><p className="eyebrow">DISCOVER SOMETHING NEW</p><h2 id="customer-services-preview-title">Explore local services</h2></div><button className="customer-text-action" type="button" onClick={() => setCustomerSection('services')}>Browse all</button></div>
              {servicesLoading && <p role="status">Loading services…</p>}
              {servicesError && <p className="form-error" role="alert">{servicesError}</p>}
              {!servicesLoading && !servicesError && matchingServices.length === 0 && <p className="empty-state">No services are available yet. Please check back soon.</p>}
              <div className="service-list customer-service-grid">{matchingServices.slice(0, 3).map((service) => (
                <article className="service-card" key={service.id}>
                  <div className="service-card__heading"><div><p className="service-category">{service.category}</p><h3>{service.name}</h3></div><p className="service-price">{formatCurrency(service.price)}</p></div>
                  <p>{service.description}</p><p className="service-meta">{service.vendor_profile?.business_name ?? 'Local provider'} · {service.duration_minutes} min</p>
                  <Link className="secondary-button service-book-link" to={`/services?search=${encodeURIComponent(service.name)}`}>View booking options</Link>
                </article>
              ))}</div>
            </section>
          </>
        )}
        <section className="customer-discovery" aria-labelledby="customer-services-title" hidden={customerSection !== 'services'}>
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
          <div className="service-list customer-service-grid">
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
        <section className="customer-bookings" aria-labelledby="customer-bookings-list-title" hidden={!['bookings', 'history'].includes(customerSection)}>
          <div className="customer-section-heading">
            <div>
              <p className="eyebrow">YOUR ACTIVITY</p>
              <h2 id="customer-bookings-list-title">{customerSection === 'history' ? 'Booking history' : 'Upcoming bookings'}</h2>
              <p>{customerSection === 'history' ? 'Review past appointments, payments, and receipts.' : 'Review appointment details and manage upcoming bookings.'}</p>
            </div>
            <span className="customer-count">{(customerSection === 'history' ? historyBookings : activeBookings).length} {(customerSection === 'history' ? historyBookings : activeBookings).length === 1 ? 'booking' : 'bookings'}</span>
          </div>
          {!loading && (customerSection === 'history' ? historyBookings : activeBookings).length === 0 && <p className="empty-state">{customerSection === 'history' ? 'Your completed and past bookings will appear here.' : 'You don’t have any upcoming bookings.'}</p>}
          <div className="service-list">{renderBookingCards(customerSection === 'history' ? historyBookings : activeBookings)}</div>
        </section>
        </div>
      </div>
    </main>
  )
}
