import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { getApiErrorMessage } from '../services/apiError'
import { getCustomerBookings, updateBookingStatus } from '../services/catalog'
import type { Booking } from '../services/catalog'

function formatBookingTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function CustomerBookingsPage() {
  const { user, error: authError, logout } = useAuth()
  const navigate = useNavigate()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    <main className="page">
      <section className="welcome-card catalog-card" aria-labelledby="customer-bookings-title">
        <Link className="brand-link" to="/">BookEase</Link>
        <p className="eyebrow">BOOKEASE · CUSTOMER ACCOUNT</p>
        <h1 id="customer-bookings-title">Your bookings.</h1>
        <p className="intro">Hello {user?.name}. Review your booking requests and their status.</p>
        <p className="dashboard-links"><Link to="/services">Browse services</Link></p>
        {(error || authError) && <p className="form-error" role="alert">{error ?? authError}</p>}
        {loading && <p role="status">Loading your bookings…</p>}
        {!loading && bookings.length === 0 && <p className="empty-state">You don’t have any bookings yet.</p>}
        <div className="service-list">
          {bookings.map((booking) => (
            <article className="service-card" key={booking.id}>
              <div className="service-card__heading">
                <div>
                  <p className="service-category">Booking #{booking.id} · {booking.status}</p>
                  <h2>{booking.service_name}</h2>
                </div>
                <p className="service-price">${Number(booking.price).toFixed(2)}</p>
              </div>
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
        <button className="secondary-button signout-button" type="button" onClick={() => void handleLogout()}>
          Sign out
        </button>
      </section>
    </main>
  )
}
