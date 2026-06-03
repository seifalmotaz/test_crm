import { Users, TrendingUp, CheckCircle, Star, CreditCard } from 'lucide-react'

export const LEAD_STAGE_LABELS = {
  freshLead:     'Fresh Lead',
  qualified:     'Qualified',
  callBack:      'Call Back',
  followUp:      'Follow Up',
  notInterested: 'Not Interested',
  lowBudget:     'Low Budget',
  reservation:   'Reservation',
}

const STAGE_COLORS = {
  freshLead:     { bar: 'bg-blue-500',    text: 'text-blue-400',    badge: 'bg-blue-500/10 border-blue-500/20 text-blue-300' },
  qualified:     { bar: 'bg-emerald-500', text: 'text-emerald-400', badge: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' },
  callBack:      { bar: 'bg-amber-500',   text: 'text-amber-400',   badge: 'bg-amber-500/10 border-amber-500/20 text-amber-300' },
  followUp:      { bar: 'bg-purple-500',  text: 'text-purple-400',  badge: 'bg-purple-500/10 border-purple-500/20 text-purple-300' },
  notInterested: { bar: 'bg-red-500',     text: 'text-red-400',     badge: 'bg-red-500/10 border-red-500/20 text-red-300' },
  lowBudget:     { bar: 'bg-slate-500',   text: 'text-slate-400',   badge: 'bg-slate-500/10 border-slate-500/20 text-slate-300' },
  reservation:   { bar: 'bg-teal-500',    text: 'text-teal-400',    badge: 'bg-teal-500/10 border-teal-500/20 text-teal-300' },
}

function fmtBudget(n) {
  if (!n) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  return `$${(n / 1_000).toFixed(0)}K`
}

export default function LeadsAnalytics({ funnel, conversionRate, bySource }) {
  const totalLeads      = funnel.reduce((s, r) => s + r.count, 0)
  const qualifiedCount  = funnel.find(r => r.stage === 'qualified')?.count  || 0
  const reservedCount   = funnel.find(r => r.stage === 'reservation')?.count || 0
  const preApproved     = bySource.reduce((s, r) => s + (r.preApprovedCount || 0), 0)
  const qualifiedRate   = totalLeads > 0 ? Math.round((qualifiedCount / totalLeads) * 100)  : 0
  const reservationRate = totalLeads > 0 ? Math.round((reservedCount  / totalLeads) * 100)  : 0
  const avgScore = bySource.length > 0
    ? Math.round(
        bySource.reduce((s, r) => s + Number(r.avgScore) * Number(r.totalLeads), 0) /
        (bySource.reduce((s, r) => s + Number(r.totalLeads), 0) || 1)
      )
    : 0

  const maxCount = Math.max(...funnel.map(r => r.count), 1)

  const kpis = [
    {
      label: 'Total Leads', value: totalLeads,
      icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/15',
    },
    {
      label: 'Qualified Rate', value: `${qualifiedRate}%`,
      icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/15',
      sub: `${qualifiedCount} leads reached qualified`,
    },
    {
      label: 'Reservation Rate', value: `${reservationRate}%`,
      icon: TrendingUp, color: 'text-teal-400', bg: 'bg-teal-500/15',
      sub: `${reservedCount} converted`,
    },
    {
      label: 'Pre-Approved', value: preApproved,
      icon: CreditCard, color: 'text-purple-400', bg: 'bg-purple-500/15',
      sub: `${totalLeads > 0 ? Math.round(preApproved / totalLeads * 100) : 0}% of total`,
    },
    {
      label: 'Avg Lead Score', value: avgScore,
      icon: Star, color: 'text-amber-400', bg: 'bg-amber-500/15',
      sub: 'out of 100',
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

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Stage Funnel */}
        <div className="flex-1 bg-card card-border rounded-2xl p-4 glow-blue">
          <div className="flex items-center justify-between mb-4">
            <p className="text-white font-semibold text-xs">Lead Stage Funnel</p>
            <span className="text-[9px] text-slate-500">{totalLeads} total leads</span>
          </div>

          {funnel.length === 0 ? (
            <p className="text-slate-500 text-xs text-center py-8">No lead data available</p>
          ) : (
            <div className="space-y-3">
              {funnel.map(row => {
                const cfg = STAGE_COLORS[row.stage] || STAGE_COLORS.freshLead
                const barPct = (row.count / maxCount) * 100
                return (
                  <div key={row.stage}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${cfg.badge}`}>
                        {LEAD_STAGE_LABELS[row.stage] || row.stage}
                      </span>
                      <div className="flex items-center gap-3 text-[10px]">
                        <span className="text-slate-500">{row.avgDaysInStage}d avg</span>
                        <span className="text-slate-500">score {row.avgScore}</span>
                        <span className={`font-bold ${cfg.text}`}>{row.pctOfTotal}%</span>
                        <span className="text-white font-bold w-8 text-right">{row.count}</span>
                      </div>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${cfg.bar} transition-all duration-500`}
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {qualifiedRate > 0 && (
            <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <p className="text-blue-200 text-[10px] leading-relaxed">
                <span className="font-bold">Funnel health:</span>{' '}
                {qualifiedRate}% qualify → {reservationRate}% convert to reservation.
                {reservationRate < 10 ? ' Improve mid-funnel nurturing to boost conversion.' : ' Conversion is on track.'}
              </p>
            </div>
          )}
        </div>

        {/* Stage Summary Sidebar */}
        <div className="w-full lg:w-52 space-y-2">
          {funnel.map(row => {
            const cfg = STAGE_COLORS[row.stage] || STAGE_COLORS.freshLead
            return (
              <div key={row.stage} className="bg-card card-border rounded-2xl p-3 glow-blue">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-slate-400 text-[10px] truncate">{LEAD_STAGE_LABELS[row.stage] || row.stage}</p>
                    <p className={`text-xl font-bold ${cfg.text}`}>{row.count}</p>
                    <p className="text-slate-600 text-[9px]">{row.avgDaysInStage}d · score {row.avgScore}</p>
                  </div>
                  <p className={`text-base font-bold ${cfg.text} flex-shrink-0`}>{row.pctOfTotal}%</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Source Performance Table */}
      <div className="bg-card card-border rounded-2xl p-4 glow-blue">
        <div className="flex items-center justify-between mb-4">
          <p className="text-white font-semibold text-xs">Lead Source Performance</p>
          <span className="text-[9px] text-slate-500">{bySource.length} sources · {conversionRate}% overall conversion</span>
        </div>

        {bySource.length === 0 ? (
          <p className="text-slate-500 text-xs text-center py-6">No source data available</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[9px] text-slate-500 uppercase tracking-wider border-b border-white/5">
                  <th className="text-left pb-2 font-medium pr-3">Source</th>
                  <th className="text-right pb-2 font-medium px-2">Leads</th>
                  <th className="text-right pb-2 font-medium px-2">Converted</th>
                  <th className="text-right pb-2 font-medium px-2">Conv %</th>
                  <th className="text-right pb-2 font-medium px-2">Avg Score</th>
                  <th className="text-right pb-2 font-medium px-2">Avg Budget</th>
                  <th className="text-right pb-2 font-medium pl-2">Pre-Approved</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {bySource.map((s, i) => {
                  const conv  = Number(s.conversionRate)
                  const score = Number(s.avgScore)
                  return (
                    <tr key={s.source} className="hover:bg-white/2 transition-colors">
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0"
                            style={{ opacity: Math.max(0.3, 1 - i * 0.12) }}
                          />
                          <span className="text-white text-[10px] font-medium">{s.source}</span>
                        </div>
                      </td>
                      <td className="py-2.5 text-right text-[10px] text-slate-300 px-2">{s.totalLeads}</td>
                      <td className="py-2.5 text-right text-[10px] font-bold text-emerald-400 px-2">{s.closedLeads}</td>
                      <td className="py-2.5 text-right px-2">
                        <span className={`text-[10px] font-bold ${conv >= 20 ? 'text-emerald-400' : conv >= 10 ? 'text-amber-400' : 'text-red-400'}`}>
                          {conv}%
                        </span>
                      </td>
                      <td className="py-2.5 text-right px-2">
                        <span className={`text-[10px] font-bold ${score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-slate-400'}`}>
                          {score}
                        </span>
                      </td>
                      <td className="py-2.5 text-right text-[10px] text-slate-300 px-2">{fmtBudget(Number(s.avgBudget))}</td>
                      <td className="py-2.5 text-right text-[10px] text-purple-400 font-bold pl-2">{s.preApprovedCount}</td>
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
