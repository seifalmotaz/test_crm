import { useState, useMemo, useEffect } from 'react'
import { Search, AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import { useLang } from '../context/LanguageContext'
import DealPipelineHeader from '../components/deals/DealPipelineHeader'
import KanbanCard from '../components/deals/KanbanColumn'
import DealDrawer from '../components/deals/DealDrawer'
import CommissionPanel from '../components/deals/CommissionPanel'
import api from '../lib/api'
import { mapDeal } from '../lib/mappers'

const STAGE_DEFS = [
  { key: 'offer',       tKey: 'deals.stages.offer',       color: 'border-slate-500/30',   header: 'bg-slate-500/10 text-slate-300' },
  { key: 'negotiation', tKey: 'deals.stages.negotiation', color: 'border-amber-500/30',   header: 'bg-amber-500/10 text-amber-300' },
  { key: 'inspection',  tKey: 'deals.stages.inspection',  color: 'border-blue-500/30',    header: 'bg-blue-500/10 text-blue-300' },
  { key: 'appraisal',   tKey: 'deals.stages.appraisal',  color: 'border-purple-500/30',  header: 'bg-purple-500/10 text-purple-300' },
  { key: 'closing',     tKey: 'deals.stages.closing',     color: 'border-emerald-500/30', header: 'bg-emerald-500/10 text-emerald-300' },
]

function fmt(v) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v}`
}

export default function DealsPage() {
  const { t } = useLang()
  const STAGES = STAGE_DEFS.map(s => ({ ...s, label: t(s.tKey) }))

  const [deals,      setDeals]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [selected,   setSelected]   = useState(null)
  const [query,      setQuery]      = useState('')
  const [riskFilter, setRiskFilter] = useState('all')

  useEffect(() => {
    setLoading(true)
    api.get('/api/deals?per_page=100')
      .then(res => setDeals((res.data || []).map(mapDeal)))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    return deals.filter((d) => {
      if (riskFilter !== 'all' && d.risk !== riskFilter) return false
      if (query && !`${d.property} ${d.buyer} ${d.agent} ${d.type}`.toLowerCase().includes(query.toLowerCase())) return false
      return true
    })
  }, [deals, query, riskFilter])

  const atRiskDeals = deals.filter(d => d.risk === 'high')

  const totalValue       = deals.reduce((s, d) => s + (d.value || 0), 0)
  const closingThisWeek  = deals.filter(d => d.daysUntilClose <= 7 && d.daysUntilClose >= 0)
  const commissionForecast = {
    pending:     deals.reduce((s, d) => s + (d.value || 0) * ((d.commissionRate || 5) / 100), 0),
    thisMonth:   closingThisWeek.reduce((s, d) => s + (d.value || 0) * ((d.commissionRate || 5) / 100), 0),
    stages:      STAGES.map(st => ({
      stage: st.label,
      value: deals.filter(d => d.stage === st.key).reduce((s, d) => s + (d.value || 0) * ((d.commissionRate || 5) / 100), 0),
    })),
  }

  const pipelineSummary = {
    totalDeals:             deals.length,
    totalValue,
    closingThisWeek:        closingThisWeek.length,
    closingThisWeekValue:   closingThisWeek.reduce((s, d) => s + (d.value || 0), 0),
    atRisk:                 atRiskDeals.length,
    avgCloseRate:           deals.length ? Math.round(deals.reduce((s, d) => s + (d.closingProbability || 0), 0) / deals.length) : 0,
    commissionPending:      commissionForecast.pending,
    commissionThisMonth:    commissionForecast.thisMonth,
    avgDaysToClose:         deals.length ? Math.round(deals.reduce((s, d) => s + (d.daysElapsed || 0), 0) / deals.length) : 0,
  }

  const agentNames = [...new Set(deals.map(d => d.agent).filter(Boolean))]

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-white text-xl font-bold tracking-tight">{t('deals.title')}</h1>
          <p className="text-slate-400 text-sm mt-0.5">{t('deals.subtitle')}</p>
        </div>
        <button className="px-4 py-2 bg-blue-500 rounded-xl text-xs font-medium text-white hover:bg-blue-600 transition-all">
          {t('deals.newDeal')}
        </button>
      </div>

      <DealPipelineHeader data={pipelineSummary} />

      {atRiskDeals.length > 0 && (
        <div className="mb-4 bg-red-500/10 border border-red-500/25 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-red-300 text-sm font-semibold mb-1">{atRiskDeals.length} {t('deals.dealsNeedAttention')}</p>
            <div className="flex flex-wrap gap-2">
              {atRiskDeals.map((d) => (
                <button key={d.id} onClick={() => setSelected(d)}
                  className="text-xs text-red-300 bg-red-500/15 border border-red-500/25 px-2.5 py-1 rounded-lg hover:bg-red-500/25 transition-all">
                  {d.property} · {d.daysUntilClose}d left
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="relative flex-1 max-w-xs">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('deals.searchPlaceholder')}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-all" />
            </div>
            <div className="flex gap-1.5">
              {[
                { key: 'all',    label: t('common.all'),          icon: null },
                { key: 'high',   label: t('deals.highRisk'),      icon: AlertTriangle },
                { key: 'medium', label: t('deals.filterMedium'),  icon: Clock },
                { key: 'low',    label: t('deals.filterOnTrack'), icon: CheckCircle },
              ].map(({ key, label, icon: Icon }) => (
                <button key={key} onClick={() => setRiskFilter(key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    riskFilter === key
                      ? key === 'high'   ? 'bg-red-500/20 border border-red-500/40 text-red-300'
                        : key === 'medium' ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300'
                        : key === 'low'    ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                        : 'bg-blue-500 text-white'
                      : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/8'
                  }`}>
                  {Icon && <Icon size={11} />}
                  {label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto pb-2 -mx-1 px-1">
              <div className="grid grid-cols-5 gap-3 min-w-[700px]">
              {STAGES.map((stage) => {
                const stageDeals = filtered.filter(d => d.stage === stage.key)
                const stageValue = stageDeals.reduce((s, d) => s + (d.value || 0), 0)
                return (
                  <div key={stage.key} className={`flex flex-col min-h-64 rounded-2xl border ${stage.color} bg-white/2`}>
                    <div className={`rounded-t-2xl px-3 py-2.5 ${stage.header}`}>
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold">{stage.label}</p>
                        <span className="bg-black/20 text-[10px] px-1.5 py-0.5 rounded-full font-bold">{stageDeals.length}</span>
                      </div>
                      <p className="text-[10px] opacity-70 mt-0.5">{fmt(stageValue)}</p>
                    </div>
                    <div className="flex-1 p-2 space-y-2">
                      {stageDeals.length === 0 ? (
                        <div className="flex items-center justify-center h-16 text-slate-600 text-[10px]">{t('deals.noDeals')}</div>
                      ) : (
                        stageDeals.map(deal => <KanbanCard key={deal.id} deal={deal} onClick={setSelected} />)
                      )}
                    </div>
                  </div>
                )
              })}
              </div>
            </div>
          )}
        </div>

        <div className="w-full lg:w-64 lg:flex-shrink-0 space-y-4">
          <CommissionPanel forecast={commissionForecast} />

          <div className="bg-card card-border rounded-2xl p-4 glow-blue">
            <p className="text-white font-semibold text-xs mb-3 flex items-center gap-2">
              <CheckCircle size={13} className="text-emerald-400" /> {t('deals.closingThisWeekPanel')}
            </p>
            <div className="space-y-2">
              {closingThisWeek.length === 0
                ? <p className="text-slate-500 text-xs">{t('deals.noDealsClosing')}</p>
                : closingThisWeek.map(d => (
                  <div key={d.id} onClick={() => setSelected(d)}
                    className="flex items-center gap-2 p-2.5 bg-white/4 border border-white/8 rounded-xl cursor-pointer hover:bg-white/8 transition-all">
                    <span className="text-base">{d.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-[10px] font-medium truncate">{d.property}</p>
                      <p className="text-emerald-400 text-[9px]">{d.daysUntilClose === 0 ? t('deals.todayLabel') : `${d.daysUntilClose}d`} · {fmt(d.value)}</p>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          <div className="bg-card card-border rounded-2xl p-4 glow-blue">
            <p className="text-white font-semibold text-xs mb-3">{t('deals.pipelineByAgent')}</p>
            <div className="space-y-2">
              {agentNames.slice(0, 4).map(agent => {
                const agentDeals = deals.filter(d => d.agent === agent)
                const agentValue = agentDeals.reduce((s, d) => s + (d.value || 0), 0)
                const maxValue   = Math.max(...agentNames.map(n => deals.filter(d => d.agent === n).reduce((s, d) => s + (d.value || 0), 0)), 1)
                return (
                  <div key={agent} className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-300 text-[9px] font-bold flex-shrink-0">
                      {agent.split(' ').map(w => w[0]).join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-300 text-[10px] truncate">{agent.split(' ')[0]}</p>
                      <div className="h-1 bg-white/5 rounded-full mt-1 overflow-hidden">
                        <div className="h-full bg-blue-400 rounded-full" style={{ width: `${(agentValue / maxValue) * 100}%` }} />
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-white text-[10px] font-semibold">{fmt(agentValue)}</p>
                      <p className="text-slate-500 text-[9px]">{agentDeals.length} {t('deals.dealsUnit')}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <DealDrawer deal={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
