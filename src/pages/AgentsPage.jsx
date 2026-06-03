import { useState, useMemo, useEffect, useCallback } from 'react'
import { Search, AlertTriangle, TrendingDown, Plus, X, CheckCircle } from 'lucide-react'
import { useLang } from '../context/LanguageContext'
import TeamSummaryBar from '../components/agents/TeamSummaryBar'
import AgentCard from '../components/agents/AgentCard'
import AgentDrawer from '../components/agents/AgentDrawer'
import LeaderboardPanel from '../components/agents/LeaderboardPanel'
import { tierConfig } from '../data/agentsData'
import { useAuth } from '../context/AuthContext'
import api from '../lib/api'
import { mapAgent } from '../lib/mappers'

const TIERS   = ['all', 'elite', 'core', 'developing']
const REGIONS = ['All Regions', 'Downtown', 'North Hills', 'Westside', 'East End', 'Midtown']
const SORTS   = ['Revenue: High', 'Revenue: Low', 'Conversion', 'NPS', 'Close Speed', 'Tenure']

const AGENT_REGIONS = ['Downtown', 'North Hills', 'Westside', 'East End', 'Midtown', 'Harbor View']
const AGENT_TIERS   = [
  { value: 'developing', label: 'Junior' },
  { value: 'core',       label: 'Senior' },
  { value: 'elite',      label: 'Lead'   },
]

function sortAgents(list, sort) {
  return [...list].sort((a, b) => {
    if (sort === 'Revenue: High') return b.revenueYTD - a.revenueYTD
    if (sort === 'Revenue: Low') return a.revenueYTD - b.revenueYTD
    if (sort === 'Conversion') return b.conversionRate - a.conversionRate
    if (sort === 'NPS') return b.npsScore - a.npsScore
    if (sort === 'Close Speed') return a.avgDaysToClose - b.avgDaysToClose
    if (sort === 'Tenure') return b.tenure - a.tenure
    return 0
  })
}

