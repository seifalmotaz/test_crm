import { useState, useEffect, useRef } from 'react'
import { Globe, Palette, User, Bell, Check, Eye, EyeOff, Save, Lock } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LanguageContext'
import { useTheme } from '../context/ThemeContext'
import api from '../lib/api'

const ANIM = `
@keyframes dropIn {
  from { opacity:0; transform:translateY(-10px) scale(0.96); filter:blur(4px); }
  to   { opacity:1; transform:translateY(0)      scale(1);   filter:blur(0);   }
}
.settings-drop {
  animation: dropIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
`

const TAB_DEFS = [
  { id: 'language',      icon: Globe,   key: 'settings.language'      },
  { id: 'theme',         icon: Palette, key: 'settings.theme'         },
  { id: 'account',       icon: User,    key: 'settings.account'       },
  { id: 'notifications', icon: Bell,    key: 'settings.notifications' },
]

const ACCENT_COLORS = [
  { name: 'Brand',   value: 'red',     cls: 'bg-[#E53935]'   },
  { name: 'Blue',    value: 'blue',    cls: 'bg-blue-500'    },
  { name: 'Violet',  value: 'violet',  cls: 'bg-violet-500'  },
  { name: 'Emerald', value: 'emerald', cls: 'bg-emerald-500' },
  { name: 'Amber',   value: 'amber',   cls: 'bg-amber-500'   },
  { name: 'Cyan',    value: 'cyan',    cls: 'bg-cyan-500'    },
]

