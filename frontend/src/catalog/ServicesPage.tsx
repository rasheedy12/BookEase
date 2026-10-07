import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { getApiErrorMessage } from '../services/apiError'
import { createBooking, getPublicServices } from '../services/catalog'
import type { ServiceListing } from '../services/catalog'

function localDateTimeMinimum(): string {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 16)
}

export function ServicesPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [services, setServices] = useState<ServiceListing[]>([])
  const [search, setSearch] = useState('')
  const [bookingService, setBookingService] = useState<ServiceListing | null>(null)
  const [startsAt, setStartsAt] = useState('')
  const [notes, setNotes] = useState('')
  const [booking, setBooking] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
    setNotice(null)
    try {
      await createBooking({
        service_id: bookingService.id,
        starts_at: new Date(startsAt).toISOString(),
        notes,
      })
      setBookingService(null)
      setStartsAt('')
      setNotes('')
      setNotice('Booking request sent. You can follow its status in your account.')
    } catch (requestError: unknown) {
      setError(getApiErrorMessage(requestError))
    } finally {
      setBooking(false)
    }
  }

  return (
    <main className="page">
      <section className="welcome-card catalog-card" aria-labelledby="services-title">
        <Link className="brand-link" to="/">BookEase</Link>
        <p className="eyebrow">BOOKEASE · SERVICE DIRECTORY</p>
        <h1 id="services-title">Find a service.</h1>
        <p className="intro">Explore services offered by local professionals.</p>
        <p className="dashboard-links"><Link to="/">Home</Link>{' · '}
          {user ? <Link to={`/${user.role}`}>Your account</Link> : <Link to="/login">Sign in to book</Link>}
        </p>
        <label className="search-label" htmlFor="service-search">Search services</label>
        <input
          id="service-search"
          className="catalog-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by service, category, or business"
        />
        {loading && <p role="status">Loading services…</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && <p className="success-message" role="status">{notice}</p>}
        {!loading && !error && filteredServices.length === 0 && (
          <p className="empty-state">
            {services.length === 0 ? 'No services are available yet.' : 'No services match your search.'}
          </p>
        )}
        <div className="service-list">
          {filteredServices.map((service) => (
            <article className="service-card" key={service.id}>
              <div className="service-card__heading">
                <div>
                  <p className="service-category">{service.category}</p>
                  <h2>{service.name}</h2>
                </div>
                <p className="service-price">${Number(service.price).toFixed(2)}</p>
              </div>
              <p>{service.description}</p>
              <p className="service-meta">
                {service.vendor_profile?.business_name ?? 'Local provider'}
                {service.vendor_profile?.location ? ` · ${service.vendor_profile.location}` : ''}
                {' · '}{service.duration_minutes} min
              </p>
              {user?.role === 'customer' && (
                <button className="auth-submit" type="button" onClick={() => {
                  setError(null)
                  setBookingService(service)
                }}>Request booking</button>
              )}
            </article>
          ))}
        </div>
        {bookingService && (
          <form className="catalog-form" onSubmit={handleBookingSubmit}>
            <h2>Request {bookingService.name}</h2>
            <label htmlFor="booking-start">Start time</label>
            <input id="booking-start" type="datetime-local" required min={localDateTimeMinimum()}
              value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
            <label htmlFor="booking-notes">Notes for the provider (optional)</label>
            <textarea id="booking-notes" rows={3} maxLength={2000} value={notes}
              onChange={(event) => setNotes(event.target.value)} />
            <div className="form-actions">
              <button className="auth-submit" type="submit" disabled={booking}>
                {booking ? 'Sending request…' : 'Send booking request'}
              </button>
              <button className="secondary-button" type="button" disabled={booking}
                onClick={() => setBookingService(null)}>Cancel</button>
            </div>
          </form>
        )}
      </section>
    </main>
  )
}
