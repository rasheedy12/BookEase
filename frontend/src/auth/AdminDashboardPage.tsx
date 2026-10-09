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

function AdminIcon({ name }: { name: 'grid' | 'users' | 'store' | 'scissors' | 'calendar' | 'check' | 'clock' }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, strokeWidth: 1.8 }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" {...common}>
      {name === 'grid' && <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>}
      {name === 'users' && <><path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20" /><circle cx="10" cy="8" r="3.5" /><path d="M16 4.7a3.5 3.5 0 0 1 0 6.6M20 20v-1.5a3.5 3.5 0 0 0-2.6-3.4" /></>}
      {name === 'store' && <><path d="M4 10v10h16V10M3 10l2-6h14l2 6" /><path d="M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M9 20v-5h6v5" /></>}
      {name === 'scissors' && <><circle cx="6" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><path d="m8 8 12 12M8 16 20 4M14 10l-2 2" /></>}
      {name === 'calendar' && <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>}
      {name === 'check' && <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>}
      {name === 'clock' && <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>}
    </svg>
  )
}

function bookingsChartPath(values: number[], maximum: number, closeArea = false): string {
  const points = values.map((value, index) => {
    const x = 36 + (index * 744) / Math.max(values.length - 1, 1)
    const y = 190 - (value / maximum) * 160
    return `${x},${y}`
  })
  return closeArea ? `M ${points[0]} L ${points.join(' L ')} L 780,190 L 36,190 Z` : `M ${points.join(' L ')}`
}

