import { Users, DollarSign, TrendingUp, Award, Star } from 'lucide-react'

const TIER_META = {
  elite:     { label: 'Elite',     color: '#f59e0b', bg: 'bg-amber-500/15 text-amber-400',  border: 'border-amber-500/30' },
  core:      { label: 'Core',      color: '#3b82f6', bg: 'bg-blue-500/15 text-blue-400',    border: 'border-blue-500/30' },
  developing:{ label: 'Dev',       color: '#64748b', bg: 'bg-slate-500/15 text-slate-400',  border: 'border-slate-500/30' },
}

const RISK_COLORS = {
  low:    'text-emerald-400',
  medium: 'text-amber-400',
  high:   'text-red-400',
}

function fmt(n) {
  if (!n && n !== 0) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  return `$${(n / 1_000).toFixed(0)}K`
}

export default function AgentsAnalytics({ agents }) {
  const totalRevenue  = agents.reduce((s, a) => s + (a.revenueYTD || 0), 0)
  const avgConversion = agents.length > 0
    ? Math.round(agents.reduce((s, a) => s + (a.conversionRate || 0), 0) / agents.length)
    : 0
  const avgNPS = agents.length > 0
    ? (agents.reduce((s, a) => s + (a.npsScore || 0), 0) / agents.length).toFixed(1)
    : '—'
  const eliteCount = agents.filter(a => a.tier === 'elite').length
  const atRiskCount = agents.filter(a => a.retentionRisk === 'high').length

  const kpis = [
    {
      label: 'Total Agents', value: agents.length,
      icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/15',
    },
    {
      label: 'Revenue YTD', value: fmt(totalRevenue),
      icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/15',
      sub: 'All agents combined',
    },
    {
      label: 'Elite Agents', value: eliteCount,
      icon: Award, color: 'text-amber-400', bg: 'bg-amber-500/15',
      sub: agents.length > 0 ? `${Math.round(eliteCount / agents.length * 100)}% of team` : '',
    },
    {
      label: 'Avg Conversion', value: `${avgConversion}%`,
      icon: TrendingUp, color: 'text-purple-400', bg: 'bg-purple-500/15',
      sub: 'Lead-to-reservation',
    },
    {
      label: 'Avg NPS', value: avgNPS,
      icon: Star, color: 'text-teal-400', bg: 'bg-teal-500/15',
      sub: 'Client satisfaction',
    },
  ]

  const tierCounts = {
    elite:     agents.filter(a => a.tier === 'elite').length,
    core:      agents.filter(a => a.tier === 'core').length,
    developing:agents.filter(a => a.tier === 'developing').length,
  }
  const tierRevenue = {
    elite:     agents.filter(a => a.tier === 'elite').reduce((s, a) => s + (a.revenueYTD || 0), 0),
    core:      agents.filter(a => a.tier === 'core').reduce((s, a) => s + (a.revenueYTD || 0), 0),
    developing:agents.filter(a => a.tier === 'developing').reduce((s, a) => s + (a.revenueYTD || 0), 0),
  }

  return (
    <div className="space-y-4">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpis.map(({ label, value, icon: Icon, color, bg, sub }) => (
          <div key={label} className="bg-card card-border rounded-2xl p-4 flex items-center gap-3 glow-blue">
            <div className={`w-10 h-10 rounded-xl ${bg} ${color} flex items-center justify-center flex-shrink-0`}>
              <Icon size={18} />
            </div>
            <div>
              <p className="text-slate-400 text-[10px] uppercase tracking-wider">{label}</p>
              <p className="text-white text-lg font-bold leading-none mt-0.5">{value}</p>
              {sub && <p className="text-slate-500 text-[10px] mt-0.5">{sub}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* Retention Risk Banner */}
      {atRiskCount > 0 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3">
          <Award size={16} className="text-red-400 flex-shrink-0" />
          <p className="text-red-200 text-[10px]">
            <span className="font-bold">{atRiskCount} agent{atRiskCount !== 1 ? 's' : ''}</span>{' '}
            flagged high retention risk — immediate engagement recommended to prevent revenue loss.
          </p>
        </div>
      )}

      {/* Tier Breakdown */}
      <div className="grid grid-cols-3 gap-3">
        {['elite', 'core', 'developing'].map(tier => {
          const meta = TIER_META[tier]
          const count = tierCounts[tier]
          const rev   = tierRevenue[tier]
          const pct   = totalRevenue > 0 ? Math.round((rev / totalRevenue) * 100) : 0
          return (
            <div key={tier} className={`bg-card card-border rounded-2xl p-4 glow-blue border ${meta.border}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded capitalize ${meta.bg}`}>
                  {meta.label}
                </span>
                <span className="text-slate-500 text-[9px]">{count} agents</span>
              </div>
              <p className="text-white text-xl font-bold">{fmt(rev)}</p>
              <p className="text-slate-500 text-[10px] mt-0.5">{pct}% of total revenue</p>
              <div className="mt-2 h-1 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: meta.color }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Leaderboard Table */}
      <div className="bg-card card-border rounded-2xl p-4 glow-blue">
        <div className="flex items-center justify-between mb-4">
          <p className="text-white font-semibold text-xs">Agent Leaderboard</p>
          <span className="text-[9px] text-slate-500">Ranked by Revenue YTD · {agents.length} agents</span>
        </div>

        {agents.length === 0 ? (
          <p className="text-slate-500 text-xs text-center py-8">No agent data available</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[9px] text-slate-500 uppercase tracking-wider border-b border-white/5">
                  <th className="text-center pb-2 font-medium w-8">#</th>
                  <th className="text-left pb-2 font-medium pr-3">Agent</th>
                  <th className="text-center pb-2 font-medium px-2">Tier</th>
                  <th className="text-right pb-2 font-medium px-2">Revenue YTD</th>
                  <th className="text-right pb-2 font-medium px-2">Growth</th>
                  <th className="text-right pb-2 font-medium px-2">Deals</th>
                  <th className="text-right pb-2 font-medium px-2">Conv %</th>
                  <th className="text-right pb-2 font-medium px-2">NPS</th>
                  <th className="text-right pb-2 font-medium px-2">Avg Close</th>
                  <th className="text-right pb-2 font-medium px-2">Leads</th>
                  <th className="text-right pb-2 font-medium pl-2">Retention</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {agents.map(a => {
                  const tierMeta    = TIER_META[a.tier] || TIER_META.developing
                  const growthColor = (a.revenueGrowthPct ?? 0) > 0
                    ? 'text-emerald-400'
                    : (a.revenueGrowthPct ?? 0) < 0
                    ? 'text-red-400'
                    : 'text-slate-500'
                  const rankColor = a.leaderboardRank === 1 ? 'text-amber-400 font-bold'
                    : a.leaderboardRank === 2 ? 'text-slate-300 font-bold'
                    : a.leaderboardRank === 3 ? 'text-amber-700 font-bold'
                    : 'text-slate-500'
                  return (
                    <tr key={a.id} className="hover:bg-white/2 transition-colors">
                      <td className="py-2.5 text-center">
                        <span className={`text-[10px] ${rankColor}`}>#{a.leaderboardRank}</span>
                      </td>
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                            style={{ backgroundColor: a.color || '#3b82f6' }}
                          >
                            {(a.name || '?').slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-white text-[10px] font-medium leading-none">{a.name}</p>
                            <p className="text-slate-500 text-[9px]">{a.region}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 text-center px-2">
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${tierMeta.bg}`}>
                          {tierMeta.label}
                        </span>
                      </td>
                      <td className="py-2.5 text-right text-[10px] font-bold text-white px-2">
                        {fmt(a.revenueYTD)}
                      </td>
                      <td className="py-2.5 text-right px-2">
                        <span className={`text-[10px] font-bold ${growthColor}`}>
                          {a.revenueGrowthPct != null
                            ? `${a.revenueGrowthPct > 0 ? '+' : ''}${a.revenueGrowthPct}%`
                            : '—'}
                        </span>
                      </td>
                      <td className="py-2.5 text-right text-[10px] text-slate-300 px-2">
                        {a.dealsClosedYTD}
                      </td>
                      <td className="py-2.5 text-right px-2">
                        <span className={`text-[10px] font-bold ${
                          a.conversionRate >= 30 ? 'text-emerald-400'
                          : a.conversionRate >= 20 ? 'text-amber-400'
                          : 'text-red-400'
                        }`}>
                          {a.conversionRate}%
                        </span>
                      </td>
                      <td className="py-2.5 text-right px-2">
                        <span className={`text-[10px] font-bold ${
                          a.npsScore >= 80 ? 'text-emerald-400'
                          : a.npsScore >= 60 ? 'text-amber-400'
                          : 'text-red-400'
                        }`}>
                          {a.npsScore}
                        </span>
                      </td>
                      <td className="py-2.5 text-right text-[10px] text-slate-300 px-2">
                        {a.avgDaysToClose}d
                      </td>
                      <td className="py-2.5 text-right text-[10px] text-slate-300 px-2">
                        {a.leadsAssigned}
                      </td>
                      <td className="py-2.5 text-right pl-2">
                        <span className={`text-[9px] font-bold capitalize ${RISK_COLORS[a.retentionRisk] || 'text-slate-400'}`}>
                          {a.retentionRisk}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