/* ── Language ─────────────────────────────────────────────────────── */
function LanguageTab() {
  const { lang, setLang, t } = useLang()
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">{t('settings.selectLanguage')}</p>
      {[
        { code: 'en', label: 'English',  sub: 'English (US)' },
        { code: 'ar', label: 'العربية',  sub: 'Arabic'       },
      ].map(l => (
        <button
          key={l.code}
          onClick={() => setLang(l.code)}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-200 ${
            lang === l.code
              ? 'border-blue-500/40 bg-blue-500/10 text-white'
              : 'border-white/8 bg-white/4 text-slate-300 hover:border-white/15 hover:bg-white/6'
          }`}
        >
          <div className="text-start">
            <p className="font-medium text-sm">{l.label}</p>
            <p className="text-xs text-slate-500 mt-0.5">{l.sub}</p>
          </div>
          {lang === l.code && (
            <span className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
              <Check size={10} className="text-white" />
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

/* ── Theme ────────────────────────────────────────────────────────── */
function ThemeTab({ theme, setTheme, accent, setAccent }) {
  const { t } = useLang()
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-3">{t('settings.colorMode')}</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { id: 'dark',  label: t('settings.darkMode')  },
            { id: 'light', label: t('settings.lightMode') },
          ].map(m => (
            <button key={m.id}
              onClick={() => setTheme(m.id)}
              className={`relative rounded-xl border p-3 text-center transition-all cursor-pointer ${
                theme === m.id
                  ? 'border-blue-500/40 bg-blue-500/10'
                  : 'border-white/8 bg-white/4 hover:border-white/15 hover:bg-white/6'
              }`}
            >
              <div className={`w-full h-8 rounded-lg mb-2 border border-white/10 ${m.id === 'dark' ? 'bg-slate-800' : 'bg-slate-200'}`} />
              <p className="text-white text-xs font-medium">{m.label}</p>
              {theme === m.id && (
                <span className="absolute top-2 end-2 w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                  <Check size={8} className="text-white" />
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-3">{t('settings.accentColor')}</p>
        <div className="grid grid-cols-6 gap-2">
          {ACCENT_COLORS.map(c => (
            <button key={c.value} onClick={() => setAccent(c.value)}
              className="flex flex-col items-center gap-1.5"
            >
              <div className={`w-8 h-8 rounded-full ${c.cls} flex items-center justify-center transition-all duration-200 ${
                accent === c.value ? 'ring-2 ring-white/40 ring-offset-1 ring-offset-transparent scale-110' : 'opacity-60 hover:opacity-100'
              }`}>
                {accent === c.value && <Check size={11} className="text-white" />}
              </div>
              <span className="text-[10px] text-slate-500">{c.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Account ──────────────────────────────────────────────────────── */
function AccountTab() {
  const { user } = useAuth()
  const { t } = useLang()
  const [name,      setName]      = useState(user?.name || user?.email?.split('@')[0] || '')
  const [currentPw, setCurrentPw] = useState('')
  const [newPw,     setNewPw]     = useState('')
  const [showCur,   setShowCur]   = useState(false)
  const [showNew,   setShowNew]   = useState(false)
  const [status,    setStatus]    = useState(null)
  const [msg,       setMsg]       = useState('')
  const [saving,    setSaving]    = useState(false)

  async function handleSave() {
    setSaving(true); setStatus(null)
    try {
      const payload = {}
      if (name.trim()) payload.name = name.trim()
      if (currentPw && newPw) { payload.currentPassword = currentPw; payload.newPassword = newPw }
      await api.put('/api/auth/profile', payload)
      setStatus('ok'); setMsg(t('settings.savedSuccess'))
      setCurrentPw(''); setNewPw('')
    } catch (e) {
      setStatus('err'); setMsg(e?.response?.data?.message || t('settings.saveFailed'))
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-slate-500 uppercase tracking-widest font-semibold block mb-2">{t('settings.displayName')}</label>
        <input value={name} onChange={e => setName(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/40 transition-all"
          placeholder="Your name"
        />
      </div>
      <div>
        <label className="text-xs text-slate-500 uppercase tracking-widest font-semibold block mb-2">{t('settings.email')}</label>
        <input value={user?.email || ''} disabled
          className="w-full bg-white/3 border border-white/8 rounded-xl px-3.5 py-2.5 text-sm text-slate-600 cursor-not-allowed"
        />
      </div>
      <div className="border-t border-white/8 pt-4">
        <div className="flex items-center gap-2 mb-3">
          <Lock size={12} className="text-slate-500" />
          <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">{t('settings.changePassword')}</p>
        </div>
        <div className="space-y-2.5">
          {[
            { val: currentPw, set: setCurrentPw, show: showCur, toggleShow: () => setShowCur(v=>!v), ph: t('settings.currentPassword') },
            { val: newPw,     set: setNewPw,     show: showNew, toggleShow: () => setShowNew(v=>!v), ph: t('settings.newPassword')     },
          ].map((f, i) => (
            <div key={i} className="relative">
              <input type={f.show ? 'text' : 'password'} value={f.val} onChange={e => f.set(e.target.value)}
                placeholder={f.ph}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/40 transition-all pr-10"
              />
              <button onClick={f.toggleShow} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300 transition-colors">
                {f.show ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          ))}
        </div>
      </div>

      {status && (
        <p className={`text-xs font-medium px-3 py-2 rounded-lg ${
          status === 'ok' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
        }`}>{msg}</p>
      )}

      <button onClick={handleSave} disabled={saving}
        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-xl transition-all"
      >
        <Save size={13} />
        {saving ? t('common.saving') : t('settings.saveChanges')}
      </button>
    </div>
  )
}

/* ── Notifications ────────────────────────────────────────────────── */
function NotificationsTab() {
  const { t } = useLang()
  const [prefs, setPrefs] = useState({
    new_lead: true, deal_update: true, task_reminder: true,
    agent_activity: false, daily_summary: true, email_digest: false,
  })
  const toggle = k => setPrefs(p => ({ ...p, [k]: !p[k] }))

  const items = [
    { key: 'new_lead',       label: t('settings.newLead'),       sub: t('settings.newLeadSub')       },
    { key: 'deal_update',    label: t('settings.dealUpdates'),   sub: t('settings.dealUpdatesSub')   },
    { key: 'task_reminder',  label: t('settings.taskReminders'), sub: t('settings.taskRemindersSub') },
    { key: 'agent_activity', label: t('settings.agentActivity'), sub: t('settings.agentActivitySub') },
    { key: 'daily_summary',  label: t('settings.dailySummary'),  sub: t('settings.dailySummarySub')  },
    { key: 'email_digest',   label: t('settings.emailDigest'),   sub: t('settings.emailDigestSub')   },
  ]

  return (
    <div className="space-y-2">
      {items.map(item => (
        <div key={item.key}
          className="flex items-center justify-between px-3.5 py-3 rounded-xl border border-white/8 bg-white/3 hover:bg-white/5 transition-colors"
        >
          <div>
            <p className="text-white text-sm font-medium">{item.label}</p>
            <p className="text-slate-500 text-xs mt-0.5">{item.sub}</p>
          </div>
          <button onClick={() => toggle(item.key)}
            style={{ width: 38, height: 22, borderRadius: 11 }}
            className={`relative flex-shrink-0 transition-colors duration-200 ${prefs[item.key] ? 'bg-blue-500' : 'bg-white/10'}`}
          >
            <span style={{
              position: 'absolute', top: 3, width: 16, height: 16, borderRadius: '50%',
              background: 'white', transition: 'left 0.2s',
              left: prefs[item.key] ? 19 : 3,
            }} />
          </button>
        </div>
      ))}
    </div>
  )
}

/* ── Main Dropdown Panel ──────────────────────────────────────────── */
export default function SettingsPanel({ onClose }) {
  const { t } = useLang()
  const { theme, setTheme, accent, setAccent } = useTheme()
  const [activeTab, setActiveTab] = useState('language')
  const ref = useRef(null)
  const isLight = theme === 'light'

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  const ActiveIcon = TAB_DEFS.find(tb => tb.id === activeTab)?.icon || Globe

  return (
    <>
      <style>{ANIM}</style>

      <div
        ref={ref}
        className="settings-drop absolute end-0 top-[calc(100%+10px)] z-50 w-[380px] rounded-2xl overflow-hidden"
        style={{
          background: isLight ? 'rgba(255,255,255,0.96)' : 'rgba(10,16,32,0.82)',
          backdropFilter: 'blur(28px) saturate(180%)',
          WebkitBackdropFilter: 'blur(28px) saturate(180%)',
          border: `1px solid ${isLight ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.08)'}`,
          boxShadow: isLight
            ? '0 32px 64px -12px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)'
            : '0 32px 64px -12px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        {/* Glass top sheen */}
        <div className="absolute inset-x-0 top-0 h-px"
          style={{ background: isLight
            ? 'linear-gradient(90deg, transparent, rgba(0,0,0,0.08), transparent)'
            : 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)' }}
        />

        {/* Tab bar */}
        <div className="flex items-center gap-1 px-3 pt-3 pb-2"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          {TAB_DEFS.map(tab => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-xl text-xs font-medium transition-all duration-200 ${
                  active ? 'text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
                style={active ? {
                  background: 'rgba(59,130,246,0.15)',
                  border: '1px solid rgba(59,130,246,0.25)',
                } : { background: 'transparent', border: '1px solid transparent' }}
              >
                <Icon size={15} />
                {t(tab.key)}
              </button>
            )
          })}
        </div>

        {/* Content area */}
        <div className="px-4 py-4 max-h-[440px] overflow-y-auto"
          style={{ scrollbarWidth: 'thin', scrollbarColor: isLight ? 'rgba(0,0,0,0.2) transparent' : 'rgba(255,255,255,0.1) transparent' }}
        >
          {/* Section title */}
          <div className="flex items-center gap-2 mb-4">
            <ActiveIcon size={14} className="text-blue-400" />
            <span className="text-white text-sm font-semibold">
              {t(TAB_DEFS.find(tb => tb.id === activeTab)?.key || '')}
            </span>
          </div>

          {activeTab === 'language'      && <LanguageTab />}
          {activeTab === 'theme'         && <ThemeTab theme={theme} setTheme={setTheme} accent={accent} setAccent={setAccent} />}
          {activeTab === 'account'       && <AccountTab />}
          {activeTab === 'notifications' && <NotificationsTab />}
        </div>

        {/* Bottom glass shine */}
        <div className="absolute inset-x-0 bottom-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)' }}
        />
      </div>
    </>
  )
}
