import { useState, useMemo, useEffect } from 'react'
import { Search, AlertCircle, TrendingUp } from 'lucide-react'
import { useLang } from '../context/LanguageContext'
import ClientsSummaryBar from '../components/clients/ClientsSummaryBar'
import ClientCard from '../components/clients/ClientCard'
import ClientDrawer from '../components/clients/ClientDrawer'
import ReferralPanel from '../components/clients/ReferralPanel'
import { tierConfig, referralLeaderboard } from '../data/clientsData'
import api from '../lib/api'
import { mapClient } from '../lib/mappers'

const TIERS    = ['all', 'vip', 'high-value', 'regular']
const TYPES    = ['All Types', 'buyer', 'investor', 'seller']
const STATUSES = ['All', 'active', 'dormant']
const SORTS    = ['LTV: High', 'LTV: Low', 'Repeat Likelihood', 'Last Contact', 'Referrals', 'Satisfaction']

function sortClients(list, sort) {
  return [...list].sort((a, b) => {
    if (sort === 'LTV: High')          return b.lifetimeValue - a.lifetimeValue
    if (sort === 'LTV: Low')           return a.lifetimeValue - b.lifetimeValue
    if (sort === 'Repeat Likelihood')  return b.repeatLikelihood - a.repeatLikelihood
    if (sort === 'Last Contact')       return a.daysSinceContact - b.daysSinceContact
    if (sort === 'Referrals')          return b.referralValue - a.referralValue
    if (sort === 'Satisfaction')       return (b.npsScore ?? 0) - (a.npsScore ?? 0)
    return 0
  })
}

