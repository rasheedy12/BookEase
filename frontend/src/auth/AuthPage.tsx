import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import type { RegistrationData, UserRole } from '../services/auth'

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { user, loading, error, login, register, clearError } = useAuth()
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const isRegister = mode === 'register'

  if (loading) return <main className="page"><p role="status">Checking your account…</p></main>
  if (user) return <Navigate to={`/${user.role}`} replace />

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearError()
    setSubmitting(true)

    const form = new FormData(event.currentTarget)
    let authenticatedUser

    if (isRegister) {
      const input: RegistrationData = {
        name: String(form.get('name')),
        email: String(form.get('email')),
        password: String(form.get('password')),
        password_confirmation: String(form.get('password_confirmation')),
        role: String(form.get('role')) as Exclude<UserRole, 'admin'>,
      }
      authenticatedUser = await register(input)
    } else {
      authenticatedUser = await login(
        String(form.get('email')),
        String(form.get('password')),
      )
    }

    setSubmitting(false)
    if (authenticatedUser) navigate(`/${authenticatedUser.role}`, { replace: true })
  }

  return (
    <main className="page">
      <section className="welcome-card auth-card" aria-labelledby="auth-title">
        <Link className="brand-link" to="/" aria-label="BookEase home">BookEase</Link>
        <p className="eyebrow">BOOKEASE · {isRegister ? 'CREATE ACCOUNT' : 'WELCOME BACK'}</p>
        <h1 id="auth-title">{isRegister ? 'Join BookEase.' : 'Sign in.'}</h1>
        <p className="intro">
          {isRegister
            ? 'Create an account to book services or offer your expertise.'
            : 'Sign in to continue to your BookEase account.'}
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          {isRegister && (
            <>
              <label htmlFor="name">Full name</label>
              <input id="name" name="name" type="text" autoComplete="name" maxLength={255} required />
            </>
          )}

          <label htmlFor="email">Email address</label>
          <input id="email" name="email" type="email" autoComplete="email" required />

          {isRegister && (
            <>
              <label htmlFor="role">Account type</label>
              <select id="role" name="role" defaultValue="customer">
                <option value="customer">Customer</option>
                <option value="vendor">Vendor</option>
              </select>
            </>
          )}

          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            minLength={isRegister ? 12 : undefined}
            required
          />

          {isRegister && (
            <>
              <label htmlFor="password_confirmation">Confirm password</label>
              <input
                id="password_confirmation"
                name="password_confirmation"
                type="password"
                autoComplete="new-password"
                minLength={12}
                required
              />
              <p className="form-hint">Use at least 12 characters, including letters and numbers.</p>
            </>
          )}

          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="auth-submit" type="submit" disabled={submitting}>
            {submitting ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <p className="auth-switch">
          {isRegister ? 'Already have an account?' : 'New to BookEase?'}{' '}
          <Link to={isRegister ? '/login' : '/register'}>
            {isRegister ? 'Sign in' : 'Create an account'}
          </Link>
        </p>
      </section>
    </main>
  )
}
