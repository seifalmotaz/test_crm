import { useState } from 'react'
import { Search, LogOut, Settings, Menu } from 'lucide-react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LanguageContext'
import { useTheme } from '../context/ThemeContext'
import SettingsPanel from './SettingsPanel'
import NotificationsPanel from './NotificationsPanel'

const NAV_PILLS = [
  { label: 'Listings', to: '/properties' },
  { label: 'Clients',  to: '/clients'    },
  { label: 'Reports',  to: '/analytics'  },
]

export default function Header({ onMenuClick }) {
  const { user, logout }              = useAuth()
  const { t }                         = useLang()
  const { theme }                     = useTheme()
  const navigate                      = useNavigate()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const isLight = theme === 'light'

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  const displayName = user?.email?.split('@')[0]?.replace(/[._-]/g, ' ')
    ?.replace(/\b\w/g, c => c.toUpperCase()) || 'User'

  /* ── theme tokens ─────────────────────────────────────────────── */
  const bg         = isLight ? 'rgba(255,255,255,0.96)' : '#0e0e13'
  const border     = isLight ? '1px solid #e5e7eb'      : 'none'
  const pillBg     = isLight ? '#f3f4f6'                : '#1d1d26'
  const pillColor  = isLight ? '#374151'                : '#ffffff'
  const iconBg     = isLight ? '#f3f4f6'                : '#1d1d26'
  const iconColor  = isLight ? '#6b7280'                : 'rgba(255,255,255,0.65)'
  const inputBg    = isLight ? '#f3f4f6'                : '#1d1d26'
  const inputBorder= isLight ? '1px solid #e5e7eb'      : '1px solid rgba(255,255,255,0.07)'
  const inputColor = isLight ? '#374151'                : 'rgba(255,255,255,0.65)'
  const namColor   = isLight ? '#111827'                : '#ffffff'
  const emailColor = isLight ? '#6b7280'                : 'rgba(255,255,255,0.38)'

  return (
    <>
      <header
        style={{
          background: bg,
          borderBottom: border,
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto',
          alignItems: 'center',
          gap: 16,
          padding: '10px 20px',
          backdropFilter: 'blur(8px)',
          position: 'relative',
          zIndex: 20,
        }}
      >
        {/* ── LEFT — mobile hamburger + nav pills ─────────────────── */}
        <div className="flex items-center gap-2">
          {/* Mobile hamburger */}
          <button
            onClick={onMenuClick}
            className="md:hidden w-9 h-9 rounded-full flex items-center justify-center transition-all"
            style={{ background: iconBg, color: iconColor }}
          >
            <Menu size={16} />
          </button>

          {/* Nav pills — desktop only */}
          <div className="hidden md:flex items-center gap-2">
            {NAV_PILLS.map(({ label, to }) => (
              <NavLink
                key={to}
                to={to}
                style={({ isActive }) => ({
                  padding: '7px 20px',
                  borderRadius: 999,
                  fontSize: 14,
                  fontWeight: 500,
                  background: isActive
                    ? (isLight ? '#e5e7eb' : '#2a2a36')
                    : pillBg,
                  color: pillColor,
                  textDecoration: 'none',
                  transition: 'background 0.15s',
                  whiteSpace: 'nowrap',
                })}
              >
                {label}
              </NavLink>
            ))}
          </div>
        </div>

        {/* ── CENTER — search ──────────────────────────────────────── */}
        <div className="flex justify-center">
          <div className="relative w-full" style={{ maxWidth: 460 }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: 16,
                top: '50%',
                transform: 'translateY(-50%)',
                color: isLight ? '#9ca3af' : 'rgba(255,255,255,0.30)',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              placeholder={t('header.searchPlaceholder')}
              style={{
                width: '100%',
                borderRadius: 999,
                padding: '9px 20px 9px 42px',
                background: inputBg,
                border: inputBorder,
                color: inputColor,
                fontSize: 13,
                outline: 'none',
              }}
              onFocus={e  => { e.target.style.borderColor = 'rgba(229,57,53,0.35)' }}
              onBlur={e   => { e.target.style.borderColor = isLight ? '#e5e7eb' : 'rgba(255,255,255,0.07)' }}
            />
          </div>
        </div>

        {/* ── RIGHT — icons + user ─────────────────────────────────── */}
        <div className="flex items-center gap-2.5 justify-end">

          {/* Bell */}
          <NotificationsPanel />

          {/* Settings */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setSettingsOpen(v => !v)}
              title={t('header.settings')}
              style={{
                width: 36, height: 36,
                borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: settingsOpen ? 'rgba(229,57,53,0.15)' : iconBg,
                color: settingsOpen ? '#E53935' : iconColor,
                border: 'none', cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              <Settings size={15} />
            </button>
            {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
          </div>

          {/* User avatar + name + email */}
          <div className="flex items-center gap-2.5" style={{ marginLeft: 4 }}>
            {/* Photo-style avatar */}
            <div
              style={{
                width: 36, height: 36, borderRadius: '50%',
                background: isLight
                  ? 'linear-gradient(145deg,#fca5a5,#f87171)'
                  : 'linear-gradient(145deg,#d4a5c9,#b07cc0,#7a5fa8)',
                border: `2px solid ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.14)'}`,
                position: 'relative', overflow: 'hidden', flexShrink: 0,
              }}
            >
              <svg viewBox="0 0 36 36" width="36" height="36" style={{ position: 'absolute', inset: 0 }}>
                <ellipse cx="18" cy="35" rx="13" ry="9" fill="rgba(255,255,255,0.55)" />
                <rect x="14.5" y="22" width="7" height="6" rx="3"
                  fill={isLight ? 'rgba(254,215,170,0.95)' : 'rgba(255,220,190,0.90)'} />
                <circle cx="18" cy="15" r="8.5"
                  fill={isLight ? 'rgba(254,215,170,0.95)' : 'rgba(255,220,190,0.95)'} />
                <path d="M9.5 14 Q10 5 18 4.5 Q26 5 26.5 14 Q25 8 18 8 Q11 8 9.5 14Z"
                  fill="rgba(50,25,15,0.82)" />
              </svg>
            </div>

            {/* Name + email */}
            <div className="hidden sm:block">
              <p style={{ color: namColor, fontSize: 13, fontWeight: 600, lineHeight: 1.25, whiteSpace: 'nowrap' }}>
                {displayName}
              </p>
              <p style={{ color: emailColor, fontSize: 11, lineHeight: 1.3, whiteSpace: 'nowrap' }}>
                {user?.email || ''}
              </p>
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={() => setConfirmLogout(true)}
            title={t('header.signOut')}
            style={{
              width: 36, height: 36, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: iconBg, color: iconColor,
              border: 'none', cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#E53935'; e.currentTarget.style.background = 'rgba(229,57,53,0.12)' }}
            onMouseLeave={e => { e.currentTarget.style.color = iconColor;  e.currentTarget.style.background = iconBg }}
          >
            <LogOut size={14} />
          </button>
        </div>
      </header>

      {/* ── Logout confirmation ───────────────────────────────────── */}
      {confirmLogout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.55)' }}>
          <div
            className="rounded-2xl p-6 w-80 flex flex-col gap-4 shadow-2xl"
            style={{
              background: isLight ? '#ffffff' : '#18181f',
              border: isLight ? '1px solid #e5e7eb' : '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div className="flex flex-col gap-1">
              <p style={{ color: isLight ? '#111827' : '#f1f5f9', fontWeight: 600, fontSize: 16 }}>
                {t('header.signOut')}
              </p>
              <p style={{ color: isLight ? '#6b7280' : '#94a3b8', fontSize: 14 }}>
                هل أنت متأكد أنك تريد تسجيل الخروج؟
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmLogout(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium"
                style={{ background: isLight ? '#f3f4f6' : 'rgba(255,255,255,0.08)', color: isLight ? '#374151' : '#94a3b8' }}
              >
                إلغاء
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white"
                style={{ background: '#E53935' }}
              >
                تسجيل الخروج
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
