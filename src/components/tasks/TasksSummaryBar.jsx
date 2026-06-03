import { CheckSquare, Clock, AlertCircle, TrendingUp, Zap } from 'lucide-react'
import { useLang } from '../../context/LanguageContext'

export default function TasksSummaryBar({ data }) {
  const { t } = useLang()
  const gap = data.targetCompletionRate - data.completionRate

  const kpis = [
    {
      icon: CheckSquare,
      label: t('ui.tasksTotalTasksLabel'),
      value: (data.totalTasks ?? 0).toLocaleString(),
      sub: `${data.completed} ${t('ui.tasksCompletedSub')}`,
      color: 'text-blue-400',
      bg: 'bg-blue-500/15',
    },
    {
      icon: AlertCircle,
      label: t('ui.tasksOverdueLabel'),
      value: data.overdue,
      sub: `${data.critical} ${t('ui.tasksCriticalSub')}`,
      color: 'text-red-400',
      bg: 'bg-red-500/15',
    },
    {
      icon: Clock,
      label: t('ui.tasksInProgressLabel'),
      value: data.inProgress,
      sub: `${data.notStarted} ${t('ui.tasksNotStartedSub')}`,
      color: 'text-amber-400',
      bg: 'bg-amber-500/15',
    },
    {
      icon: TrendingUp,
      label: t('ui.tasksCompletionRateLabel'),
      value: `${data.completionRate}%`,
      sub: `${t('ui.tasksTargetPct')} ${data.targetCompletionRate}%`,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/15',
    },
    {
      icon: Zap,
      label: t('ui.tasksAvgPerAgentLabel'),
      value: data.avgTasksPerAgent,
      sub: `${(gap ?? 0).toFixed(1)}${t('ui.tasksPpToTarget')}`,
      color: 'text-purple-400',
      bg: 'bg-purple-500/15',
    },
  ]

  return (
    <div className="grid grid-cols-5 gap-3 mb-4">
      {kpis.map(({ icon: Icon, label, value, sub, color, bg }) => (
        <div key={label} className="bg-card card-border rounded-2xl p-4 flex items-center gap-3 glow-blue">
          <div className={`w-10 h-10 rounded-xl ${bg} ${color} flex items-center justify-center flex-shrink-0`}>
            <Icon size={18} />
          </div>
          <div>
            <p className="text-slate-400 text-[10px] uppercase tracking-wider">{label}</p>
            <p className="text-white text-lg font-bold leading-none mt-0.5">{value}</p>
            <p className="text-slate-500 text-[10px] mt-0.5">{sub}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
