import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Lock, Mail, AlertCircle } from 'lucide-react'
import PinLogo from '../components/shared/PinLogo'

const DEMO_EMAIL    = import.meta.env.VITE_DEMO_EMAIL
const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD
const SHOW_DEMO     = import.meta.env.DEV && !!DEMO_EMAIL && !!DEMO_PASSWORD

export default function LoginPage() {
  const { login }  = useAuth()
  const navigate   = useNavigate()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  async function handleDemoLogin() {
    setError('')
    setLoading(true)
    try {
      await login(DEMO_EMAIL, DEMO_PASSWORD)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Demo login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(160deg, #0d1523 0%, #0B1320 60%, #130a0a 100%)' }}
    >
      {/* Background subtle red glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(229,57,53,0.10) 0%, transparent 70%)',
        }}
      />

      <div className="w-full max-w-sm relative">

        {/* ── Brand header ── */}
        <div className="text-center mb-8">
          {/* Shield logo */}
          <div className="flex justify-center mb-5">
            <div
              className="rounded-2xl p-2"
              style={{ background: 'rgba(229,57,53,0.08)', border: '1px solid rgba(229,57,53,0.15)' }}
            >
              <PinLogo size={72} />
            </div>
          </div>

          {/* Wordmark */}
          <div className="relative inline-block">
            <h1
              className="text-white font-extrabold tracking-tight"
              style={{ fontSize: 36, fontFamily: "'Sora', sans-serif", lineHeight: 1 }}
            >
              pin
            </h1>
            {/* Red diamond over "i" dot */}
            <span
              className="absolute"
              style={{
                width: 7, height: 7,
                background: '#E53935',
                transform: 'rotate(45deg)',
                top: -2,
                left: '0.61em',
                borderRadius: 1,
              }}
            />
          </div>

          {/* — CRM — */}
          <div className="flex items-center justify-center gap-2 mt-2">
            <span style={{ height: 1.5, width: 22, background: '#E53935', display: 'block' }} />
            <span
              className="font-bold tracking-[0.35em]"
              style={{ fontSize: 11, color: '#E53935', fontFamily: "'Sora', sans-serif" }}
            >
              CRM
            </span>
            <span style={{ height: 1.5, width: 22, background: '#E53935', display: 'block' }} />
          </div>

          <p
            className="text-slate-500 tracking-widest"
            style={{ fontSize: 9, marginTop: 6, fontFamily: "'Sora', sans-serif" }}
          >
            BY TRIPLE SHIELD
          </p>
          <p className="text-slate-400 text-sm mt-5">Sign in to your account</p>
        </div>

        {/* ── Login card ── */}
        <div
          className="rounded-2xl p-6"
          style={{
            background: 'rgba(20,29,45,0.80)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(229,57,53,0.12)',
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-slate-400 text-xs font-medium block mb-1.5">Email</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@pin-crm.io"
                  required
                  className="w-full bg-white/5 border border-white/8 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none transition-all"
                  style={{ '--tw-ring-color': '#E53935' }}
                  onFocus={e => e.target.style.borderColor = 'rgba(229,57,53,0.5)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
                />
              </div>
            </div>

            <div>
              <label className="text-slate-400 text-xs font-medium block mb-1.5">Password</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-white/5 border border-white/8 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none transition-all"
                  onFocus={e => e.target.style.borderColor = 'rgba(229,57,53,0.5)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
                <AlertCircle size={13} className="flex-shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 disabled:opacity-60 disabled:cursor-not-allowed rounded-xl text-sm font-bold text-white transition-all"
              style={{
                background: loading ? '#9B1B1A' : 'linear-gradient(135deg, #E53935 0%, #C41E1B 100%)',
                boxShadow: '0 4px 20px rgba(229,57,53,0.30)',
                fontFamily: "'Sora', sans-serif",
                letterSpacing: '0.04em',
              }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          {SHOW_DEMO && (
            <div className="mt-5 pt-4 border-t border-white/5">
              <p className="text-slate-500 text-[11px] text-center mb-2.5">Development only</p>
              <button
                type="button"
                onClick={handleDemoLogin}
                disabled={loading}
                className="w-full text-[11px] bg-white/4 hover:bg-white/8 border border-white/8 rounded-lg px-3 py-2 text-slate-400 transition-all disabled:opacity-50"
              >
                Sign in as demo user
              </button>
            </div>
          )}
        </div>

        {/* Tagline */}
        <p className="text-center text-slate-600 text-[10px] tracking-widest mt-6" style={{ fontFamily: "'Sora', sans-serif" }}>
          ALL YOUR CUSTOMERS. IN THE RIGHT PLACE.
        </p>
      </div>
    </div>
  )
}