function AddAgentModal({ onClose, onSaved }) {
  const { t } = useLang()
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', password: '',
    phone: '', region: '', tier: 'developing',
  })
  const [errors, setErrors] = useState({})
  const [error,  setError]  = useState('')
  const [saving, setSaving] = useState(false)

  function set(k, v) { setForm(p => ({ ...p, [k]: v })) }

  function validate() {
    const e = {}
    if (!form.firstName.trim()) e.firstName = 'Required'
    if (!form.lastName.trim())  e.lastName  = 'Required'
    if (!form.email.trim())     e.email     = 'Required'
    if (!form.password)         e.password  = 'Required'
    if (form.password && form.password.length < 8) e.password = 'Minimum 8 characters'
    return e
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setError('')
    setSaving(true)
    try {
      const name = `${form.firstName.trim()} ${form.lastName.trim()}`
      await api.post('/api/agents', {
        email:    form.email,
        password: form.password,
        name,
        phone:    form.phone,
        region:   form.region,
        tier:     form.tier,
      })
      onSaved()
      onClose()
    } catch (err) {
      if (err.status === 403) {
        setError("You don't have permission to add agents. Contact your administrator.")
      } else if (err.status === 409) {
        setError('An account with this email address already exists.')
      } else {
        setError(err.message || 'Failed to add agent')
      }
    } finally {
      setSaving(false)
    }
  }

  function inputCls(field) {
    return `w-full bg-white/5 border ${errors[field] ? 'border-red-500/50' : 'border-white/10'} rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card card-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        <div className="flex items-center justify-between p-5 border-b border-white/8">
          <h2 className="text-white font-semibold">{t('agents.addAgent')}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">

          {/* ── Account ── */}
          <div>
            <p className="text-slate-400 text-[10px] uppercase tracking-widest mb-3">{t('settings.account')}</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 text-xs mb-1 block">{t('leads.form.fullName').split(' ')[0]} *</label>
                <input value={form.firstName} onChange={e => set('firstName', e.target.value)}
                  className={inputCls('firstName')} placeholder="Sarah" />
                {errors.firstName && <p className="text-red-400 text-[10px] mt-0.5">{errors.firstName}</p>}
              </div>
              <div>
                <label className="text-slate-400 text-xs mb-1 block">{t('agents.lastName')} *</label>
                <input value={form.lastName} onChange={e => set('lastName', e.target.value)}
                  className={inputCls('lastName')} placeholder="Johnson" />
                {errors.lastName && <p className="text-red-400 text-[10px] mt-0.5">{errors.lastName}</p>}
              </div>
              <div className="col-span-2">
                <label className="text-slate-400 text-xs mb-1 block">{t('leads.form.email')} *</label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                  className={inputCls('email')} placeholder="sarah@pin-crm.io" />
                {errors.email && <p className="text-red-400 text-[10px] mt-0.5">{errors.email}</p>}
              </div>
              <div className="col-span-2">
                <label className="text-slate-400 text-xs mb-1 block">{t('settings.currentPassword')} *</label>
                <input type="password" value={form.password} onChange={e => set('password', e.target.value)}
                  className={inputCls('password')} placeholder={t('agents.minEightChars')} />
                {errors.password && <p className="text-red-400 text-[10px] mt-0.5">{errors.password}</p>}
              </div>
            </div>
          </div>

          <div>
            <p className="text-slate-400 text-[10px] uppercase tracking-widest mb-3 border-t border-white/8 pt-4">{t('settings.account')}</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 text-xs mb-1 block">{t('leads.form.phone')}</label>
                <input value={form.phone} onChange={e => set('phone', e.target.value)}
                  className={inputCls('phone')} placeholder="+1 (555) 000-0000" />
              </div>
              <div>
                <label className="text-slate-400 text-xs mb-1 block">{t('ui.filterArea')}</label>
                <select value={form.region} onChange={e => set('region', e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50">
                  <option value="" className="bg-slate-800">{t('agents.selectRegion')}</option>
                  {AGENT_REGIONS.map(r => <option key={r} value={r} className="bg-slate-800">{r}</option>)}
                </select>
              </div>
              <div>
                <label className="text-slate-400 text-xs mb-1 block">{t('agents.tier')}</label>
                <select value={form.tier} onChange={e => set('tier', e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50">
                  {AGENT_TIERS.map(at => <option key={at.value} value={at.value} className="bg-slate-800">{at.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>
          )}

          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/8 transition-all">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-60 rounded-xl text-sm font-semibold text-white transition-all">
              {saving ? t('common.saving') : t('agents.addAgent')}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}

export default function AgentsPage() {
  const { t } = useLang()
  const { user }                   = useAuth()
  const [agents,   setAgents]      = useState([])
  const [loading,  setLoading]     = useState(true)
  const [selected, setSelected]    = useState(null)
  const [showAdd,  setShowAdd]     = useState(false)
  const [toast,    setToast]       = useState('')
  const [tier,     setTier]        = useState('all')
  const [region,   setRegion]      = useState('All Regions')
  const [query,    setQuery]       = useState('')
  const [sort,     setSort]        = useState('Revenue: High')
  const [lbMetric, setLbMetric]    = useState('revenue')

  const fetchAgents = useCallback(() => {
    setLoading(true)
    api.get('/api/agents?per_page=50')
      .then(res => setAgents((res.data || []).map(mapAgent)))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchAgents() }, [fetchAgents])

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const filtered = useMemo(() => {
    let list = agents.filter(a => {
      if (tier !== 'all' && a.tier !== tier) return false
      if (region !== 'All Regions' && a.region !== region) return false
      if (query && !`${a.name} ${a.specialization} ${a.region}`.toLowerCase().includes(query.toLowerCase())) return false
      return true
    })
    return sortAgents(list, sort)
  }, [agents, tier, region, query, sort])

  const atRiskAgents    = agents.filter(a => a.retentionRisk === 'high')
  const decliningAgents = agents.filter(a => a.dealVelocity === 'decreasing')

  const teamSummary = {
    totalAgents:       agents.length,
    eliteCount:        agents.filter(a => a.tier === 'elite').length,
    coreCount:         agents.filter(a => a.tier === 'core').length,
    developingCount:   agents.filter(a => a.tier === 'developing').length,
    avgConversionRate: agents.length ? +(agents.reduce((s, a) => s + (a.conversionRate || 0), 0) / agents.length).toFixed(1) : 0,
    avgNPS:            agents.length ? +(agents.reduce((s, a) => s + (a.npsScore || 0), 0) / agents.length).toFixed(1) : 0,
    totalRevenueYTD:   agents.reduce((s, a) => s + (a.revenueYTD || 0), 0),
    topPerformerShare: 58,
  }

  const tierBreakdown = ['elite', 'core', 'developing'].map(t => ({
    tier:         t,
    label:        tierConfig[t].label,
    count:        agents.filter(a => a.tier === t).length,
    revenueShare: t === 'elite' ? 58 : t === 'core' ? 38 : 4,
    cfg:          tierConfig[t],
  }))

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-white text-xl font-bold tracking-tight">{t('agents.title')}</h1>
          <p className="text-slate-400 text-sm mt-0.5">{t('agents.subtitle')}</p>
        </div>
        {['admin', 'manager'].includes(user?.role) && (
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 rounded-xl text-xs font-medium text-white hover:bg-blue-600 transition-all">
            <Plus size={13} /> {t('agents.addAgent')}
          </button>
        )}
      </div>

      <TeamSummaryBar data={teamSummary} />

      {(atRiskAgents.length > 0 || decliningAgents.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {atRiskAgents.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/25 rounded-2xl p-3.5 flex items-start gap-3">
              <AlertTriangle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-300 text-xs font-semibold mb-1">{t('agents.highRetentionRisk')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {atRiskAgents.map(a => (
                    <button key={a.id} onClick={() => setSelected(a)}
                      className="text-[10px] text-red-300 bg-red-500/15 border border-red-500/25 px-2 py-0.5 rounded-lg hover:bg-red-500/25 transition-all">
                      {a.name} — {t('agents.scheduleRetentionTalk')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {decliningAgents.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-3.5 flex items-start gap-3">
              <TrendingDown size={15} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-300 text-xs font-semibold mb-1">{t('agents.decliningVelocity')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {decliningAgents.map(a => (
                    <button key={a.id} onClick={() => setSelected(a)}
                      className="text-[10px] text-amber-300 bg-amber-500/15 border border-amber-500/25 px-2 py-0.5 rounded-lg hover:bg-amber-500/25 transition-all">
                      {a.name} — {t('agents.reviewPipeline')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 min-w-0">
          <div className="bg-card card-border rounded-2xl p-4 mb-4 glow-blue">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={query} onChange={e => setQuery(e.target.value)}
                  placeholder={t('agents.searchFullPlaceholder')}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-all" />
              </div>
              <select value={region} onChange={e => setRegion(e.target.value)}
                className="appearance-none bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none cursor-pointer">
                {REGIONS.map(r => <option key={r} value={r} className="bg-navy-800">{r}</option>)}
              </select>
              <select value={sort} onChange={e => setSort(e.target.value)}
                className="appearance-none bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none cursor-pointer">
                {SORTS.map(s => <option key={s} value={s} className="bg-navy-800">Sort: {s}</option>)}
              </select>
            </div>
            <div className="flex gap-1.5">
              {TIERS.map(tier_ => {
                const cfg = tier_ === 'all' ? null : tierConfig[tier_]
                return (
                  <button key={tier_} onClick={() => setTier(tier_)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${
                      tier === tier_
                        ? tier_ === 'all' ? 'bg-blue-500 text-white' : cfg.color
                        : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/8'
                    }`}>
                    {tier_ === 'all' ? t('agents.allTiers') : cfg.label}
                    <span className="ml-1.5 text-[9px] opacity-70">
                      {tier_ === 'all' ? agents.length : agents.filter(a => a.tier === tier_).length}
                    </span>
                  </button>
                )
              })}
              <span className="ml-auto text-slate-500 text-xs flex items-center">
                <span className="text-white font-semibold">{filtered.length}</span>&nbsp;{t('agents.agentsUnit')}
              </span>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-card card-border rounded-2xl">
              <span className="text-4xl mb-3">👤</span>
              <p className="text-white font-semibold">{t('agents.noMatch')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map(a => <AgentCard key={a.id} agent={a} onClick={setSelected} />)}
            </div>
          )}
        </div>

        <div className="w-full lg:w-64 lg:flex-shrink-0 space-y-4">
          <LeaderboardPanel agents={agents} metric={lbMetric} onMetricChange={setLbMetric} onSelect={setSelected} />

          <div className="bg-card card-border rounded-2xl p-4 glow-blue">
            <p className="text-white font-semibold text-xs mb-3">{t('agents.teamDistribution')}</p>
            <div className="space-y-2.5">
              {tierBreakdown.map(({ tier: tierKey, count, revenueShare, label, cfg }) => (
                <div key={tierKey}>
                  <div className="flex items-center justify-between mb-1 text-[10px]">
                    <span className={`font-medium px-1.5 py-0.5 rounded-full ${cfg.color}`}>{label}</span>
                    <span className="text-slate-500">{count} {t('agents.agentsUnit')} · {revenueShare}% {t('agents.revShareSuffix')}</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${cfg.dot}`} style={{ width: `${revenueShare}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-white/5">
              <p className="text-slate-400 text-[10px]">{t('agents.teamInsight')}</p>
            </div>
          </div>

          <div className="bg-card card-border rounded-2xl p-4 glow-blue">
            <p className="text-white font-semibold text-xs mb-3">{t('agents.mentorshipPairs')}</p>
            <div className="space-y-2">
              {[
                { mentor: 'Sarah J', mentee: 'Rachel M', status: 'Active' },
                { mentor: 'Marcus C', mentee: 'David K', status: 'Suggested' },
                { mentor: 'Priya P', mentee: 'Lisa T', status: 'Suggested' },
              ].map(({ mentor, mentee, status }) => (
                <div key={mentor + mentee} className="flex items-center gap-2 p-2 bg-white/3 border border-white/6 rounded-xl text-[10px]">
                  <span className="text-blue-300 font-medium">{mentor}</span>
                  <span className="text-slate-600">→</span>
                  <span className="text-slate-300">{mentee}</span>
                  <span className={`ml-auto px-1.5 py-0.5 rounded-full ${status === 'Active' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-500/15 text-slate-400'}`}>
                    {status === 'Active' ? t('agents.mentorshipActive') : t('agents.mentorshipSuggested')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <AgentDrawer agent={selected} onClose={() => setSelected(null)} />

      {showAdd && (
        <AddAgentModal
          onClose={() => setShowAdd(false)}
          onSaved={() => { fetchAgents(); showToast(t('agents.agentAdded')) }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium px-4 py-3 rounded-2xl shadow-lg">
          <CheckCircle size={14} />
          {toast}
        </div>
      )}
    </div>
  )
}
