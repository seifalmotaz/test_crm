import { TrendingUp, TrendingDown, Star, AlertTriangle, Clock, Minus } from 'lucide-react'
import { tierConfig } from '../../data/agentsData'
import { useLang } from '../../context/LanguageContext'

function fmt(v) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v}`
}

function MiniSparkline({ data, color }) {
  if (!data.length) return <svg width={60} height={24} />
  const max = Math.max(...data), min = Math.min(...data)
  const range = max - min || 1
  const w = 60, h = 24
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function RetentionBadge({ risk }) {
  if (risk === 'high')   return <div className="w-2 h-2 rounded-full bg-red-400" />
  if (risk === 'medium') return <div className="w-2 h-2 rounded-full bg-amber-400" />
  return null
}

const velocityIcon  = { increasing: TrendingUp, stable: Minus, decreasing: TrendingDown }
const velocityColor = { increasing: 'text-emerald-400', stable: 'text-slate-400', decreasing: 'text-red-400' }

export default function AgentCard({ agent, onClick }) {
  const { t } = useLang()
  const tier = tierConfig[agent.tier]
  const revChange  = agent.revenuePrev > 0 ? ((agent.revenueYTD - agent.revenuePrev) / agent.revenuePrev * 100).toFixed(1) : null
  const convChange = agent.conversionRate - agent.prevConversionRate
  const VelocityIcon = velocityIcon[agent.dealVelocity]

  const stats = [
    { label: t('ui.dealsLabel'),   value: agent.dealsClosedYTD },
    { label: t('ui.convPct'),      value: `${agent.conversionRate}%`, up: convChange > 0, down: convChange < 0 },
    { label: t('ui.avgClose'),     value: `${agent.avgDaysToClose}d` },
    { label: t('ui.npsLabel'),     value: agent.npsScore },
  ]

  return (
    <div
      onClick={() => onClick(agent)}
      className="bg-card card-border rounded-2xl p-4 cursor-pointer hover:border-blue-500/30 hover:shadow-lg hover:shadow-blue-500/5 transition-all"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="relative flex-shrink-0">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold"
            style={{ backgroundColor: `${agent.color}20`, border: `1px solid ${agent.color}40`, color: agent.color }}
          >
            {agent.avatar}
          </div>
          {agent.rank <= 3 && (
            <div className="absolute -top-1.5 -end-1.5 w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center text-[9px] text-black font-black">
              #{agent.rank}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-white text-sm font-semibold truncate">{agent.name}</p>
            <RetentionBadge risk={agent.retentionRisk} />
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full border ${tier.color}`}>{tier.label}</span>
            <span className="text-slate-500 text-[10px]">{agent.specialization} · {agent.region}</span>
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <MiniSparkline data={(agent.monthlyRevenue ?? []).slice(-6)} color={agent.dealVelocity === 'decreasing' ? '#ef4444' : agent.color} />
        </div>
      </div>

      <div className="flex items-end justify-between mb-3">
        <div>
          <p className="text-slate-500 text-[10px] uppercase tracking-wider">{t('ui.revenueYTDLabel')}</p>
          <p className="text-white text-lg font-bold">{fmt(agent.revenueYTD)}</p>
        </div>
        {revChange !== null && (
          <div className={`flex items-center gap-1 text-xs font-medium ${parseFloat(revChange) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {parseFloat(revChange) >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {parseFloat(revChange) >= 0 ? '+' : ''}{revChange}%
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-1.5 mb-3">
        {stats.map(({ label, value, up, down }) => (
          <div key={label} className="bg-white/4 border border-white/6 rounded-lg p-1.5 text-center">
            <p className="text-slate-500 text-[9px] uppercase tracking-wide">{label}</p>
            <p className={`text-xs font-bold ${up ? 'text-emerald-400' : down ? 'text-red-400' : 'text-white'}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-[10px] pt-2 border-t border-white/5">
        <div className="flex items-center gap-1">
          <VelocityIcon size={11} className={velocityColor[agent.dealVelocity]} />
          <span className={`font-medium ${velocityColor[agent.dealVelocity]}`}>{agent.dealVelocity}</span>
          <span className="text-slate-600 ms-1">{t('ui.velocity')}</span>
        </div>
        <div className="flex items-center gap-2 text-slate-500">
          <span>{agent.tenure} {t('ui.yrTenure')}</span>
          <span>·</span>
          <span>{agent.activeDeals} {t('ui.activeDeals')}</span>
        </div>
      </div>
    </div>
  )
}