export default function ClientsPage() {
  const { t } = useLang()
  const [clients,  setClients]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [selected, setSelected] = useState(null)
  const [tier,     setTier]     = useState('all')
  const [type,     setType]     = useState('All Types')
  const [status,   setStatus]   = useState('All')
  const [sort,     setSort]     = useState('LTV: High')
  const [query,    setQuery]    = useState('')

  useEffect(() => {
    setLoading(true)
    api.get('/api/clients?per_page=100')
      .then(res => setClients((res.data || []).map(mapClient)))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    let list = clients.filter(c => {
      if (tier !== 'all' && c.tier !== tier) return false
      if (type !== 'All Types' && !(c.type || []).includes(type)) return false
      if (status !== 'All' && c.status !== status) return false
      if (query && !`${c.name} ${c.location} ${(c.type || []).join(' ')} ${c.agentName || ''}`.toLowerCase().includes(query.toLowerCase())) return false
      return true
    })
    return sortClients(list, sort)
  }, [clients, tier, type, status, sort, query])

  const dormantVIPs = clients.filter(c => c.status === 'dormant' && (c.tier === 'vip' || c.tier === 'high-value'))

  const clientsSummary = {
    totalClients:       clients.length,
    activeClients:      clients.filter(c => c.status === 'active').length,
    dormantClients:     clients.filter(c => c.status === 'dormant').length,
    vipClients:         clients.filter(c => c.tier === 'vip').length,
    highValueClients:   clients.filter(c => c.tier === 'high-value').length,
    avgCLV:             clients.length ? Math.round(clients.reduce((s, c) => s + (c.lifetimeValue || 0), 0) / clients.length) : 0,
    repeatRate:         42,
    targetRepeatRate:   58,
    totalReferralValue: clients.reduce((s, c) => s + (c.referralValue || 0), 0),
    topReferrers:       clients.filter(c => (c.referralValue || 0) > 0).length,
    avgSatisfaction:    clients.filter(c => c.npsScore).length
      ? +(clients.filter(c => c.npsScore).reduce((s, c) => s + c.npsScore, 0) / clients.filter(c => c.npsScore).length).toFixed(1)
      : 0,
  }

  const repeatGap = clientsSummary.targetRepeatRate - clientsSummary.repeatRate

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-white text-xl font-bold tracking-tight">{t('clients.title')}</h1>
          <p className="text-slate-400 text-sm mt-0.5">{t('clients.subtitle')}</p>
        </div>
        <button className="px-4 py-2 bg-blue-500 rounded-xl text-xs font-medium text-white hover:bg-blue-600 transition-all">
          + {t('clients.addClient')}
        </button>
      </div>

      <ClientsSummaryBar data={clientsSummary} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div className="bg-blue-500/10 border border-blue-500/25 rounded-2xl p-4 flex items-start gap-3">
          <TrendingUp size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-blue-300 text-xs font-semibold mb-1">{t('clients.repeatRateGap')}: {repeatGap}pp</p>
            <p className="text-slate-300 text-xs">
              Current: <span className="text-white font-semibold">{clientsSummary.repeatRate}%</span> → Target: <span className="text-blue-300 font-semibold">{clientsSummary.targetRepeatRate}%</span>. Closing this gap = <span className="text-emerald-400 font-semibold">+$10.8M</span> projected additional revenue.
            </p>
          </div>
        </div>
        {dormantVIPs.length > 0 && (
          <div className="bg-red-500/10 border border-red-500/25 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-300 text-xs font-semibold mb-1">{dormantVIPs.length} {t('clients.dormantVIPAlert')}</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {dormantVIPs.map(c => (
                  <button key={c.id} onClick={() => setSelected(c)}
                    className="text-[10px] text-red-300 bg-red-500/15 border border-red-500/25 px-2 py-0.5 rounded-lg hover:bg-red-500/25 transition-all">
                    {c.name} — {c.daysSinceContact}{t('clients.dSilent')}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 min-w-0">
          <div className="bg-card card-border rounded-2xl p-4 mb-4 glow-blue">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={query} onChange={e => setQuery(e.target.value)}
                  placeholder={t('clients.searchFullPlaceholder')}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-all" />
              </div>
              <select value={type} onChange={e => setType(e.target.value)}
                className="appearance-none bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none cursor-pointer">
                {TYPES.map(tp => <option key={tp} value={tp} className="bg-navy-800">{tp === 'All Types' ? t('clients.allTypes') : tp.charAt(0).toUpperCase() + tp.slice(1)}</option>)}
              </select>
              <select value={status} onChange={e => setStatus(e.target.value)}
                className="appearance-none bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none cursor-pointer">
                {STATUSES.map(s => <option key={s} value={s} className="bg-navy-800">{s === 'All' ? t('clients.allStatus') : s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
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
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      tier === tier_
                        ? tier_ === 'all' ? 'bg-blue-500 text-white' : cfg.color
                        : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/8'
                    }`}>
                    {tier_ === 'all' ? t('clients.allTiers') : cfg.label}
                    <span className="ml-1 text-[9px] opacity-70">
                      {tier_ === 'all' ? clients.length : clients.filter(c => c.tier === tier_).length}
                    </span>
                  </button>
                )
              })}
              <span className="ml-auto text-slate-500 text-xs flex items-center">
                <span className="text-white font-semibold">{filtered.length}</span>&nbsp;{t('clients.clientsUnit')}
              </span>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-card card-border rounded-2xl">
              <span className="text-4xl mb-3">🤝</span>
              <p className="text-white font-semibold">{t('clients.noMatch')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map(c => <ClientCard key={c.id} client={c} onClick={setSelected} />)}
            </div>
          )}
        </div>

        <div className="w-full lg:w-64 lg:flex-shrink-0 space-y-4">
          <ReferralPanel sources={referralLeaderboard} onSelect={setSelected} clients={clients} />

          <div className="bg-card card-border rounded-2xl p-4 glow-blue">
            <p className="text-white font-semibold text-xs mb-3">{t('clients.retentionStrategy')}</p>
            <div className="space-y-3 text-xs">
              {[
                { label: 'Systematic Follow-up', impact: '+6%', timeline: 'Month 1–3', color: 'bg-blue-400' },
                { label: 'VIP Segmentation',     impact: '+4%', timeline: 'Month 1',   color: 'bg-amber-400' },
                { label: 'Referral Program',     impact: '+3%', timeline: 'Month 2',   color: 'bg-emerald-400' },
                { label: 'Market Alerts',        impact: '+2%', timeline: 'Month 2–3', color: 'bg-purple-400' },
                { label: 'Lifecycle Events',     impact: '+1%', timeline: 'Month 4+',  color: 'bg-slate-400' },
              ].map(({ label, impact, timeline, color }) => (
                <div key={label} className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-300 text-[10px] truncate">{label}</p>
                    <p className="text-slate-600 text-[9px]">{timeline}</p>
                  </div>
                  <span className="text-emerald-400 font-bold text-[10px] flex-shrink-0">{impact}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-white/5">
                <p className="text-slate-400 text-[10px]">Combined impact:</p>
                <p className="text-emerald-400 font-bold">42% → 58–60% repeat rate</p>
                <p className="text-slate-500 text-[9px]">in 18 months</p>
              </div>
            </div>
          </div>

          <div className="bg-card card-border rounded-2xl p-4 glow-blue">
            <p className="text-white font-semibold text-xs mb-3">{t('clients.overdueCheckIns')}</p>
            <div className="space-y-2">
              {clients
                .filter(c => c.daysSinceContact > 7 && c.tier !== 'regular')
                .sort((a, b) => b.daysSinceContact - a.daysSinceContact)
                .slice(0, 4)
                .map(c => (
                  <div key={c.id} onClick={() => setSelected(c)}
                    className="flex items-center gap-2 p-2 bg-white/3 border border-white/6 rounded-xl cursor-pointer hover:bg-white/6 transition-all">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                      style={{ backgroundColor: `${c.color}20`, color: c.color }}>
                      {(c.avatar || '?').slice(0, 1)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-[10px] font-medium truncate">{c.name.split(' ')[0]}</p>
                      <p className={`text-[9px] ${c.daysSinceContact > 90 ? 'text-red-400' : 'text-amber-400'}`}>
                        {c.daysSinceContact}{t('clients.dSinceContact')}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      <ClientDrawer client={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
