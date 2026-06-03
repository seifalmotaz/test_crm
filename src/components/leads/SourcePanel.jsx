import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react'

const sourceIcons = {
  Website: '🌐',
  Referral: '🤝',
  'Social Media': '📱',
  'Cold Call': '📞',
  'Portal (Zillow)': '🏠',
}

function RoiBar({ value, max }) {
  const pct = Math.min((value / max) * 100, 100)
  const color = value >= 500 ? 'bg-emerald-400' : value >= 200 ? 'bg-blue-400' : value >= 100 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="h-1 bg-white/5 rounded-full w-16 overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export default function SourcePanel({ sources }) {
  const maxRoi = Math.max(...sources.map(s => s.roi))

  return (
    <div className="bg-card card-border rounded-2xl p-5 glow-blue">
      <div className="flex items-center justify-between mb-4">
        <p className="text-white font-semibold text-sm">Lead Source Performance</p>
        <span className="text-[10px] text-slate-400 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
          Referral = best ROI
        </span>
      </div>

      <div className="space-y-2.5">
        {sources.map((s) => (
          <div key={s.name} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/4 transition-colors">
            <span className="text-base flex-shrink-0">{sourceIcons[s.name]}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <p className="text-white text-xs font-medium">{s.name}</p>
                <div className={`flex items-center gap-0.5 text-[10px] font-medium ${s.trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {s.trend >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                  {s.trend >= 0 ? '+' : ''}{s.trend}%
                </div>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-slate-500">
                <span>{s.leads} leads</span>
                <span className="text-blue-400 font-medium">{s.convRate}% conv</span>
                <span>Score: {s.avgScore}</span>
                <span className={s.costPerLead === 0 ? 'text-emerald-400' : ''}>{s.costPerLead === 0 ? 'Free' : `$${s.costPerLead}/lead`}</span>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="flex items-center gap-1 justify-end mb-1">
                <DollarSign size={9} className="text-emerald-400" />
                <p className={`text-xs font-bold ${s.roi >= 500 ? 'text-emerald-400' : s.roi >= 200 ? 'text-blue-400' : 'text-amber-400'}`}>
                  {s.roi}% ROI
                </p>
              </div>
              <RoiBar value={s.roi} max={maxRoi} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-white/5 bg-blue-500/6 rounded-xl p-3">
        <p className="text-blue-300 text-[10px] font-semibold uppercase tracking-wider mb-1">AI Budget Recommendation</p>
        <p className="text-slate-300 text-xs">Shift 20% of Cold Call budget ($1,560) to Referral programs. Expected ROI improvement: +180%. Social Media spend needs review — declining conversion (-8%).</p>
      </div>
    </div>
  )
}
