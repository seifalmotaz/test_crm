import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react'
import { Link } from '@tanstack/react-router'

function fmt(value: number, prefix = '$') {
  if (value >= 1_000_000) return `${prefix}${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${prefix}${(value / 1_000).toFixed(0)}K`
  return `${prefix}${value}`
}

interface MetricCardProps {
  label: string
  value: number | string
  prefix?: string
  suffix?: string
  trend?: number
  trendLabel?: string
  icon?: React.ComponentType<{ size?: number }>
  accent?: 'blue' | 'green' | 'purple' | 'amber' | 'rose'
  to?: string
}

export default function MetricCard({ label, value, prefix = '$', suffix = '', trend, trendLabel, icon: Icon, accent = 'blue', to }: MetricCardProps) {
  const isPositive = (trend ?? 0) >= 0
  const accentColors: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    green: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  }

  const inner = (
    <div className={`bg-card card-border rounded-2xl p-5 flex flex-col gap-3 transition-all glow-blue ${to ? 'cursor-pointer hover:bg-card-hover hover:border-[#E53935]/25 group' : 'hover:bg-card-hover'}`}>
      <div className="flex items-start justify-between">
        <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">{label}</p>
        {Icon && (
          <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${accentColors[accent]}`}>
            <Icon size={15} />
          </div>
        )}
      </div>
      <div>
        <p className="text-white text-2xl font-bold tracking-tight">
          {typeof value === 'number' && prefix === '$'
            ? fmt(value)
            : typeof value === 'number'
            ? `${value}${suffix}`
            : value}
        </p>
      </div>
      <div className="flex items-center justify-between">
        {trend !== undefined ? (
          <div className="flex items-center gap-1.5">
            {isPositive ? (
              <TrendingUp size={13} style={{ color: '#6FBFA0' }} />
            ) : (
              <TrendingDown size={13} style={{ color: '#C08090' }} />
            )}
            <span className="text-xs font-medium" style={{ color: isPositive ? '#6FBFA0' : '#C08090' }}>
              {isPositive ? '+' : ''}{trend}%
            </span>
            <span className="text-slate-500 text-xs">{trendLabel ?? 'vs last month'}</span>
          </div>
        ) : <span />}
        {to && (
          <ArrowRight size={13} className="text-slate-600 group-hover:text-[#E53935] transition-colors" />
        )}
      </div>
    </div>
  )

  if (to) return <Link to={to} className="block">{inner}</Link>
  return inner
}
