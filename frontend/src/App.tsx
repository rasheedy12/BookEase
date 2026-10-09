import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { AuthPage } from './auth/AuthPage'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { useAuth } from './auth/AuthContext'
import type { UserRole } from './services/auth'
import { ServicesPage } from './catalog/ServicesPage'
import { VendorDashboardPage } from './catalog/VendorDashboardPage'
import { CustomerBookingsPage } from './catalog/CustomerBookingsPage'
import { AdminDashboardPage } from './auth/AdminDashboardPage'
import { CustomerReceiptPage } from './catalog/CustomerReceiptPage'

function WelcomePage() {
  const { user, loading } = useAuth()

  return (
    <main className="page">
      <section className="welcome-card" aria-labelledby="welcome-title">
        <div className="brand-mark" aria-hidden="true">B</div>
        <p className="eyebrow">BOOKEASE · BOOK. PAY. ENJOY.</p>
        <h1 id="welcome-title">A simpler way to book services.</h1>
        <p className="intro">
          Discover local services, find a time that works, and book with confidence.
        </p>
        <nav className="home-actions" aria-label="Account">
          <Link className="auth-link" to="/services">Browse services</Link>
          {!loading && user && <Link className="auth-link auth-link--primary" to={`/${user.role}`}>Go to your account</Link>}
          {!loading && !user && (
            <>
              <Link className="auth-link auth-link--primary" to="/register">Create account</Link>
              <Link className="auth-link" to="/login">Sign in</Link>
            </>
          )}
        </nav>
      </section>
    </main>
  )
}

function App() {
  const roles: UserRole[] = ['admin', 'vendor', 'customer']

  return (
    <Routes>
      <Route path="/" element={<WelcomePage />} />
      <Route path="/services" element={<ServicesPage />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      {roles.map((role) => (
        <Route key={role} path={`/${role}`} element={<ProtectedRoute role={role} />}>
          <Route index element={
            role === 'vendor'
              ? <VendorDashboardPage />
              : role === 'customer'
                ? <CustomerBookingsPage />
                : <AdminDashboardPage />
          } />
          {role === 'customer' && (
            <Route path="receipts/:bookingId" element={<CustomerReceiptPage />} />
          )}
        </Route>
      ))}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
