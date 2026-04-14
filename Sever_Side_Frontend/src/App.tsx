// src/App.tsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { motion } from 'framer-motion'

// Authentication
import { AuthProvider, ProtectedRoute } from './contexts/AuthContext'

// Components
import Navigation from './components/Navigation'
import ErrorBoundary from './components/ErrorBoundary'

// Pages
import LandingPage from './Pages/LandingPage'
import CopDashboard from './Pages/CopDashboard'
import AuthCop from './Pages/AuthCop'
import AdminPortal from './Pages/AdminPortal'
import StatsDashboard from './Pages/StatsDashboard'
import CopProfile from './Pages/CopProfile'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      refetchOnWindowFocus: false,
    },
  },
})

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Router>
            <div className="min-h-screen" style={{ backgroundColor: "var(--bg)", color: "var(--text)" }}>
              <Navigation />

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                <Routes>
                  {/* PUBLIC ROUTES */}
                  <Route path="/" element={<LandingPage />} />

                  {/* COP AUTH */}
                  <Route path="/cop/login" element={<AuthCop />} />
                  <Route path="/cop/register" element={<AuthCop />} />

                  {/* COP DASHBOARD */}
                  <Route
                    path="/cop/dashboard"
                    element={
                      <ProtectedRoute requiredRoles={['police', 'admin']}>
                        <CopDashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/cop/stats"
                    element={
                      <ProtectedRoute requiredRoles={['police']}>
                        <StatsDashboard />
                      </ProtectedRoute>
                    }
                  />

                  {/* PROFILE */}
                  <Route
                    path="/profile"
                    element={
                      <ProtectedRoute requiredRoles={['police', 'admin']}>
                        <CopProfile />
                      </ProtectedRoute>
                    }
                  />

                  {/* ADMIN (HIDDEN) */}
                  <Route
                    path="/admin-governance-secret"
                    element={
                      <ProtectedRoute requiredRoles={['admin']}>
                        <AdminPortal />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/stats"
                    element={
                      <ProtectedRoute requiredRoles={['admin']}>
                        <StatsDashboard />
                      </ProtectedRoute>
                    }
                  />

                    {/* Legacy redirects */}
                    <Route path="/login" element={<AuthCop />} />
                  </Routes>
                </motion.div>

                <Toaster
                  position="top-right"
                  toastOptions={{
                    duration: 4000,
                    style: {
                      background: '#000',
                      color: '#fff',
                      border: "1px solid #333",
                    },
                  }}
                />
              </div>
            </Router>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    )
  }

export default App
