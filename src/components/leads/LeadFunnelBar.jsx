import { Users, Target, PhoneCall, BookMarked, TrendingUp, Clock, AlertCircle } from 'lucide-react'
import { useLang } from '../../context/LanguageContext'

function FunnelStage({ label, count, total, color, icon: Icon }) {
  const pct = Math.round((count / total) * 100)
  const { t } = useLang()
  return (
    <div className="flex-1 relative">
      <div className={`h-16 rounded-xl flex flex-col items-center justify-center border ${color} relative overflow-hidden`}>
        <div className="absolute inset-0 opacity-10" style={{ background: 'currentColor' }} />
        <Icon size={14} className="mb-1 opacity-80" />
        <p className="text-lg font-bold leading-none">{count}</p>
        <p className="text-[10px] opacity-70 mt-0.5">{label}</p>
      </div>
      <p className="text-center text-slate-500 text-[10px] mt-1">{pct}{t('ui.pctOfTotal')}</p>
    </div>
  )
}

export default function LeadFunnelBar({ data }) {
  const { t } = useLang()
  return (
    <div className="bg-card card-border rounded-2xl p-5 glow-blue mb-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-white font-semibold text-sm">{t('ui.leadFunnel')}</p>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-slate-400"><span className="text-amber-400 font-semibold">{data.hotLeads}</span> {t('ui.hotLeadsLabel')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            <span className="text-slate-400"><span className="text-red-400 font-semibold">{data.neglectedLeads}</span> {t('ui.neglectedLabel')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <TrendingUp size={12} className="text-emerald-400" />
            <span className="text-slate-400">{t('ui.convLabel')}: <span className="text-white font-semibold">{data.conversionRate}%</span> <span className="text-red-400 text-[10px]">({t('ui.targetLabel')} {data.targetConversionRate}%)</span></span>
          </div>
        </div>
      </div>

      <div className="flex gap-2 items-start">
        <FunnelStage label={t('leads.stages.freshLead')} count={data.freshLeads}   total={data.totalLeads} color="text-slate-300 border-slate-500/30 bg-slate-500/10"   icon={Users} />
        <div className="flex items-center pt-6 text-slate-600">›</div>
        <FunnelStage label={t('leads.stages.qualified')} count={data.qualified}    total={data.totalLeads} color="text-blue-300 border-blue-500/30 bg-blue-500/10"       icon={Target} />
        <div className="flex items-center pt-6 text-slate-600">›</div>
        <FunnelStage label={t('leads.stages.followUp')}  count={data.followUp}     total={data.totalLeads} color="text-purple-300 border-purple-500/30 bg-purple-500/10" icon={PhoneCall} />
        <div className="flex items-center pt-6 text-slate-600">›</div>
        <FunnelStage label={t('leads.stages.reservation')} count={data.reservation} total={data.totalLeads} color="text-emerald-300 border-emerald-500/30 bg-emerald-500/10" icon={BookMarked} />
      </div>

      <div className="mt-4 pt-4 border-t border-white/5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-slate-500 text-[10px] uppercase tracking-wider">{t('ui.conversionProgress')} ({data.conversionRate}% → {data.targetConversionRate}% {t('ui.targetLabel')})</span>
          <span className="text-slate-400 text-[10px]">{data.closedThisMonth} {t('ui.closedThisMonth')}</span>
        </div>
        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full transition-all"
            style={{ width: `${(data.conversionRate / data.targetConversionRate) * 100}%` }} />
        </div>
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-1 text-amber-400 text-[10px]">
            <AlertCircle size={10} />
            {data.targetConversionRate - data.conversionRate}% {t('ui.gapLabel')} — {Math.round((data.targetConversionRate - data.conversionRate) * data.totalLeads / 100)} {t('ui.additionalClosesNeeded')}
          </div>
          <div className="flex items-center gap-1 text-slate-500 text-[10px]">
            <Clock size={10} />
            {t('ui.avgResponse')}: {data.avgResponseTime}h ({t('ui.targetLabel')}: {data.targetResponseTime}h)
          </div>
        </div>
      </div>
    </div>
  )
}
