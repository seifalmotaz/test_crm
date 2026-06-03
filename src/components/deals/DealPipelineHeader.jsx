import { DollarSign, AlertTriangle, TrendingUp, Clock, Flame } from 'lucide-react'
import { useLang } from '../../context/LanguageContext'

function Stat({ icon: Icon, label, value, sub, color = 'blue' }) {
  const colors = {
    blue: 'bg-blue-500/15 text-blue-400',
    green: 'bg-emerald-500/15 text-emerald-400',
    red: 'bg-red-500/15 text-red-400',
    amber: 'bg-amber-500/15 text-amber-400',
    purple: 'bg-purple-500/15 text-purple-400',
  }
  return (
    <div className="bg-card card-border rounded-2xl p-4 glow-blue flex items-center gap-3">
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

export default function DealPipelineHeader({ data }) {
  const { t } = useLang()
  return (
    <div className="grid grid-cols-5 gap-3 mb-4">
      <Stat icon={DollarSign}    label={t('ui.pipelineValue')}    value={`$${((data.totalValue ?? 0) / 1_000_000).toFixed(1)}M`}        sub={`${data.totalDeals} ${t('ui.activeDealsCount')}`} color="blue" />
      <Stat icon={Flame}         label={t('ui.closingThisWeek')}  value={`$${((data.closingThisWeekValue ?? 0) / 1_000_000).toFixed(1)}M`} sub={`${data.closingThisWeek} ${t('ui.dealsCount')}`} color="green" />
      <Stat icon={AlertTriangle} label={t('ui.atRisk')}           value={data.atRisk}                                                      sub={t('ui.needImmediateAction')} color="red" />
      <Stat icon={TrendingUp}    label={t('ui.commissionPending')} value={`$${((data.commissionPending ?? 0) / 1_000).toFixed(0)}K`}       sub={`$${((data.commissionThisMonth ?? 0) / 1_000).toFixed(0)}K ${t('ui.thisMonth')}`} color="purple" />
      <Stat icon={Clock}         label={t('ui.avgDaysToClose')}   value={`${data.avgDaysToClose}d`}                                        sub={`${data.avgCloseRate}% ${t('ui.closeRate')}`} color="amber" />
    </div>
  )
}
