import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from './hooks/useAuth'
import { CustomCursor } from './components/CustomCursor'
import { HomePage } from './pages/HomePage'
import { AuthPage } from './pages/AuthPage'
import { DashboardPage } from './pages/DashboardPage'
import { ProjectListPage } from './pages/ProjectListPage'

/**
 * 🔐 ProtectedRoute Component
 * Redirects unauthenticated users to /auth and shows a 
 * premium loading spinner while checking session state.
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-900 gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full"
        />
        <p className="text-slate-500 text-sm animate-pulse tracking-widest uppercase">
          Verifying Identity
        </p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/auth" replace />
  }

  return <>{children}</>
}

/**
 * ✨ AnimatedRoutes Wrapper
 * Uses useLocation to provide unique keys for Framer Motion 
 * page-fade transitions.
 */
function AnimatedRoutes() {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Public Routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/auth" element={<AuthPage />} />

        {/* Protected Engineering Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <DashboardPage />
              </motion.div>
            </ProtectedRoute>
          }
        />

        <Route
          path="/projects"
          element={
            <ProtectedRoute>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <ProjectListPage />
              </motion.div>
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  )
}

function App() {
  return (
    <Router>
      <div className="bg-slate-900 text-slate-100 min-h-screen">
        {/* Global UI Elements */}
        <CustomCursor />
        
        {/* Navigation Core */}
        <AnimatedRoutes />
      </div>
    </Router>
  )
}

export default App