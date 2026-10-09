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
import { ThemeToggle } from './theme/ThemeContext'

function WelcomePage() {
  const { user, loading } = useAuth()

  return (
    <main className="home-page">
      <header className="home-header">
        <Link className="home-brand" to="/" aria-label="BookEase home">
          <span className="home-brand__icon" aria-hidden="true">B</span>BookEase
        </Link>
        <nav className="home-nav" aria-label="Main navigation">
          <Link to="/services">Find services</Link>
          {!loading && user && <Link className="home-nav__primary" to={`/${user.role}`}>My dashboard</Link>}
          {!loading && !user && <>
            <Link to="/login">Sign in</Link>
            <Link className="home-nav__primary" to="/register">Create account</Link>
          </>}
        </nav>
      </header>

      <section className="home-hero" aria-labelledby="welcome-title">
        <div className="home-hero__copy">
          <p className="home-eyebrow"><span /> BOOK. PAY. ENJOY.</p>
          <h1 id="welcome-title">A simpler way to book services.</h1>
          <p className="home-hero__description">
            Discover trusted local professionals, find a time that works, and book with confidence.
            Your appointment details and payment receipt stay together in one place.
          </p>
          <form className="home-search" action="/services" method="get" role="search">
            <label className="sr-only" htmlFor="home-service-search">What service are you looking for?</label>
            <input id="home-service-search" type="search" name="search" placeholder="What service are you looking for?" />
            <button type="submit">Search services</button>
          </form>
          <div className="home-categories" aria-label="Popular categories">
            <span>Explore</span>
            <Link to="/services?search=Fashion">Fashion</Link>
            <Link to="/services?search=Beauty">Beauty</Link>
            <Link to="/services?search=Wellness">Wellness</Link>
          </div>
          <div className="home-trust">
            <span className="home-trust__icon" aria-hidden="true">✓</span>
            <p><strong>Book with confidence</strong><small>Clear appointment details, secure checkout, and receipts you can access anytime.</small></p>
          </div>
        </div>

        <div className="home-hero__visual" aria-label="How BookEase booking works">
          <div className="home-booking-card">
            <div className="home-booking-card__heading">
              <span className="home-booking-card__symbol" aria-hidden="true">B</span>
              <span><strong>Booking made simple</strong><small>Your service, all in one place</small></span>
              <span className="home-booking-card__dots" aria-hidden="true">•••</span>
            </div>
            <div className="home-booking-card__timeline">
              <div className="home-timeline-step home-timeline-step--complete"><span>1</span><div><strong>Choose a service</strong><small>Browse local professionals</small></div><i>✓</i></div>
              <div className="home-timeline-line" />
              <div className="home-timeline-step home-timeline-step--complete"><span>2</span><div><strong>Pick a time</strong><small>Request an appointment</small></div><i>✓</i></div>
              <div className="home-timeline-line" />
              <div className="home-timeline-step"><span>3</span><div><strong>Pay securely</strong><small>Checkout powered by Paystack</small></div></div>
            </div>
            <div className="home-booking-card__footer"><span className="home-secure-icon" aria-hidden="true">✓</span><span><strong>Ready when you are</strong><small>Start by finding a service nearby.</small></span></div>
          </div>
          <div className="home-floating-note"><span aria-hidden="true">✦</span><div><strong>Made for your schedule</strong><small>Find a time that works for you</small></div></div>
          <span className="home-visual-orbit home-visual-orbit--one" aria-hidden="true" />
          <span className="home-visual-orbit home-visual-orbit--two" aria-hidden="true" />
        </div>
      </section>

      <section className="home-how" aria-labelledby="home-how-title">
        <div className="home-section-heading">
          <div><p className="home-eyebrow">A BETTER WAY TO BOOK</p><h2 id="home-how-title">From search to service in three steps</h2></div>
          <Link to="/services">Explore the directory <span aria-hidden="true">→</span></Link>
        </div>
        <div className="home-steps">
          <article className="home-step"><span className="home-step__number">01</span><div><h3>Find your service</h3><p>Search local businesses by service, category, or provider.</p></div><span className="home-step__arrow" aria-hidden="true">↗</span></article>
          <article className="home-step"><span className="home-step__number">02</span><div><h3>Choose a time and pay</h3><p>Request a time that fits. Complete payment securely at checkout.</p></div><span className="home-step__arrow" aria-hidden="true">↗</span></article>
          <article className="home-step"><span className="home-step__number">03</span><div><h3>Stay in the know</h3><p>Track booking updates and find your receipt in your account.</p></div><span className="home-step__arrow" aria-hidden="true">↗</span></article>
        </div>
      </section>

      <section className="home-vendor-cta">
        <div><p className="home-eyebrow">FOR LOCAL PROFESSIONALS</p><h2>Ready to grow your business?</h2><p>Create a vendor account to publish your services and manage booking requests in one place.</p></div>
        {!loading && user?.role === 'vendor'
          ? <Link to="/vendor">Open vendor dashboard <span aria-hidden="true">→</span></Link>
          : <Link to="/register">Create a vendor account <span aria-hidden="true">→</span></Link>}
      </section>

      <footer className="home-footer">
        <Link className="home-brand" to="/"><span className="home-brand__icon" aria-hidden="true">B</span>BookEase</Link>
        <span>Book local. Book with confidence.</span>
        <Link to="/services">Browse services</Link>
      </footer>
    </main>
  )
}

function App() {
  const roles: UserRole[] = ['admin', 'vendor', 'customer']

  return (
    <>
      <ThemeToggle />
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
    </>
  )
}

export default App
