import { Component, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './App.css'
import { AuthProvider, useAuth } from './context/AuthContext'
import { LanguageProvider } from './context/LanguageContext'
import { ThemeProvider } from './context/ThemeContext'
import { ChatProvider } from './context/ChatContext'
import ChatButton from './components/chat/ChatButton'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex h-screen items-center justify-center bg-navy-900 p-8">
          <div className="max-w-lg w-full bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-center">
            <p className="text-red-400 font-semibold mb-2">Something went wrong</p>
            <p className="text-slate-400 text-sm mb-4">{this.state.error?.message}</p>
            <button
              onClick={() => { this.setState({ error: null }); window.location.href = '/dashboard' }}
              className="px-4 py-2 bg-blue-500 rounded-xl text-sm text-white font-medium hover:bg-blue-600 transition-all"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import PropertiesPage from './pages/PropertiesPage'
import LeadsPage from './pages/LeadsPage'
import DealsPage from './pages/DealsPage'
import AgentsPage from './pages/AgentsPage'
import ClientsPage from './pages/ClientsPage'
import TasksPage from './pages/TasksPage'
import AnalyticsPage from './pages/AnalyticsPage'
import SecurityPanel from './components/SecurityPanel'
import HelpPage from './pages/HelpPage'

function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  return (
    <div className="flex h-screen bg-navy-900 overflow-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header onMenuClick={() => setSidebarOpen(v => !v)} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
      <ChatButton />
    </div>
  )
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-navy-900">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return <Layout>{children}</Layout>
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard"   element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/properties"  element={<ProtectedRoute><PropertiesPage /></ProtectedRoute>} />
      <Route path="/leads"       element={<ProtectedRoute><LeadsPage /></ProtectedRoute>} />
      <Route path="/deals"       element={<ProtectedRoute><DealsPage /></ProtectedRoute>} />
      <Route path="/agents"      element={<ProtectedRoute><AgentsPage /></ProtectedRoute>} />
      <Route path="/clients"     element={<ProtectedRoute><ClientsPage /></ProtectedRoute>} />
      <Route path="/tasks"       element={<ProtectedRoute><TasksPage /></ProtectedRoute>} />
      <Route path="/analytics"   element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
      <Route path="/security"    element={<ProtectedRoute><SecurityPanel /></ProtectedRoute>} />
      <Route path="/help"        element={<ProtectedRoute><HelpPage /></ProtectedRoute>} />
      <Route path="*"            element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <LanguageProvider>
          <ThemeProvider>
            <AuthProvider>
              <ChatProvider>
                <ErrorBoundary>
                  <AppRoutes />
                </ErrorBoundary>
              </ChatProvider>
            </AuthProvider>
          </ThemeProvider>
        </LanguageProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
