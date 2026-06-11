import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Login from './Login'
import Dashboard from './Dashboard'
import History from './History'
import Report from './Report'
import { LayoutDashboard, History as HistoryIcon, FileText, LogOut, Clock, User } from 'lucide-react'

// Layout component with premium responsive navigation
function AppLayout({ children, user }) {
  const location = useLocation()

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'History', path: '/history', icon: HistoryIcon },
    { name: 'Reports', path: '/report', icon: FileText }
  ]

  const isActive = (path) => location.pathname === path

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 pb-20 md:pb-0">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-900 px-4 md:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20">
            <Clock className="w-6 h-6 text-emerald-400" />
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            Overtime Tracker
          </span>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          {navItems.map((item) => (
            <Link
              key={item.name}
              to={item.path}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                isActive(item.path)
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.name}
            </Link>
          ))}
        </nav>

        {/* Logged in User Badge & Logout Button */}
        <div className="flex items-center gap-4">
          <div className="hidden lg:flex items-center gap-2 bg-slate-900/60 border border-slate-800 px-3.5 py-1.5 rounded-full text-slate-400 text-xs font-semibold">
            <User className="w-3.5 h-3.5 text-cyan-400" />
            <span>{user?.email}</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 bg-slate-900 hover:bg-rose-950/20 hover:text-rose-400 hover:border-rose-900/30 text-slate-400 px-4 py-2 rounded-xl text-sm font-semibold border border-slate-800 transition duration-200"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 md:px-8 py-8">
        {children}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/90 backdrop-blur-lg border-t border-slate-900/80 px-4 py-2 flex justify-around items-center">
        {navItems.map((item) => {
          const ActiveIcon = item.icon
          const active = isActive(item.path)
          return (
            <Link
              key={item.name}
              to={item.path}
              className={`flex flex-col items-center gap-1.5 py-1 px-3 rounded-xl transition duration-200 ${
                active? 'text-emerald-400 scale-105' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <ActiveIcon className={`w-5.5 h-5.5 ${active? 'text-emerald-400' : 'text-slate-500'}`} />
              <span className="text-[10px] font-bold tracking-wider">{item.name}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950">
        <div className="relative flex items-center justify-center">
          <div className="w-14 h-14 border-4 border-emerald-500/10 border-t-emerald-400 rounded-full animate-spin"></div>
          <Clock className="w-6 h-6 text-emerald-400 absolute animate-pulse" />
        </div>
        <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest mt-4 animate-pulse">
          Synchronizing VIP Portal...
        </p>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={!session? <Login /> : <Navigate to="/" replace />}
        />

        <Route
          path="/"
          element={
            session? (
              <AppLayout user={session.user}>
                <Dashboard user={session.user} />
              </AppLayout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/history"
          element={
            session? (
              <AppLayout user={session.user}>
                <History user={session.user} />
              </AppLayout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/report"
          element={
            session? (
              <AppLayout user={session.user}>
                <Report user={session.user} />
              </AppLayout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
