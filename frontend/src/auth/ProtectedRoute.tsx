import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthContext'
import type { UserRole } from '../services/auth'

export function ProtectedRoute({ role }: { role: UserRole }) {
  const { user, loading } = useAuth()

  if (loading) return <main className="page"><p role="status">Checking your account…</p></main>
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== role) return <Navigate to={`/${user.role}`} replace />

  return <Outlet />
}
