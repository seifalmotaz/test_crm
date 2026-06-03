import { useState } from 'react'
import { Search, LogOut, Settings, Menu } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LanguageContext'
import { useTheme } from '../context/ThemeContext'
import { useNavigate } from 'react-router-dom'
import SettingsPanel from './SettingsPanel'
import NotificationsPanel from './NotificationsPanel'

export default function Header({ onMenuClick }) {
  const { user, logout }         = useAuth()
  const { t }                    = useLang()
  const { theme }                = useTheme()
  const navigate                 = useNavigate()
  const [settingsOpen, setSettingsOpen]       = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const isLight = theme === 'light'

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  const initials = user?.email
    ? user.email.split('@')[0].split('.').map(s => s[0]?.toUpperCase()).join('').slice(0, 2)
    : 'U'

  const headerBg     = isLight ? 'rgba(255,255,255,0.92)' : 'rgba(20,29,45,0.60)'
  const headerBorder = isLight ? '1px solid #e5e7eb'      : '1px solid rgba(229,57,53,0.08)'
  const btnBase      = isLight
    ? 'bg-black/5 border border-black/8 text-gray-500 hover:text-gray-900 hover:bg-black/8'
    : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
  const inputBg      = isLight
    ? 'bg-black/5 border border-black/8 text-gray-700 placeholder-gray-400 focus:bg-black/8'
    : 'bg-white/5 border border-white/10 text-slate-300 placeholder-slate-500 focus:bg-white/8'

  return (
    <>
      <header
        className="flex items-center justify-between px-4 sm:px-6 py-4 gap-3 backdrop-blur-sm"
        style={{ background: headerBg, borderBottom: headerBorder }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onMenuClick}
            className={`md:hidden w-9 h-9 flex-shrink-0 rounded-xl flex items-center justify-center transition-all ${btnBase}`}
          >
            <Menu size={16} />
          </button>
          <div className="relative hidden sm:block">
            <Search size={16} className={`absolute start-3 top-1/2 -translate-y-1/2 ${isLight ? 'text-gray-400' : 'text-slate-400'}`} />
            <input
              type="text"
              placeholder={t('header.searchPlaceholder')}
              className={`rounded-xl ps-9 pe-4 py-2 text-sm w-48 md:w-72 focus:outline-none transition-all ${inputBg}`}
              onFocus={e => { e.target.style.borderColor = 'rgba(229,57,53,0.40)' }}
              onBlur={e => { e.target.style.borderColor = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.10)' }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {/* Bell */}
          <NotificationsPanel />

          {/* Settings */}
          <div className="relative">
            <button
              onClick={() => setSettingsOpen(v => !v)}
              title={t('header.settings')}
              className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all ${
                settingsOpen
                  ? 'border-[#E53935]/40 text-[#E53935]'
                  : btnBase
              }`}
              style={settingsOpen ? { background: 'rgba(229,57,53,0.10)' } : {}}
            >
              <Settings size={16} />
            </button>
            {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
          </div>

          {/* User avatar + name */}
          <div className="flex items-center gap-2 ms-1">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{
                background: 'rgba(229,57,53,0.15)',
                border: '1px solid rgba(229,57,53,0.30)',
                color: '#E53935',
              }}
            >
              {initials}
            </div>
            <div className="hidden sm:block">
              <p style={{ color: isLight ? '#0B1320' : '#f1f5f9', fontSize: 14, fontWeight: 500, lineHeight: 1.2 }}>
                {user?.email?.split('@')[0] || 'User'}
              </p>
              <p style={{ color: isLight ? '#6b7280' : '#64748b', fontSize: 12, lineHeight: 1.2, textTransform: 'capitalize' }}>
                {user?.role || ''}
              </p>
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={() => setConfirmLogout(true)}
            title={t('header.signOut')}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:text-[#E53935] hover:bg-[#E53935]/10 ${btnBase}`}
          >
            <LogOut size={15} />
          </button>
        </div>
      </header>

      {/* Logout confirmation modal */}
      {confirmLogout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div
            className="rounded-2xl p-6 w-80 flex flex-col gap-4 shadow-2xl"
            style={{ background: isLight ? '#ffffff' : '#1e293b', border: isLight ? '1px solid #e5e7eb' : '1px solid rgba(255,255,255,0.08)' }}
          >
            <div className="flex flex-col gap-1">
              <p style={{ color: isLight ? '#0B1320' : '#f1f5f9', fontWeight: 600, fontSize: 16 }}>
                {t('header.signOut')}
              </p>
              <p style={{ color: isLight ? '#6b7280' : '#94a3b8', fontSize: 14 }}>
                هل أنت متأكد أنك تريد تسجيل الخروج؟
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmLogout(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                style={{ background: isLight ? '#f3f4f6' : 'rgba(255,255,255,0.08)', color: isLight ? '#374151' : '#94a3b8' }}
              >
                إلغاء
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-all"
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
