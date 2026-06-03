import { Users, TrendingUp, Star, Award, GitBranch } from 'lucide-react'
import { useLang } from '../../context/LanguageContext'

function fmt(v) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v}`
}

function Tile({ icon: Icon, label, value, sub, color = 'blue' }) {
  const colors = {
    blue:   'bg-blue-500/15 text-blue-400',
    amber:  'bg-amber-500/15 text-amber-400',
    green:  'bg-emerald-500/15 text-emerald-400',
    purple: 'bg-purple-500/15 text-purple-400',
    rose:   'bg-rose-500/15 text-rose-400',
  }
  return (
    <div className="bg-card card-border rounded-2xl p-4 flex items-center gap-3 glow-blue">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colors[color]}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-slate-400 text-[10px] uppercase tracking-wider">{label}</p>
        <p className="text-white text-lg font-bold">{value}</p>
        {sub && <p className="text-slate-500 text-[10px] truncate">{sub}</p>}
      </div>
    </div>
  )
}

export default function ClientsSummaryBar({ data }) {
  const { t } = useLang()
  return (
    <div className="grid grid-cols-5 gap-3 mb-4">
      <Tile icon={Users}     label={t('ui.totalClientsLabel')}    value={(data.totalClients ?? 0).toLocaleString()} sub={`${(data.activeClients ?? 0).toLocaleString()} ${t('ui.activeLabel')} · ${data.dormantClients ?? 0} ${t('ui.dormantCountLabel')}`} color="blue" />
      <Tile icon={Award}     label={t('ui.vipClientsLabel')}      value={data.vipClients} sub={`+ ${data.highValueClients} ${t('ui.highValueLabel')}`} color="amber" />
      <Tile icon={TrendingUp} label={t('ui.repeatRateLabel')}     value={`${data.repeatRate}%`} sub={`Target: ${data.targetRepeatRate}% (+${data.targetRepeatRate - data.repeatRate}pp gap)`} color="rose" />
      <Tile icon={GitBranch} label={t('ui.referralRevenueLabel')} value={fmt(data.totalReferralValue)} sub={`${t('common.from') || 'From'} ${data.topReferrers} ${t('ui.topReferrersLabel')}`} color="green" />
      <Tile icon={Star}      label={t('ui.avgClientLTVLabel')}    value={fmt(data.avgCLV)} sub={t('ui.lifetimePerClient')} color="purple" />
    </div>
  )
}
