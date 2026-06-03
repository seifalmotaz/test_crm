import { X, TrendingUp, TrendingDown, Star, AlertTriangle, CheckCircle, Users, Phone, Mail, Award } from 'lucide-react'
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { tierConfig } from '../../data/agentsData'
import { useLang } from '../../context/LanguageContext'

function fmt(v) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v}`
}

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-navy-700 border border-blue-500/20 rounded-xl px-3 py-2 shadow-xl">
      <p className="text-slate-400 text-[10px] mb-0.5">{label}</p>
      <p className="text-white font-bold text-xs">{fmt(payload[0].value)}</p>
    </div>
  )
}

export default function AgentDrawer({ agent, onClose }) {
  const { t } = useLang()

  const retentionConfig = {
    high:   { label: t('agents.drawer.highRiskLabel'),   color: 'text-red-300 bg-red-500/15 border-red-500/25',       message: t('agents.drawer.highRiskMsg') },
    medium: { label: t('agents.drawer.mediumRiskLabel'), color: 'text-amber-300 bg-amber-500/15 border-amber-500/25', message: t('agents.drawer.mediumRiskMsg') },
    low:    { label: t('agents.drawer.lowRiskLabel'),    color: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/25', message: t('agents.drawer.lowRiskMsg') },
  }

  if (!agent) return null

  const tier = tierConfig[agent.tier]
  const chartData = (agent.monthlyRevenue ?? []).map((v, i) => ({ month: months[i], revenue: v }))
  const revChange = agent.revenuePrev > 0 ? ((agent.revenueYTD - agent.revenuePrev) / agent.revenuePrev * 100).toFixed(1) : null
  const convChange = agent.conversionRate - agent.prevConversionRate
  const retention = retentionConfig[agent.retentionRisk]

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[520px] bg-navy-800 border-l border-blue-500/15 z-50 overflow-y-auto shadow-2xl">

        <div className="sticky top-0 bg-navy-800/95 backdrop-blur-sm border-b border-white/5 px-6 py-4 flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-base font-bold flex-shrink-0"
            style={{ backgroundColor: `${agent.color}20`, border: `1px solid ${agent.color}40`, color: agent.color }}
          >
            {agent.avatar}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-white font-bold text-base">{agent.name}</p>
              {agent.rank <= 3 && <Award size={14} className="text-amber-400" />}
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${tier.color}`}>{tier.label}</span>
              <span className="text-slate-400 text-xs">{agent.specialization} · {agent.region} · {agent.tenure}{t('agents.drawer.yr')}</span>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">

          <div className="bg-white/4 border border-white/8 rounded-2xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-slate-400 text-[10px] uppercase tracking-wider">{t('agents.drawer.revenueYTD')}</p>
                <p className="text-white text-3xl font-bold">{fmt(agent.revenueYTD)}</p>
                {revChange !== null && (
                  <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${parseFloat(revChange) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {parseFloat(revChange) >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {parseFloat(revChange) >= 0 ? '+' : ''}{revChange}% {t('agents.drawer.vsLastYear')}
                  </div>
                )}
              </div>
              <div className="text-right">
                <p className="text-slate-400 text-[10px] uppercase tracking-wider">{t('agents.drawer.teamRank')}</p>
                <p className="text-white text-3xl font-bold">#{agent.rank}</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={80}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id={`grad_${agent.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={agent.color} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={agent.color} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={false} />
                <Area type="monotone" dataKey="revenue" stroke={agent.color} strokeWidth={2} fill={`url(#grad_${agent.id})`} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {[
              { label: t('agents.drawer.dealsYTD'),   value: agent.dealsClosedYTD,       sub: `${agent.dealsClosedMonth} ${t('agents.drawer.thisMonth')}` },
              { label: t('agents.drawer.conversion'), value: `${agent.conversionRate}%`,  sub: convChange > 0 ? `+${convChange}${t('agents.drawer.ppUp')}` : `${convChange}${t('agents.drawer.ppDown')}`, subColor: convChange > 0 ? 'text-emerald-400' : 'text-red-400' },
              { label: t('agents.drawer.avgClose'),   value: `${agent.avgDaysToClose}d`,  sub: `${agent.activeDeals} ${t('agents.drawer.active')}` },
              { label: t('agents.drawer.rankNPS'),    value: agent.npsScore,              sub: `${agent.repeatClientRate}${t('agents.drawer.repeatSuffix')}` },
            ].map(({ label, value, sub, subColor }) => (
              <div key={label} className="bg-white/4 border border-white/8 rounded-xl p-3 text-center">
                <p className="text-slate-500 text-[9px] uppercase tracking-wider mb-1">{label}</p>
                <p className="text-white text-lg font-bold">{value}</p>
                <p className={`text-[9px] mt-0.5 ${subColor ?? 'text-slate-500'}`}>{sub}</p>
              </div>
            ))}
          </div>

          <div>
            <p className="text-white font-semibold text-xs mb-2">{t('agents.drawer.peerRanking')} {12})</p>
            <div className="grid grid-cols-4 gap-2">
              {[
                { key: 'rankRevenue',    label: t('agents.drawer.rankRevenue') },
                { key: 'rankConversion', label: t('agents.drawer.rankConversion') },
                { key: 'rankSpeed',      label: t('agents.drawer.rankSpeed') },
                { key: 'rankNPS',        label: t('agents.drawer.rankNPS') },
              ].map(({ key, label }) => {
                const rank = agent[key]
                const isTop = rank <= 3
                return (
                  <div key={key} className={`rounded-xl p-2.5 text-center border ${isTop ? 'bg-amber-500/10 border-amber-500/25' : 'bg-white/3 border-white/6'}`}>
                    <p className="text-slate-500 text-[9px] mb-1">{label}</p>
                    <p className={`text-lg font-bold ${isTop ? 'text-amber-400' : 'text-white'}`}>#{rank}</p>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <a href={`mailto:${agent.email}`} className="flex items-center gap-2 p-2.5 bg-white/4 border border-white/8 rounded-xl hover:bg-white/8 transition-all">
              <Mail size={13} className="text-blue-400 flex-shrink-0" />
              <p className="text-slate-300 text-xs truncate">{agent.email}</p>
            </a>
            <a href={`tel:${agent.phone}`} className="flex items-center gap-2 p-2.5 bg-white/4 border border-white/8 rounded-xl hover:bg-white/8 transition-all">
              <Phone size={13} className="text-emerald-400 flex-shrink-0" />
              <p className="text-slate-300 text-xs">{agent.phone}</p>
            </a>
          </div>

          <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-2xl p-4">
            <p className="text-emerald-300 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-2">
              <CheckCircle size={12} /> {t('agents.drawer.strengths')}
            </p>
            <ul className="space-y-1.5">
              {agent.strengths.map((s, i) => (
                <li key={i} className="text-slate-300 text-xs flex items-start gap-2">
                  <span className="text-emerald-400 flex-shrink-0">·</span> {s}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-amber-500/8 border border-amber-500/20 rounded-2xl p-4">
            <p className="text-amber-300 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-2">
              <Star size={12} /> {t('agents.drawer.developmentAreas')}
            </p>
            <ul className="space-y-1.5">
              {agent.developmentAreas.map((d, i) => (
                <li key={i} className="text-slate-300 text-xs flex items-start gap-2">
                  <span className="text-amber-400 flex-shrink-0">·</span> {d}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-blue-500/8 border border-blue-500/20 rounded-2xl p-4">
            <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-2">
              <Star size={12} /> {t('agents.drawer.aiRecommendation')}
            </p>
            <p className="text-slate-200 text-sm leading-relaxed">{agent.recommendation}</p>
          </div>

          <div className="bg-purple-500/8 border border-purple-500/20 rounded-2xl p-4">
            <p className="text-purple-300 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-2">
              <Users size={12} /> {t('agents.drawer.coachingPlan')}
            </p>
            <p className="text-slate-200 text-sm leading-relaxed">{agent.coachingPlan}</p>
          </div>

          <div className={`rounded-2xl p-4 border ${retention.color}`}>
            <div className="flex items-center gap-2 mb-1">
              {agent.retentionRisk === 'high' ? <AlertTriangle size={13} /> : <CheckCircle size={13} />}
              <p className="text-xs font-semibold uppercase tracking-wider">{t('agents.drawer.retentionRisk')}: {retention.label}</p>
            </div>
            <p className="text-slate-300 text-xs">{retention.message}</p>
          </div>

          {agent.recentDeals.length > 0 && (
            <div>
              <p className="text-white font-semibold text-xs mb-2">{t('agents.drawer.activeDeals')}</p>
              <div className="space-y-2">
                {agent.recentDeals.map((d, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 bg-white/3 border border-white/6 rounded-xl">
                    <span className="text-lg">🏠</span>
                    <div className="flex-1">
                      <p className="text-white text-xs font-medium">{d.property}</p>
                      <p className="text-slate-500 text-[10px]">{d.stage} · {d.date}</p>
                    </div>
                    <p className="text-white text-xs font-bold">{fmt(d.value)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 pb-2">
            <button className="flex items-center justify-center gap-2 py-2.5 bg-white/5 border border-white/10 rounded-xl text-slate-300 text-xs font-medium hover:bg-white/10 transition-all">
              <Mail size={13} /> {t('agents.drawer.message')}
            </button>
            <button className="flex items-center justify-center gap-2 py-2.5 bg-blue-500 rounded-xl text-white text-xs font-medium hover:bg-blue-600 transition-all">
              <Users size={13} /> {t('agents.drawer.schedule1on1')}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
