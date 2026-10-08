import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { formatCurrency } from '../services/catalog'
import { getApiErrorMessage } from '../services/apiError'
import {
  getAdminOverview,
  getAdminRecords,
  moderateAdminBooking,
  setAdminServiceVisible,
  setAdminUserActive,
} from '../services/admin'
import type {
  AdminBooking,
  AdminOverview,
  AdminPagination,
  AdminRecord,
  AdminSection,
  AdminService,
  AdminUser,
  AdminVendor,
} from '../services/admin'

const sections: { id: AdminSection; label: string }[] = [
  { id: 'users', label: 'Users' },
  { id: 'vendors', label: 'Vendors' },
  { id: 'services', label: 'Services' },
  { id: 'bookings', label: 'Bookings' },
]

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    .format(new Date(value))
}

export function AdminDashboardPage() {
  const { user, error: authError, logout } = useAuth()
  const navigate = useNavigate()
  const [section, setSection] = useState<AdminSection>('users')
  const [page, setPage] = useState(1)
  const [records, setRecords] = useState<AdminRecord[]>([])
  const [pagination, setPagination] = useState<AdminPagination | null>(null)
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [overviewError, setOverviewError] = useState<string | null>(null)
  const [overviewLoading, setOverviewLoading] = useState(true)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const recordsRequestId = useRef(0)

  const loadRecords = useCallback(async () => {
    const requestId = ++recordsRequestId.current
    setLoading(true)
    setError(null)
    try {
      const result = await getAdminRecords<AdminRecord>(section, page)
      if (requestId === recordsRequestId.current) {
        setRecords(result.data)
        setPagination(result.meta)
      }
    } catch (requestError: unknown) {
      if (requestId === recordsRequestId.current) {
        setError(getApiErrorMessage(requestError))
      }
    } finally {
      if (requestId === recordsRequestId.current) setLoading(false)
    }
  }, [page, section])

  useEffect(() => {
    void loadRecords()
  }, [loadRecords])

  useEffect(() => {
    let active = true
    getAdminOverview()
      .then((result) => {
        if (active) setOverview(result)
      })
      .catch((requestError: unknown) => {
        if (active) setOverviewError(getApiErrorMessage(requestError))
      })
      .finally(() => {
        if (active) setOverviewLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  async function performAction(action: () => Promise<void>, successMessage: string) {
    setSubmitting(true)
    setError(null)
    setNotice(null)
    try {
      await action()
      setNotice(successMessage)
      await loadRecords()
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

  function selectSection(nextSection: AdminSection) {
    recordsRequestId.current += 1
    setSection(nextSection)
    setPage(1)
    setRecords([])
    setPagination(null)
    setLoading(true)
    setError(null)
    setNotice(null)
  }

  const sectionDescription: Record<AdminSection, string> = {
    users: 'Manage platform access and review registered accounts.',
    vendors: 'Review provider profiles and their published service counts.',
    services: 'Control which service listings are visible to customers.',
    bookings: 'Review booking activity and moderate pending requests.',
  }

  return (
    <main className="page admin-page">
      <section className="welcome-card catalog-card admin-card" aria-labelledby="admin-title">
        <header className="admin-header">
          <Link className="brand-link" to="/">BookEase</Link>
          <div className="admin-header__account">
            <span>{user?.name}</span>
            <button className="secondary-button" type="button" onClick={() => void handleLogout()}>
              Sign out
            </button>
          </div>
        </header>
        <div className="admin-intro">
          <p className="eyebrow">BOOKEASE · ADMINISTRATION</p>
          <h1 id="admin-title">Platform overview</h1>
          <p className="intro">Monitor platform activity and manage accounts, providers, services, and bookings.</p>
        </div>
        <section className="admin-overview" aria-label="Platform summary">
          {overviewLoading && <p role="status">Loading platform summary…</p>}
          {overview && (
            <>
              <article className="admin-stat admin-stat--users">
                <span>Total users</span>
                <strong>{overview.users_total.toLocaleString()}</strong>
                <small>Registered accounts</small>
              </article>
              <article className="admin-stat admin-stat--active">
                <span>Active users</span>
                <strong>{overview.users_active.toLocaleString()}</strong>
                <small>Enabled accounts</small>
              </article>
              <article className="admin-stat admin-stat--vendors">
                <span>Vendors</span>
                <strong>{overview.vendors_total.toLocaleString()}</strong>
                <small>Provider profiles</small>
              </article>
              <article className="admin-stat admin-stat--services">
                <span>Published services</span>
                <strong>{overview.services_published.toLocaleString()}</strong>
                <small>Visible to customers</small>
              </article>
              <article className="admin-stat admin-stat--bookings">
                <span>Pending bookings</span>
                <strong>{overview.bookings_pending.toLocaleString()}</strong>
                <small>Awaiting a decision</small>
              </article>
            </>
          )}
        </section>
        <nav className="admin-tabs" aria-label="Administration sections">
          {sections.map((item) => (
            <button key={item.id} type="button"
              className={`admin-tab${section === item.id ? ' admin-tab--active' : ''}`}
              aria-current={section === item.id ? 'page' : undefined}
              onClick={() => selectSection(item.id)}>
              {item.label}
            </button>
          ))}
        </nav>
        <section className="admin-section">
          <div className="admin-section-heading">
            <div>
              <p className="eyebrow">MANAGE PLATFORM</p>
              <h2>{sections.find((item) => item.id === section)?.label}</h2>
              <p>{sectionDescription[section]}</p>
            </div>
            {pagination && <span className="admin-total">{pagination.total.toLocaleString()} records</span>}
          </div>
        {(error || authError || overviewError) && (
          <p className="form-error" role="alert">{error ?? authError ?? overviewError}</p>
        )}
        {notice && <p className="success-message" role="status">{notice}</p>}
        {loading && <p role="status">Loading {section}…</p>}
        {!loading && records.length === 0 && <p className="empty-state">No {section} to display.</p>}

        <div className="admin-record-list" aria-busy={loading}>
          {section === 'users' && (records as AdminUser[]).map((record) => (
            <article className="service-card admin-record" key={record.id}>
              <div>
                <p className="service-category">{record.role} · {record.is_active ? 'Active' : 'Disabled'}</p>
                <h3>{record.name}</h3>
                <p>{record.email}</p>
                <p className="service-meta">Joined {formatDate(record.created_at)}</p>
              </div>
              {record.id === user?.id
                ? <span className="admin-self-label">You</span>
                : <button className="secondary-button" type="button" disabled={submitting}
                  onClick={() => void performAction(
                    () => setAdminUserActive(record.id, !record.is_active),
                    `Account ${record.is_active ? 'disabled' : 'enabled'}.`,
                  )}>{record.is_active ? 'Disable account' : 'Enable account'}</button>}
            </article>
          ))}

          {section === 'vendors' && (records as AdminVendor[]).map((record) => (
            <article className="service-card" key={record.id}>
              <p className="service-category">{record.services_count} services · {record.location ?? 'No location'}</p>
              <h3>{record.business_name}</h3>
              {record.description && <p>{record.description}</p>}
              {record.user && <p className="service-meta">
                Owner: {record.user.name} · {record.user.email} · {record.user.is_active ? 'Active' : 'Disabled'}
              </p>}
            </article>
          ))}

          {section === 'services' && (records as AdminService[]).map((record) => (
            <article className="service-card admin-record" key={record.id}>
              <div>
                <p className="service-category">{record.category} · {record.is_active ? 'Published' : 'Hidden'}</p>
                <h3>{record.name}</h3>
                <p>{record.business_name ?? 'Vendor unavailable'} · {formatCurrency(record.price)}</p>
              </div>
              <button className="secondary-button" type="button" disabled={submitting}
                onClick={() => void performAction(
                  () => setAdminServiceVisible(record.id, !record.is_active),
                  `Service ${record.is_active ? 'hidden' : 'published'}.`,
                )}>{record.is_active ? 'Hide listing' : 'Publish listing'}</button>
            </article>
          ))}

          {section === 'bookings' && (records as AdminBooking[]).map((record) => (
            <article className="service-card admin-record" key={record.id}>
              <div>
                <p className="service-category">Booking #{record.id} · {record.status}</p>
                <h3>{record.service_name}</h3>
                <p>{record.business_name} · {record.customer_name ?? 'Customer'} ({record.customer_email ?? 'no email'})</p>
                <p className="service-meta">{formatDate(record.starts_at)} · {formatCurrency(record.price)}</p>
                <p className="service-meta">Payment: {record.payment_status}</p>
              </div>
              {['pending', 'confirmed'].includes(record.status) && (
                <div className="form-actions">
                  <button className="secondary-button" type="button" disabled={submitting}
                    onClick={() => void performAction(
                      () => moderateAdminBooking(record.id, 'cancelled'),
                      'Booking cancelled.',
                    )}>Cancel</button>
                  {record.status === 'pending' && (
                    <button className="secondary-button" type="button" disabled={submitting}
                      onClick={() => void performAction(
                        () => moderateAdminBooking(record.id, 'rejected'),
                        'Booking rejected.',
                      )}>Reject</button>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>

        {pagination && pagination.last_page > 1 && (
          <div className="admin-pagination">
            <button className="secondary-button" type="button" disabled={page <= 1 || loading}
              onClick={() => setPage((current) => current - 1)}>Previous</button>
            <span>Page {pagination.current_page} of {pagination.last_page}</span>
            <button className="secondary-button" type="button"
              disabled={page >= pagination.last_page || loading}
              onClick={() => setPage((current) => current + 1)}>Next</button>
          </div>
        )}
        </section>
      </section>
    </main>
  )
}
