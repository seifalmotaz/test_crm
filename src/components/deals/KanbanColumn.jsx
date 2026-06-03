import { AlertTriangle } from 'lucide-react'
import { useLang } from '../../context/LanguageContext'

function fmt(v) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v}`
}

const riskColors = {
  low:    'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
  medium: 'text-amber-400 bg-amber-500/10 border-amber-500/25',
  high:   'text-red-400 bg-red-500/10 border-red-500/25',
}

function ProbabilityRing({ value }) {
  const color = value >= 85 ? '#10b981' : value >= 70 ? '#3b82f6' : value >= 55 ? '#f59e0b' : '#ef4444'
  const r = 14, circ = 2 * Math.PI * r
  return (
    <div className="relative w-9 h-9 flex-shrink-0">
      <svg width="36" height="36" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
        <circle cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={`${(value / 100) * circ} ${circ}`} strokeLinecap="round" transform="rotate(-90 18 18)" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold" style={{ color }}>{value}%</span>
    </div>
  )
}

export default function KanbanCard({ deal, onClick }) {
  const { t } = useLang()
  const commission = (deal.value * deal.commissionRate) / 100
  const isOverdue  = deal.milestones.some(m => m.status === 'overdue')
  const riskLabel  = t(`ui.risk${deal.risk.charAt(0).toUpperCase() + deal.risk.slice(1)}`)

  return (
    <div
      onClick={() => onClick(deal)}
      className={`bg-card rounded-xl border cursor-pointer transition-all hover:shadow-lg hover:shadow-blue-500/5 group p-3 ${
        deal.risk === 'high' ? 'border-red-500/30 hover:border-red-500/50' : 'card-border hover:border-blue-500/30'
      }`}
    >
      <div className="flex items-start gap-2 mb-2">
        <span className="text-lg flex-shrink-0">{deal.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-white text-xs font-semibold leading-tight truncate">{deal.property}</p>
          <p className="text-slate-500 text-[10px] truncate">{deal.buyer}</p>
        </div>
        <ProbabilityRing value={deal.closingProbability} />
      </div>

      <div className="flex items-center justify-between mb-2">
        <p className="text-white font-bold text-sm">{fmt(deal.value)}</p>
        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full border ${riskColors[deal.risk]}`}>
          {riskLabel}
        </span>
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-500 mb-2">
        <span>{t('ui.agentLabel')}: <span className="text-slate-300">{deal.agent.split(' ')[0]}</span></span>
        <span className={deal.daysUntilClose <= 7 ? 'text-amber-400 font-medium' : ''}>
          {deal.daysUntilClose} {t('ui.dLeft')}
        </span>
      </div>

      <div className="flex items-center gap-1 mb-2">
        {Object.values(deal.progress).map((v, i) => (
          <div key={i} className={`flex-1 h-1 rounded-full ${v ? 'bg-blue-500' : 'bg-white/8'}`} />
        ))}
      </div>

      <div className="flex items-center justify-between text-[10px]">
        <span className="text-emerald-400 font-medium">{t('ui.commLabel')}: {fmt(commission)}</span>
        {(deal.risk === 'high' || isOverdue) && (
          <div className="flex items-center gap-0.5 text-red-400">
            <AlertTriangle size={10} />
            <span className="font-medium">{t('ui.actionNeeded')}</span>
          </div>
        )}
      </div>
    </div>
  )
}