export function AdminDashboardPage() {
  const { user, error: authError, logout } = useAuth()
  const navigate = useNavigate()
  const [section, setSection] = useState<AdminSection | 'overview'>('overview')
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
    if (section === 'overview') {
      recordsRequestId.current += 1
      setRecords([])
      setPagination(null)
      setLoading(false)
      return
    }
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

  function selectView(nextSection: AdminSection | 'overview') {
    if (nextSection === section) return
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

  const currentSection = sections.find((item) => item.id === section)
  const chartValues = overview?.bookings_this_week.map((item) => item.count) ?? []
  const chartMaximum = Math.max(...chartValues, 2)

  return (
    <main className="page admin-page admin-dashboard" aria-labelledby="admin-title">
      <aside className="admin-sidebar">
        <Link className="admin-brand" to="/"><span className="admin-brand__icon"><AdminIcon name="calendar" /></span>BookEase</Link>
        <nav className="admin-side-nav" aria-label="Admin navigation">
          <button className={`admin-side-link admin-side-link--overview${section === 'overview' ? ' admin-side-link--active' : ''}`}
            type="button" aria-current={section === 'overview' ? 'page' : undefined} onClick={() => selectView('overview')}>
            <AdminIcon name="grid" />Overview
          </button>
          <span className="admin-side-label">MANAGEMENT</span>
          {sections.map((item) => (
            <button key={item.id} type="button"
              className={`admin-side-link${section === item.id ? ' admin-side-link--active' : ''}`}
              aria-current={section === item.id ? 'page' : undefined}
              onClick={() => selectView(item.id)}>
              <AdminIcon name={item.id === 'users' ? 'users' : item.id === 'vendors' ? 'store' : item.id === 'services' ? 'scissors' : 'calendar'} />
              {item.label}
            </button>
          ))}
        </nav>
        <button className="admin-signout" type="button" onClick={() => void handleLogout()}>Sign out</button>
      </aside>

      <div className="admin-workspace">
        <header className="admin-topbar">
          <div className="admin-breadcrumb">BookEase <span>/</span> Administration</div>
          <div className="admin-profile">
            <span className="admin-profile__avatar">{user?.name?.charAt(0).toUpperCase() ?? 'A'}</span>
            <span><strong>{user?.name ?? 'Administrator'}</strong><small>Admin</small></span>
          </div>
        </header>

        <div className="admin-content">
          <div className="admin-intro">
            <p className="eyebrow">BOOKEASE · ADMINISTRATION</p>
            <h1 id="admin-title">{section === 'overview' ? 'Platform overview' : currentSection?.label}</h1>
            <p className="intro">{section === 'overview'
              ? 'Monitor platform activity and manage accounts, providers, services, and bookings.'
              : sectionDescription[section]}</p>
          </div>

          {(error || authError || (section === 'overview' && overviewError)) && <p className="form-error" role="alert">{error ?? authError ?? overviewError}</p>}
          {notice && <p className="success-message" role="status">{notice}</p>}

          <section className="admin-overview" aria-label="Platform summary" hidden={section !== 'overview'}>
            {overviewLoading && <p role="status">Loading platform summary…</p>}
            {overview && (
              <>
                <article className="admin-stat admin-stat--users"><div><span>Total users</span><AdminIcon name="users" /></div><strong>{overview.users_total.toLocaleString()}</strong><small>Registered accounts</small></article>
                <article className="admin-stat admin-stat--active"><div><span>Active users</span><AdminIcon name="check" /></div><strong>{overview.users_active.toLocaleString()}</strong><small>Enabled accounts</small></article>
                <article className="admin-stat admin-stat--vendors"><div><span>Vendors</span><AdminIcon name="store" /></div><strong>{overview.vendors_total.toLocaleString()}</strong><small>Provider profiles</small></article>
                <article className="admin-stat admin-stat--services"><div><span>Published services</span><AdminIcon name="scissors" /></div><strong>{overview.services_published.toLocaleString()}</strong><small>Visible to customers</small></article>
                <article className="admin-stat admin-stat--bookings"><div><span>Pending bookings</span><AdminIcon name="clock" /></div><strong>{overview.bookings_pending.toLocaleString()}</strong><small>Awaiting a decision</small></article>
              </>
            )}
          </section>

          <section className="admin-chart-card" aria-labelledby="bookings-chart-title" hidden={section !== 'overview'}>
            <div className="admin-chart-heading"><div><h2 id="bookings-chart-title">Bookings this week</h2><p>New bookings created each day</p></div><span className="admin-chart-total">{chartValues.reduce((total, count) => total + count, 0)} total</span></div>
            {overview && (
              <div className="admin-chart">
                <div className="admin-chart__scale"><span>{chartMaximum}</span><span>{Math.round(chartMaximum / 2)}</span><span>0</span></div>
                <svg role="img" aria-label={`Bookings this week: ${overview.bookings_this_week.map(({ day, count }) => `${day} ${count}`).join(', ')}`} viewBox="0 0 800 220" preserveAspectRatio="none">
                  <path className="admin-chart__grid" d="M36 30H780 M36 110H780 M36 190H780" />
                  <path className="admin-chart__area" d={bookingsChartPath(chartValues, chartMaximum, true)} />
                  <path className="admin-chart__line" d={bookingsChartPath(chartValues, chartMaximum)} />
                  {chartValues.map((value, index) => {
                    const x = 36 + (index * 744) / Math.max(chartValues.length - 1, 1)
                    const y = 190 - (value / chartMaximum) * 160
                    return <circle className="admin-chart__point" key={overview.bookings_this_week[index].day} cx={x} cy={y} r="4.5"><title>{overview.bookings_this_week[index].day}: {value} bookings</title></circle>
                  })}
                </svg>
                <div className="admin-chart__days">{overview.bookings_this_week.map((item) => <span key={item.day}>{item.day}</span>)}</div>
              </div>
            )}
            {overviewLoading && <p role="status">Loading booking activity…</p>}
          </section>

          <section className="admin-section" hidden={section === 'overview'}>
            <div className="admin-section-heading">
              <div><p className="eyebrow">MANAGE PLATFORM</p><h2>{currentSection?.label}</h2><p>{section !== 'overview' ? sectionDescription[section] : ''}</p></div>
              {pagination && <span className="admin-total">{pagination.total.toLocaleString()} records</span>}
            </div>
            {section !== 'overview' && loading && <p role="status">Loading {section}…</p>}
            {section !== 'overview' && !loading && records.length === 0 && <p className="empty-state">No {section} to display.</p>}

            {section !== 'overview' && !loading && records.length > 0 && (
              <div className="admin-table-wrap" aria-busy={loading}>
                <table className="admin-table">
                  {section === 'users' && <><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th /></tr></thead><tbody>
                    {(records as AdminUser[]).map((record) => <tr key={record.id}><td className="admin-table__primary">{record.name}</td><td>{record.email}</td><td>{record.role}</td><td><span className={`admin-status${record.is_active ? ' admin-status--active' : ''}`}>{record.is_active ? 'Active' : 'Disabled'}</span></td><td>{formatDate(record.created_at)}</td><td>{record.id === user?.id ? <span className="admin-self-label">You</span> : <button className="admin-action" type="button" disabled={submitting} onClick={() => void performAction(() => setAdminUserActive(record.id, !record.is_active), `Account ${record.is_active ? 'disabled' : 'enabled'}.`)}>{record.is_active ? 'Disable' : 'Enable'}</button>}</td></tr>)}
                  </tbody></>}
                  {section === 'vendors' && <><thead><tr><th>Business</th><th>Owner</th><th>Services</th><th>Location</th></tr></thead><tbody>
                    {(records as AdminVendor[]).map((record) => <tr key={record.id}><td className="admin-table__primary">{record.business_name}</td><td>{record.user ? <>{record.user.name}<small>{record.user.email}</small></> : 'Owner unavailable'}</td><td>{record.services_count}</td><td>{record.location ?? '—'}</td></tr>)}
                  </tbody></>}
                  {section === 'services' && <><thead><tr><th>Service</th><th>Vendor</th><th>Price</th><th>Status</th><th /></tr></thead><tbody>
                    {(records as AdminService[]).map((record) => <tr key={record.id}><td className="admin-table__primary">{record.name}<small>{record.category}</small></td><td>{record.business_name ?? 'Vendor unavailable'}</td><td>{formatCurrency(record.price)}</td><td><span className={`admin-status${record.is_active ? ' admin-status--active' : ''}`}>{record.is_active ? 'Published' : 'Hidden'}</span></td><td><button className="admin-action" type="button" disabled={submitting} onClick={() => void performAction(() => setAdminServiceVisible(record.id, !record.is_active), `Service ${record.is_active ? 'hidden' : 'published'}.`)}>{record.is_active ? 'Hide' : 'Publish'}</button></td></tr>)}
                  </tbody></>}
                  {section === 'bookings' && <><thead><tr><th>Service</th><th>Customer</th><th>Vendor</th><th>Appointment</th><th>Payment</th><th>Status</th><th /></tr></thead><tbody>
                    {(records as AdminBooking[]).map((record) => <tr key={record.id}><td className="admin-table__primary">{record.service_name}<small>Booking #{record.id} · {formatCurrency(record.price)}</small></td><td>{record.customer_name ?? 'Customer'}<small>{record.customer_email ?? 'No email'}</small></td><td>{record.business_name}</td><td>{formatDate(record.starts_at)}</td><td>{record.payment_status}</td><td><span className="admin-status">{record.status}</span></td><td>{['pending', 'confirmed'].includes(record.status) && <div className="admin-table__actions"><button className="admin-action" type="button" disabled={submitting} onClick={() => void performAction(() => moderateAdminBooking(record.id, 'cancelled'), 'Booking cancelled.')}>Cancel</button>{record.status === 'pending' && <button className="admin-action" type="button" disabled={submitting} onClick={() => void performAction(() => moderateAdminBooking(record.id, 'rejected'), 'Booking rejected.')}>Reject</button>}</div>}</td></tr>)}
                  </tbody></>}
                </table>
              </div>
            )}
            {section !== 'overview' && pagination && pagination.last_page > 1 && <div className="admin-pagination"><button className="admin-action" type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}>Previous</button><span>Page {pagination.current_page} of {pagination.last_page}</span><button className="admin-action" type="button" disabled={page >= pagination.last_page || loading} onClick={() => setPage((current) => current + 1)}>Next</button></div>}
          </section>
        </div>
      </div>
    </main>
  )
}
