import { Users, TrendingUp, Star, AlertTriangle, Award } from 'lucide-react'
import { useLang } from '../../context/LanguageContext'

function fmt(v) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v}`
}

function Tile({ icon: Icon, label, value, sub, color = 'blue' }) {
  const colors = {
    blue: 'bg-blue-500/15 text-blue-400',
    amber: 'bg-amber-500/15 text-amber-400',
    green: 'bg-emerald-500/15 text-emerald-400',
    red: 'bg-red-500/15 text-red-400',
    purple: 'bg-purple-500/15 text-purple-400',
  }
  return (
    <div className="bg-card card-border rounded-2xl p-4 flex items-center gap-3 glow-blue">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colors[color]}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-slate-400 text-[10px] uppercase tracking-wider">{label}</p>
        <p className="text-white text-lg font-bold">{value}</p>
        {sub && <p className="text-slate-500 text-[10px]">{sub}</p>}
      </div>
    </div>
  )
}

export default function TeamSummaryBar({ data }) {
  const { t } = useLang()
  return (
    <div className="grid grid-cols-5 gap-3 mb-4">
      <Tile icon={Users}         label={t('ui.totalAgents')}       value={data.totalAgents}               sub={`${data.eliteCount} ${t('ui.elite')} · ${data.coreCount} ${t('ui.core')} · ${data.developingCount} ${t('ui.developing')}`} color="blue" />
      <Tile icon={TrendingUp}    label={t('ui.teamRevenueYTD')}    value={fmt(data.totalRevenueYTD)}      sub={t('ui.allAgentsCombined')} color="green" />
      <Tile icon={Award}         label={t('ui.topPerformerShare')} value={`${data.topPerformerShare}%`}   sub={t('ui.revenueFromTop3')} color="amber" />
      <Tile icon={Star}          label={t('ui.avgConversionRate')} value={`${data.avgConversionRate}%`}  sub={t('ui.teamAverage')} color="purple" />
      <Tile icon={AlertTriangle} label={t('ui.avgNPS')}            value={data.avgNPS}                    sub={t('ui.clientSatisfaction')} color="blue" />
    </div>
  )
}
