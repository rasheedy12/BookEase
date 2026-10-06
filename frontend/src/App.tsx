import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { api } from './services/api'

type ApiStatus = 'checking' | 'online' | 'offline'

function WelcomePage() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>('checking')

  useEffect(() => {
    const controller = new AbortController()

    api.get<{ status: string }>('/health', { signal: controller.signal })
      .then(({ data }) => {
        setApiStatus(data.status === 'ok' ? 'online' : 'offline')
      })
      .catch(() => {
        if (controller.signal.aborted) {
          return
        }

        setApiStatus('offline')
      })

    return () => controller.abort()
  }, [])

  return (
    <main className="page">
      <section className="welcome-card" aria-labelledby="welcome-title">
        <div className="brand-mark" aria-hidden="true">B</div>
        <p className="eyebrow">BOOKEASE · PROJECT SETUP</p>
        <h1 id="welcome-title">A simpler way to book services.</h1>
        <p className="intro">
          The application foundation is ready. This page checks that the
          frontend can reach the Laravel API.
        </p>
        <div className={`status status--${apiStatus}`} role="status">
          <span className="status-indicator" aria-hidden="true" />
          {apiStatus === 'checking' && 'Checking API connection…'}
          {apiStatus === 'online' && 'Laravel API is connected'}
          {apiStatus === 'offline' && 'API is offline — start the Laravel server'}
        </div>
        <p className="endpoint">GET /api/health</p>
      </section>
    </main>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<WelcomePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
