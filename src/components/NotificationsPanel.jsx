import { useState, useEffect, useRef, useCallback } from 'react'
import { Bell, X, CheckCheck, TrendingUp, Home, ClipboardList, DollarSign, Calendar, AlertCircle, Megaphone, MessageSquare, ClipboardCheck } from 'lucide-react'
import api from '../lib/api'
import { useTheme } from '../context/ThemeContext'

const TYPE_CFG = {
  HOT_LEAD:           { Icon: TrendingUp,   color: '#ef4444' },
  LEAD_ASSIGNED:      { Icon: TrendingUp,   color: '#3b82f6' },
  DEAL_STAGE:         { Icon: Home,         color: '#10b981' },
  DEAL_CLOSED:        { Icon: Home,         color: '#10b981' },
  DEAL_RISK:          { Icon: AlertCircle,  color: '#f59e0b' },
  COMMISSION_RELEASE: { Icon: DollarSign,   color: '#8b5cf6' },
  OVERDUE_TASK:       { Icon: ClipboardList,color: '#ef4444' },
  CLOSING_SOON:       { Icon: Calendar,     color: '#f59e0b' },
  NEW_LISTING:        { Icon: Home,          color: '#3b82f6' },
  MARKET_UPDATE:      { Icon: Megaphone,     color: '#06b6d4' },
  NEW_MESSAGE:        { Icon: MessageSquare, color: '#8b5cf6' },
  TASK_ASSIGNED:      { Icon: ClipboardCheck,color: '#f59e0b' },
}

function stripHtml(html) {
  return html ? html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : ''
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function NotificationsPanel() {
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const [open, setOpen]                 = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount]   = useState(0)
  const panelRef = useRef(null)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get('/api/notifications?limit=30')
      setNotifications(res.data || [])
      setUnreadCount(res.pagination?.unreadCount ?? 0)
    } catch {
      // user may not have agent profile — stay silent
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
    const id = setInterval(fetchNotifications, 30_000)
    return () => clearInterval(id)
  }, [fetchNotifications])

  useEffect(() => {
    function onOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  async function markRead(id) {
    try {
      await api.patch(`/api/notifications/${id}/read`)
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch {}
  }

  async function markAllRead() {
    try {
      await api.post('/api/notifications/read-all')
      const now = new Date().toISOString()
      setNotifications(prev => prev.map(n => ({ ...n, readAt: n.readAt ?? now })))
      setUnreadCount(0)
    } catch {}
  }

  // ── styles ──────────────────────────────────────────────────────────────────
  const btnBase = isLight
    ? 'bg-black/5 border border-black/8 text-gray-500 hover:text-gray-900 hover:bg-black/8'
    : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10'

  const panelBg      = isLight ? '#ffffff'                  : '#0f1929'
  const borderCol    = isLight ? '#e5e7eb'                  : 'rgba(255,255,255,0.08)'
  const textPrimary  = isLight ? '#0B1320'                  : '#f1f5f9'
  const textMuted    = isLight ? '#6b7280'                  : '#64748b'
  const unreadRowBg  = isLight ? 'rgba(229,57,53,0.05)'     : 'rgba(229,57,53,0.08)'
  const hoverRowBg   = isLight ? 'rgba(0,0,0,0.03)'         : 'rgba(255,255,255,0.04)'

  return (
    <div className="relative" ref={panelRef}>
      {/* ── Bell button ─────────────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(v => !v)}
        className="relative flex items-center justify-center transition-all"
        style={{
          width: 36, height: 36, borderRadius: '50%',
          background: open
            ? 'rgba(229,57,53,0.12)'
            : (isLight ? '#f3f4f6' : '#1d1d26'),
          color: open
            ? '#E53935'
            : (isLight ? '#6b7280' : 'rgba(255,255,255,0.65)'),
          border: 'none',
        }}
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span
            className="absolute flex items-center justify-center bg-[#E53935] rounded-full text-white"
            style={{
              top: unreadCount > 9 ? 2 : 5,
              right: unreadCount > 9 ? 2 : 5,
              minWidth: unreadCount > 9 ? 16 : 8,
              height: unreadCount > 9 ? 14 : 8,
              fontSize: 9,
              fontWeight: 700,
              padding: unreadCount > 9 ? '0 3px' : 0,
            }}
          >
            {unreadCount > 9 ? '9+' : ''}
          </span>
        )}
      </button>

      {/* ── Dropdown panel ──────────────────────────────────────────────────── */}
      {open && (
        <div
          className="absolute end-0 mt-2 w-96 rounded-2xl shadow-2xl z-50 overflow-hidden"
          style={{ background: panelBg, border: `1px solid ${borderCol}` }}
        >
          {/* Header row */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: `1px solid ${borderCol}` }}
          >
            <div className="flex items-center gap-2">
              <span style={{ color: textPrimary, fontWeight: 600, fontSize: 14 }}>
                Notifications
              </span>
              {unreadCount > 0 && (
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-semibold"
                  style={{ background: 'rgba(229,57,53,0.15)', color: '#E53935' }}
                >
                  {unreadCount}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-xs transition-colors hover:text-[#E53935]"
                  style={{ color: textMuted }}
                >
                  <CheckCheck size={13} />
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="transition-colors hover:text-[#E53935]"
                style={{ color: textMuted }}
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="overflow-y-auto" style={{ maxHeight: 420 }}>
            {notifications.length === 0 ? (
              <div className="py-14 text-center" style={{ color: textMuted }}>
                <Bell size={30} className="mx-auto mb-2 opacity-25" />
                <p style={{ fontSize: 13 }}>No notifications yet</p>
              </div>
            ) : (
              notifications.map((n, i) => {
                const cfg    = TYPE_CFG[n.type] ?? TYPE_CFG.MARKET_UPDATE
                const { Icon } = cfg
                const isUnread = !n.readAt
                const isLast   = i === notifications.length - 1

                return (
                  <div
                    key={n.id}
                    onClick={() => isUnread && markRead(n.id)}
                    className="flex gap-3 px-4 py-3 transition-colors"
                    style={{
                      background: isUnread ? unreadRowBg : 'transparent',
                      borderBottom: isLast ? 'none' : `1px solid ${borderCol}`,
                      cursor: isUnread ? 'pointer' : 'default',
                    }}
                    onMouseEnter={e => { if (!isUnread) e.currentTarget.style.background = hoverRowBg }}
                    onMouseLeave={e => { if (!isUnread) e.currentTarget.style.background = 'transparent' }}
                  >
                    {/* Icon */}
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: `${cfg.color}20` }}
                    >
                      <Icon size={14} style={{ color: cfg.color }} />
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-medium truncate"
                        style={{ color: textPrimary }}
                      >
                        {n.title}
                      </p>
                      <p
                        className="text-xs mt-0.5"
                        style={{
                          color: textMuted,
                          lineHeight: 1.45,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {stripHtml(n.message)}
                      </p>
                      <p className="text-xs mt-1" style={{ color: textMuted, opacity: 0.6 }}>
                        {timeAgo(n.createdAt)}
                      </p>
                    </div>

                    {/* Unread dot */}
                    {isUnread && (
                      <div className="w-2 h-2 rounded-full bg-[#E53935] flex-shrink-0 mt-2.5" />
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
