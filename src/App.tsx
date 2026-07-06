import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LoginPage } from './pages/LoginPage'

// route-level code splitting:首包只留登入頁與外殼,重頁面(管理頁含
// qrcode、超管後台)各自成 chunk,首次載入快很多
const AuthCallback = lazy(() => import('./pages/AuthCallback').then((m) => ({ default: m.AuthCallback })))
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const SessionManagePage = lazy(() => import('./pages/SessionManagePage').then((m) => ({ default: m.SessionManagePage })))
const AdminPage = lazy(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })))
import { ErrorBoundary } from './components/ErrorBoundary'
import { ConnectionBanner } from './components/ConnectionBanner'
import { UpdateBanner } from './components/UpdateBanner'
import { ConfirmProvider } from './components/Confirm'
import { LanguageSwitcher } from './components/LanguageSwitcher'

// real-time comes from the WebSocket; these defaults stop redundant refetch
// storms (every query re-firing on each tab focus) so we don't hammer the API.
const qc = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 10000,
    },
  },
})

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token')
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <ErrorBoundary>
      <ConfirmProvider>
      <LanguageSwitcher />
      <ConnectionBanner />
      <UpdateBanner />
      <BrowserRouter>
        <Suspense fallback={<div className="min-h-screen bg-brand-bg" />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/" element={<RequireAuth><DashboardPage /></RequireAuth>} />
            <Route path="/session/:sessionId" element={<RequireAuth><SessionManagePage /></RequireAuth>} />
            <Route path="/admin" element={<RequireAuth><AdminPage /></RequireAuth>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      </ConfirmProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  )
}
