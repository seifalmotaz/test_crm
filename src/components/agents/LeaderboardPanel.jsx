import { TrendingUp, TrendingDown, Trophy, Minus } from 'lucide-react'
import { tierConfig } from '../../data/agentsData'
import { useLang } from '../../context/LanguageContext'

function fmt(v) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v}`
}

const METRICS = ['revenue', 'deals', 'conversion', 'nps']

function getValue(agent, metric) {
  if (metric === 'revenue')    return agent.revenueYTD
  if (metric === 'deals')      return agent.dealsClosedYTD
  if (metric === 'conversion') return agent.conversionRate
  if (metric === 'nps')        return agent.npsScore
}

function fmtValue(v, metric) {
  if (metric === 'revenue')    return fmt(v)
  if (metric === 'conversion') return `${v}%`
  return String(v)
}

export default function LeaderboardPanel({ agents, metric, onMetricChange, onSelect }) {
  const { t } = useLang()
  const sorted = [...agents].sort((a, b) => getValue(b, metric) - getValue(a, metric)).slice(0, 5)
  if (!sorted.length) return null
  const max = getValue(sorted[0], metric) || 1

  const metricLabels = {
    revenue:    t('ui.revenueYTD'),
    deals:      t('ui.dealsMetric'),
    conversion: t('ui.conversionMetric'),
    nps:        t('ui.npsMetric'),
  }

  return (
    <div className="bg-card card-border rounded-2xl p-5 glow-blue">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trophy size={15} className="text-amber-400" />
          <p className="text-white font-semibold text-sm">{t('ui.leaderboard')}</p>
        </div>
        <div className="flex gap-1">
          {METRICS.map(m => (
            <button
              key={m}
              onClick={() => onMetricChange(m)}
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
          const tier = tierConfig[agent.tier]
          const revChange = agent.revenuePrev > 0 ? ((agent.revenueYTD - agent.revenuePrev) / agent.revenuePrev * 100).toFixed(1) : null

          return (
            <div
              key={agent.id}
              onClick={() => onSelect(agent)}
              className="flex items-center gap-3 cursor-pointer group hover:bg-white/4 rounded-xl p-1.5 -mx-1.5 transition-all"
            >
              <div className={`w-6 text-center text-sm font-black flex-shrink-0 ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-amber-700' : 'text-slate-600'}`}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
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
                  <span className={`text-[8px] px-1 rounded-full ${tier.color}`}>{tier.label}</span>
                </div>
                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: agent.color }} />
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-white text-xs font-bold">{fmtValue(val, metric)}</p>
                {metric === 'revenue' && revChange !== null && (
                  <p className={`text-[9px] font-medium ${parseFloat(revChange) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {parseFloat(revChange) >= 0 ? '+' : ''}{revChange}%
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
