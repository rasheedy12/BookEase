import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { getApiErrorMessage } from '../services/apiError'
import { createBooking, formatCurrency, getPublicServices, weekDays } from '../services/catalog'
import type { ServiceListing, VendorOpeningDay } from '../services/catalog'

function localDateTimeMinimum(): string {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 16)
}

function formatOpeningHours(days: VendorOpeningDay[] | undefined): string {
  if (!days?.some((day) => !day.is_closed)) return 'Not accepting bookings'

  return days
    .filter((day) => !day.is_closed && day.opens_at && day.closes_at)
    .map((day) =>
      `${weekDays[day.day_of_week].slice(0, 3)} ${day.opens_at?.slice(0, 5)}–${day.closes_at?.slice(0, 5)}`,
    )
    .join(' · ')
}

function ServicesIcon({ name }: { name: 'grid' | 'search' | 'calendar' | 'history' }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, strokeWidth: 1.8 }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" {...common}>
      {name === 'grid' && <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>}
      {name === 'search' && <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>}
      {name === 'calendar' && <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>}
      {name === 'history' && <><path d="M3 12a9 9 0 1 0 2.6-6.4L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>}
    </svg>
  )
}

export function ServicesPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [services, setServices] = useState<ServiceListing[]>([])
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '')
  const [bookingService, setBookingService] = useState<ServiceListing | null>(null)
  const [startsAt, setStartsAt] = useState('')
  const [bookingTimeError, setBookingTimeError] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [booking, setBooking] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const bookingStartInput = useRef<HTMLInputElement>(null)

  async function handleLogout() {
    const loggedOut = await logout()
    if (loggedOut) navigate('/', { replace: true })
  }

  useEffect(() => {
    let active = true
    getPublicServices()
      .then((listings) => {
        if (active) setServices(listings)
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

  const query = search.trim().toLocaleLowerCase()
  const filteredServices = services.filter((service) =>
    [service.name, service.description, service.category, service.vendor_profile?.business_name]
      .some((field) => field?.toLocaleLowerCase().includes(query)),
  )

  async function handleBookingSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!bookingService || !startsAt) return
    setBooking(true)
    setError(null)
    setBookingTimeError(null)
    setNotice(null)
    try {
      const result = await createBooking({
        service_id: bookingService.id,
        starts_at: new Date(startsAt).toISOString(),
        notes,
      })
      window.location.assign(result.checkout_url)
    } catch (requestError: unknown) {
      const message = getApiErrorMessage(requestError)
      if (/time is no longer available|booking does not fit within the vendor.s opening hours/i.test(message)) {
        setStartsAt('')
        setBookingTimeError(message)
        bookingStartInput.current?.focus()
      } else {
        setError(message)
      }
    } finally {
      setBooking(false)
    }
  }

  return (
    <main className="page customer-dashboard services-dashboard" aria-labelledby="services-title">
      <aside className="customer-sidebar">
        <Link className="customer-brand" to="/"><span className="customer-brand__icon"><ServicesIcon name="calendar" /></span>BookEase</Link>
        <nav className="customer-side-nav" aria-label="Customer navigation">
          {user?.role === 'customer' && <Link className="customer-side-link" to="/customer"><ServicesIcon name="grid" />Dashboard</Link>}
          <span className="customer-side-link customer-side-link--active" aria-current="page"><ServicesIcon name="search" />Browse services</span>
          {user?.role === 'customer' && <>
            <Link className="customer-side-link" to="/customer?section=bookings"><ServicesIcon name="calendar" />My bookings</Link>
            <Link className="customer-side-link" to="/customer?section=history"><ServicesIcon name="history" />History</Link>
          </>}
        </nav>
        {user?.role === 'customer'
          ? <button className="customer-signout" type="button" onClick={() => void handleLogout()}>Sign out</button>
          : <Link className="customer-signout services-signin" to={user ? `/${user.role}` : '/login'}>{user ? 'Your account' : 'Sign in to book'}</Link>}
      </aside>
      <div className="customer-workspace">
        <header className="customer-topbar">
          <div className="customer-breadcrumb">BookEase <span>/</span> Service directory</div>
          {user
            ? <div className="customer-profile"><span className="customer-profile__avatar">{user.name.charAt(0).toUpperCase()}</span><span><strong>{user.name}</strong><small>{user.role}</small></span></div>
            : <Link className="services-topbar-signin" to="/login">Sign in</Link>}
        </header>
        <div className="customer-content services-content">
          <div className="customer-intro">
            <div><p className="eyebrow">BOOKEASE · SERVICE DIRECTORY</p><h1 id="services-title">Find a service</h1><p className="intro">Explore services offered by local professionals.</p></div>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          {notice && <p className="success-message" role="status">{notice}</p>}
          {searchParams.get('payment') === 'cancelled' && <p className="success-message" role="status">Checkout was cancelled. Your booking request is held until the checkout session expires.<Link to="/customer"> View your bookings.</Link></p>}
          <div className="service-filters services-search">
            <label className="sr-only" htmlFor="service-search">Search services</label>
            <input id="service-search" className="catalog-search" type="search" value={search}
              onChange={(event) => setSearch(event.target.value)} placeholder="Search by service, category or business" />
          </div>
          {loading && <p role="status">Loading services…</p>}
          {!loading && !error && filteredServices.length === 0 && <p className="empty-state">{services.length === 0 ? 'No services are available yet.' : 'No services match your search.'}</p>}
          <div className="services-booking-layout">
            <div className="service-list services-results">
              {filteredServices.map((service) => (
                <article className={`service-card services-result-card${bookingService?.id === service.id ? ' services-result-card--selected' : ''}`} key={service.id}>
                  <div className="service-card__heading"><div><p className="service-category">{service.category}</p><h2>{service.name}</h2></div><p className="service-price">{formatCurrency(service.price)}</p></div>
                  <p>{service.description}</p>
                  <p className="service-meta">{service.vendor_profile?.business_name ?? 'Local provider'}{service.vendor_profile?.location ? ` · ${service.vendor_profile.location}` : ''}{' · '}{service.duration_minutes} min</p>
                  {service.vendor_profile && <p className="service-meta">Open {formatOpeningHours(service.vendor_profile.opening_hours)} ({service.vendor_profile.timezone})</p>}
                  {user?.role === 'customer' && <button className={`services-select-button${bookingService?.id === service.id ? ' services-select-button--selected' : ''}`} type="button" onClick={() => {
                    setError(null)
                    setBookingTimeError(null)
                    setStartsAt('')
                    setNotes('')
                    setBookingService(service)
                  }}>{bookingService?.id === service.id ? 'Selected' : 'Request booking'}</button>}
                </article>
              ))}
            </div>
            {bookingService && user?.role === 'customer' && (
              <form className="catalog-form services-booking-form" onSubmit={handleBookingSubmit}>
                <h2>Request {bookingService.name}</h2>
                <p className="form-hint">Payment of {formatCurrency(bookingService.price)} is collected now. Paid bookings are automatically refunded if cancelled or declined.</p>
                <label htmlFor="booking-start">Start time</label>
                <input ref={bookingStartInput} id="booking-start" type="datetime-local" required min={localDateTimeMinimum()} value={startsAt}
                  aria-invalid={bookingTimeError ? 'true' : undefined}
                  aria-describedby={bookingTimeError ? 'booking-start-error' : undefined}
                  onChange={(event) => {
                    setStartsAt(event.target.value)
                    if (bookingTimeError) setBookingTimeError(null)
                  }} />
                {bookingTimeError && <p className="services-booking-time-error" id="booking-start-error" role="alert">{bookingTimeError}</p>}
                <label htmlFor="booking-notes">Notes for the provider (optional)</label>
                <textarea id="booking-notes" rows={3} maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} />
                <div className="form-actions">
                  <button className="auth-submit" type="submit" disabled={booking}>{booking ? 'Sending request…' : 'Send booking request'}</button>
                  <button className="secondary-button" type="button" disabled={booking} onClick={() => setBookingService(null)}>Cancel</button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
