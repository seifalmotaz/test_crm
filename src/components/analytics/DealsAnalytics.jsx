import { DollarSign, BarChart3, AlertTriangle, TrendingUp, Target } from 'lucide-react'

const STAGE_META = {
  offer:       { label: 'Offer',       color: '#3b82f6', bar: 'bg-blue-500' },
  negotiation: { label: 'Negotiation', color: '#8b5cf6', bar: 'bg-purple-500' },
  inspection:  { label: 'Inspection',  color: '#f59e0b', bar: 'bg-amber-500' },
  appraisal:   { label: 'Appraisal',   color: '#f97316', bar: 'bg-orange-500' },
  closing:     { label: 'Closing',     color: '#10b981', bar: 'bg-emerald-500' },
}

const RISK_META = {
  critical: { text: 'text-red-400',   bg: 'bg-red-500/10 border-red-500/30' },
  high:     { text: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' },
  medium:   { text: 'text-blue-400',  bg: 'bg-blue-500/10 border-blue-500/30' },
}

function fmt(n) {
  if (!n && n !== 0) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  return `$${(n / 1_000).toFixed(0)}K`
}

export default function DealsAnalytics({ pipeline, riskDeals }) {
  const totalValue    = pipeline.reduce((s, r) => s + Number(r.totalValue),    0)
  const weightedValue = pipeline.reduce((s, r) => s + Number(r.weightedValue), 0)
  const totalDeals    = pipeline.reduce((s, r) => s + r.dealCount, 0)
  const avgDealSize   = totalDeals > 0 ? Math.round(totalValue / totalDeals) : 0
  const avgProb       = pipeline.length > 0
    ? Math.round(
        pipeline.reduce((s, r) => s + Number(r.avgProbability) * r.dealCount, 0) / (totalDeals || 1)
      )
    : 0

  const maxValue = Math.max(...pipeline.map(r => Number(r.totalValue)), 1)

  const criticalCount = riskDeals.filter(d => d.riskLevel === 'critical').length
  const highCount     = riskDeals.filter(d => d.riskLevel === 'high').length

  const kpis = [
    {
      label: 'Total Pipeline', value: fmt(totalValue),
      icon: DollarSign, color: 'text-blue-400', bg: 'bg-blue-500/15',
      sub: `${totalDeals} active deals`,
    },
    {
      label: 'Weighted Pipeline', value: fmt(weightedValue),
      icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/15',
      sub: 'Probability-adjusted',
    },
    {
      label: 'Active Deals', value: totalDeals,
      icon: BarChart3, color: 'text-purple-400', bg: 'bg-purple-500/15',
      sub: `${pipeline.length} stages`,
    },
    {
      label: 'Avg Deal Size', value: fmt(avgDealSize),
      icon: DollarSign, color: 'text-amber-400', bg: 'bg-amber-500/15',
    },
    {
      label: 'Avg Probability', value: `${avgProb}%`,
      icon: Target, color: 'text-slate-400', bg: 'bg-slate-500/15',
      sub: 'Close likelihood',
    },
  ]

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

      {/* Risk Summary Banner */}
      {riskDeals.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-300 text-xs font-semibold mb-1">
              {riskDeals.length} Deal{riskDeals.length !== 1 ? 's' : ''} at Risk
            </p>
            <p className="text-slate-300 text-[10px]">
              {criticalCount > 0 && `${criticalCount} critical · `}
              {highCount > 0 && `${highCount} high risk · `}
              {riskDeals.length - criticalCount - highCount} medium risk.
              {' '}Total exposed value: {fmt(riskDeals.reduce((s, d) => s + d.value, 0))}.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Pipeline by Stage */}
        <div className="flex-1 bg-card card-border rounded-2xl p-4 glow-blue">
          <div className="flex items-center justify-between mb-4">
            <p className="text-white font-semibold text-xs">Pipeline by Stage</p>
            <span className="text-[9px] text-slate-500">{fmt(weightedValue)} weighted</span>
          </div>

          {pipeline.length === 0 ? (
            <p className="text-slate-500 text-xs text-center py-8">No active deals in pipeline</p>
          ) : (
            <div className="space-y-4">
              {pipeline.map(row => {
                const meta   = STAGE_META[row.stage] || { label: row.stage, color: '#64748b', bar: 'bg-slate-500' }
                const barPct = (Number(row.totalValue) / maxValue) * 100
                return (
                  <div key={row.stage}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: meta.color }} />
                        <span className="text-white text-[10px] font-medium">{meta.label}</span>
                        <span className="text-slate-500 text-[9px]">{row.dealCount} deals</span>
                      </div>
                      <div className="text-right">
                        <span className="text-white text-[10px] font-bold">{fmt(Number(row.totalValue))}</span>
                        <span className="text-slate-500 text-[9px] ml-2">{fmt(Number(row.weightedValue))} wtd</span>
                      </div>
                    </div>
                    <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${meta.bar} transition-all duration-500`}
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                    <p className="text-[9px] text-slate-600 mt-0.5">{Number(row.avgProbability).toFixed(1)}% avg close probability</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Stage Summary Cards */}
        <div className="w-full lg:w-52 space-y-2">
          {pipeline.map(row => {
            const meta = STAGE_META[row.stage] || { label: row.stage, color: '#64748b' }
            return (
              <div key={row.stage} className="bg-card card-border rounded-2xl p-3 glow-blue">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-slate-400 text-[10px]">{meta.label}</p>
                    <p className="text-white text-lg font-bold">{fmt(Number(row.totalValue))}</p>
                    <p className="text-slate-600 text-[9px]">{row.dealCount} deals · {Number(row.avgProbability).toFixed(0)}%</p>
                  </div>
                  <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: meta.color }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Deals at Risk Table */}
      {riskDeals.length > 0 && (
        <div className="bg-card card-border rounded-2xl p-4 glow-blue">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={13} className="text-red-400" />
            <p className="text-white font-semibold text-xs">Deals at Risk</p>
            <span className="text-[9px] text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
              {riskDeals.length} deals
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[9px] text-slate-500 uppercase tracking-wider border-b border-white/5">
                  <th className="text-left pb-2 font-medium pr-3">Property</th>
                  <th className="text-right pb-2 font-medium px-2">Value</th>
                  <th className="text-right pb-2 font-medium px-2">Stage</th>
                  <th className="text-right pb-2 font-medium px-2">Prob</th>
                  <th className="text-right pb-2 font-medium px-2">Days Left</th>
                  <th className="text-right pb-2 font-medium px-2">Risk</th>
                  <th className="text-right pb-2 font-medium px-2">Risk Factors</th>
                  <th className="text-right pb-2 font-medium pl-2">Agent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {riskDeals.map(d => {
                  const rMeta = RISK_META[d.riskLevel] || RISK_META.medium
                  return (
                    <tr key={d.id} className="hover:bg-white/2 transition-colors">
                      <td className="py-2.5 pr-3">
                        <p className="text-white text-[10px] font-medium truncate max-w-36">{d.address}</p>
                        <p className="text-slate-500 text-[9px]">{d.neighborhood}</p>
                      </td>
                      <td className="py-2.5 text-right text-[10px] font-bold text-white px-2">{fmt(d.value)}</td>
                      <td className="py-2.5 text-right text-[10px] text-slate-300 capitalize px-2">{d.stage}</td>
                      <td className="py-2.5 text-right px-2">
                        <span className={`text-[10px] font-bold ${
                          d.closingProbability >= 75 ? 'text-emerald-400'
                          : d.closingProbability >= 50 ? 'text-amber-400'
                          : 'text-red-400'
                        }`}>
                          {d.closingProbability}%
                        </span>
                      </td>
                      <td className="py-2.5 text-right px-2">
                        <span className={`text-[10px] font-bold ${
                          d.daysToClose < 7 ? 'text-red-400' : d.daysToClose < 14 ? 'text-amber-400' : 'text-slate-300'
                        }`}>
                          {d.daysToClose}d
                        </span>
                      </td>
                      <td className="py-2.5 text-right px-2">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded capitalize border ${rMeta.bg} ${rMeta.text}`}>
                          {d.riskLevel}
                        </span>
                      </td>
                      <td className="py-2.5 text-right px-2">
                        <p className="text-slate-500 text-[9px] max-w-32 text-right ml-auto truncate" title={d.riskFactors}>
                          {d.riskFactors || '—'}
                        </p>
                      </td>
                      <td className="py-2.5 text-right text-[9px] text-slate-400 pl-2">{d.agentName}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
