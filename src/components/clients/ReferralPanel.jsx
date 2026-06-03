import { GitBranch, TrendingUp } from 'lucide-react'

function fmt(v) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v}`
}

export default function ReferralPanel({ sources, onSelect, clients }) {
  const maxVal = Math.max(...sources.map(s => s.value))

  return (
    <div className="bg-card card-border rounded-2xl p-5 glow-blue">
      <div className="flex items-center gap-2 mb-4">
        <GitBranch size={15} className="text-emerald-400" />
        <p className="text-white font-semibold text-sm">Top Referral Sources</p>
      </div>

      <div className="space-y-2.5">
        {sources.map((s, i) => {
          const client = clients.find(c => c.name === s.name)
          return (
            <div
              key={s.name}
              onClick={() => client && onSelect(client)}
              className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
            >
              <div className="text-sm font-black text-slate-500 w-5 text-center flex-shrink-0">
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
              </div>
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                style={{ backgroundColor: `${s.color}20`, color: s.color }}
              >
                {s.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-medium truncate">{s.name}</p>
                <div className="h-1 bg-white/5 rounded-full mt-1 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(s.value / maxVal) * 100}%`, backgroundColor: s.color }} />
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-white text-xs font-bold">{fmt(s.value)}</p>
                <p className="text-slate-500 text-[9px]">{s.referrals} referrals</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-white/5 bg-blue-500/6 rounded-xl p-3">
        <p className="text-blue-300 text-[10px] font-semibold uppercase tracking-wider mb-1">AI Insight</p>
        <p className="text-slate-300 text-xs leading-relaxed">Helen Crawford (dormant, 272d) is your best historical referral source. Re-engaging her could unlock $4M+ in pipeline. Personalized outreach is critical.</p>
      </div>
    </div>
  )
}
