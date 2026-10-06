import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

export function DashboardPage() {
  const { user, error, logout } = useAuth()
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)

  async function handleLogout() {
    setSubmitting(true)
    const loggedOut = await logout()
    setSubmitting(false)
    if (loggedOut) navigate('/', { replace: true })
  }

  if (!user) return null

  return (
    <main className="page">
      <section className="welcome-card" aria-labelledby="dashboard-title">
        <div className="brand-mark" aria-hidden="true">B</div>
        <p className="eyebrow">BOOKEASE · {user.role.toUpperCase()} ACCOUNT</p>
        <h1 id="dashboard-title">Welcome, {user.name}.</h1>
        <p className="intro">
          You’re signed in as a {user.role}. Your role-specific workspace will be
          available as BookEase features are added.
        </p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="auth-submit" type="button" onClick={handleLogout} disabled={submitting}>
          {submitting ? 'Signing out…' : 'Sign out'}
        </button>
      </section>
    </main>
  )
}
