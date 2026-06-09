import { Trophy } from 'lucide-react'
import { useState } from 'react'
import type { UserWithKPIs } from '../../types/users'

function fmt(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v}`
}

const METRICS = ['revenue', 'deals', 'conversion', 'nps'] as const
type Metric = (typeof METRICS)[number]

const metricLabels: Record<Metric, string> = {
  revenue: 'Revenue',
  deals: 'Deals',
  conversion: 'Conversion',
  nps: 'NPS',
}

function getValue(agent: UserWithKPIs, metric: Metric): number {
  switch (metric) {
    case 'revenue': return agent.revenueYTD
    case 'deals': return agent.dealsClosedYTD
    case 'conversion': return agent.conversionRate
    case 'nps': return agent.npsScore
  }
}

function fmtValue(v: number, metric: Metric): string {
  switch (metric) {
    case 'revenue': return fmt(v)
    case 'conversion': return `${v}%`
    default: return String(v)
  }
}

const rankEmoji = ['🥇', '🥈', '🥉']

const roleConfig: Record<string, { label: string; color: string }> = {
  admin: { label: 'Admin', color: 'text-amber-300 bg-amber-500/15 border-amber-500/30' },
  manager: { label: 'Manager', color: 'text-blue-300 bg-blue-500/15 border-blue-500/30' },
  agent: { label: 'Agent', color: 'text-slate-300 bg-slate-500/15 border-slate-500/30' },
}

interface LeaderboardPanelProps {
  agents: UserWithKPIs[]
  onSelect: (agent: UserWithKPIs) => void
}

export default function LeaderboardPanel({ agents, onSelect }: LeaderboardPanelProps) {
  const [metric, setMetric] = useState<Metric>('revenue')

  const sorted = [...agents]
    .filter(a => a.status === 'active')
    .sort((a, b) => getValue(b, metric) - getValue(a, metric))
    .slice(0, 5)

  if (!sorted.length) return null

  const max = getValue(sorted[0], metric) || 1

  return (
    <div className="bg-card card-border rounded-2xl p-5 glow-blue">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trophy size={15} className="text-amber-400" />
          <p className="text-white font-semibold text-sm">Leaderboard</p>
        </div>
        <div className="flex gap-1">
          {METRICS.map(m => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-all ${
                metric === m ? 'bg-blue-500 text-white' : 'text-slate-400 bg-white/4 hover:text-white hover:bg-white/8'
              }`}
            >
              {metricLabels[m]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2.5">
        {sorted.map((agent, i) => {
          const val = getValue(agent, metric)
          const pct = (val / max) * 100
          const roleCfg = roleConfig[agent.role]

          return (
            <div
              key={agent.id}
              onClick={() => onSelect(agent)}
              className="flex items-center gap-3 cursor-pointer group hover:bg-white/4 rounded-xl p-1.5 -mx-1.5 transition-all"
            >
              <div className="w-6 text-center text-sm flex-shrink-0">
                {i < 3 ? (
                  <span>{rankEmoji[i]}</span>
                ) : (
                  <span className="text-slate-500 text-xs font-bold">#{i + 1}</span>
                )}
              </div>
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                style={{ backgroundColor: `${agent.color}20`, color: agent.color }}
              >
                {agent.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <p className="text-white text-xs font-medium">{(agent.name || '').split(' ')[0]}</p>
                  <span className={`text-[8px] px-1 rounded-full ${roleCfg.color}`}>{roleCfg.label}</span>
                </div>
                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: agent.color }} />
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-white text-xs font-bold">{fmtValue(val, metric)}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}