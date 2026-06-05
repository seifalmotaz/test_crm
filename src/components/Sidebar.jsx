import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Building2, BarChart3, Users,
  TrendingUp, Target, Heart, CheckSquare,
  HelpCircle, ShieldCheck, X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LanguageContext'
import { useTheme } from '../context/ThemeContext'
import PinLogo from './shared/PinLogo'

const NAV_KEYS = [
  { icon: LayoutDashboard, key: 'dashboard',  to: '/dashboard',  feature: null },
  { icon: Building2,       key: 'properties', to: '/properties', feature: 'properties' },
  { icon: Target,          key: 'leads',      to: '/leads',      feature: 'leads' },
  { icon: TrendingUp,      key: 'deals',      to: '/deals',      feature: 'deals' },
  { icon: Users,           key: 'agents',     to: '/agents',     feature: 'team' },
  { icon: Heart,           key: 'clients',    to: '/clients',    feature: 'clients' },
  { icon: CheckSquare,     key: 'tasks',      to: '/tasks',      feature: 'tasks' },
  { icon: BarChart3,       key: 'analytics',  to: '/analytics',  feature: 'analytics' },
  { icon: ShieldCheck,     key: 'security',   to: '/security',   feature: 'security' },
  { icon: HelpCircle,      key: 'help',       to: '/help' },
]

export default function Sidebar({ isOpen, onClose }) {
  const { user }       = useAuth()
  const { t, isRTL }   = useLang()
  const { theme }      = useTheme()
  const isLight        = theme === 'light'

  const visibleNavItems = NAV_KEYS.filter(item => {
    if (!item.feature) return true
    if (!user) return false
    if (user.role === 'admin') return true
    return Array.isArray(user.features) && user.features.includes(item.feature)
  })

  const displayName = user
    ? user.email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : ''
  const displayRole = user
    ? (user.role === 'admin' ? t('common.administrator') : user.role.charAt(0).toUpperCase() + user.role.slice(1))
    : ''

  /* ── Light vs dark sidebar tokens ── */
  const sidebarBg     = isLight
    ? 'linear-gradient(180deg, #ffffff 0%, #f9fafb 100%)'
    : '#0e0e13'
  const sidebarBorder = isLight ? '1px solid #e5e7eb' : '1px solid rgba(255,255,255,0.06)'
  const navTextBase   = isLight ? '#4b5563' : ''   // light: explicit gray; dark: via tailwind
  const navTextActive = '#ffffff'
  const navActiveBg   = isLight
    ? 'linear-gradient(135deg, rgba(229,57,53,0.12) 0%, rgba(229,57,53,0.06) 100%)'
    : 'rgba(255,255,255,0.05)'
  const sectionLabel  = isLight ? '#9ca3af' : ''
  const footerText    = isLight ? '#9ca3af' : ''

  return (
    <aside
      className={`
        fixed inset-y-0 start-0 z-50 flex flex-col h-screen w-64
        py-6 px-4
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : isRTL ? 'translate-x-full' : '-translate-x-full'}
        md:relative md:z-auto md:translate-x-0 md:w-60 md:flex-shrink-0
      `}
      style={{ background: sidebarBg, borderInlineEnd: sidebarBorder }}
    >
      {/* ── Logo ── */}
      <div className="mb-8 px-1 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PinLogo size={42} />

          <div className="flex flex-col leading-none select-none">
            <div className="relative inline-block">
              <span
                style={{
                  fontSize: 20,
                  fontFamily: "'Sora', sans-serif",
                  lineHeight: 1,
                  letterSpacing: '-0.02em',
                  color: isLight ? '#0B1320' : '#ffffff',
                  fontWeight: 800,
                }}
              >
                pin
              </span>
              <span
                className="absolute"
                style={{
                  width: 5, height: 5,
                  background: '#E53935',
                  transform: 'rotate(45deg)',
                  top: 0, left: '0.62em',
                  borderRadius: 1,
                }}
              />
            </div>

            <div className="flex items-center gap-1.5 mt-[5px]">
              <span style={{ height: 1.5, width: 8, background: '#E53935', display: 'block' }} />
              <span style={{ fontSize: 8, color: '#E53935', fontFamily: "'Sora', sans-serif", fontWeight: 700, letterSpacing: '0.28em' }}>
                CRM
              </span>
              <span style={{ height: 1.5, width: 8, background: '#E53935', display: 'block' }} />
            </div>

            <span style={{ fontSize: 6.5, marginTop: 3, fontFamily: "'Sora', sans-serif", letterSpacing: '0.15em', color: isLight ? '#9ca3af' : '#4B5563' }}>
              BY TRIPLE SHIELD
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="md:hidden w-7 h-7 flex items-center justify-center rounded-lg transition-all"
          style={{ color: isLight ? '#6b7280' : '#94a3b8', background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.08)' }}
        >
          <X size={16} />
        </button>
      </div>

      {/* ── Welcome ── */}
      <div className="mb-6 px-2">
        <p style={{ color: '#E53935', fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4, opacity: 0.9 }}>
          {t('nav.welcomeBack')}
        </p>
        <p style={{ color: isLight ? '#0B1320' : '#f1f5f9', fontWeight: 600, fontSize: 14 }}>{displayName}</p>
        <p style={{ color: isLight ? '#6b7280' : '#64748b', fontSize: 12 }}>{displayRole}</p>
      </div>

      {/* ── Main Nav ── */}
      <div className="flex-1 overflow-y-auto mb-2 min-h-0">
        <p
          className="px-2 mb-3"
          style={{ color: sectionLabel || '#4B5563', fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase' }}
        >
          {t('nav.mainMenu')}
        </p>
        <nav className="space-y-0.5">
          {visibleNavItems.map(({ icon: Icon, key, to }) =>
            to ? (
              <NavLink
                key={key}
                to={to}
                style={({ isActive }) => isActive ? {
                  background: navActiveBg,
                  borderInlineStart: '2.5px solid #E53935',
                  paddingInlineStart: 10,
                  color: isLight ? '#E53935' : '#ffffff',
                } : {
                  color: navTextBase || undefined,
                }}
                className={({ isActive }) =>
                  `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive ? '' : isLight
                      ? 'text-gray-500 hover:text-gray-900 hover:bg-black/5'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`
                }
              >
                <Icon size={17} />
                {t(`nav.${key}`)}
              </NavLink>
            ) : (
              <button
                key={key}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isLight ? 'text-gray-500 hover:text-gray-900 hover:bg-black/5' : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon size={17} />
                {t(`nav.${key}`)}
              </button>
            )
          )}
        </nav>
      </div>

      {/* ── Footer ── */}
      <div className="px-2 pt-4" style={{ borderTop: `1px solid ${isLight ? '#e5e7eb' : 'rgba(255,255,255,0.05)'}` }}>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#E53935]" />
          <span style={{ color: footerText || '#4B5563', fontSize: 10, letterSpacing: '0.15em', fontWeight: 500 }}>
            TRIPLE SHIELD
          </span>
        </div>
      </div>
    </aside>
  )
}
