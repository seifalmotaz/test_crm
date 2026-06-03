import { AlertTriangle, Clock, CheckCircle2, Circle, Mail, Timer, Camera, ChevronRight } from 'lucide-react'
import { useLang } from '../../context/LanguageContext'

const categoryColors = {
  Deal:     'text-blue-400 bg-blue-500/10',
  Lead:     'text-amber-400 bg-amber-500/10',
  Property: 'text-purple-400 bg-purple-500/10',
  Client:   'text-emerald-400 bg-emerald-500/10',
  Admin:    'text-slate-400 bg-slate-500/10',
}

const proofIcons = { email: Mail, timestamp: Timer, photo: Camera }

export default function TaskCard({ task, onClick }) {
  const { t } = useLang()

  const priorityConfig = {
    critical: { color: 'text-red-400',    bg: 'bg-red-500/15',    border: 'border-red-500/25',    label: t('ui.priorityCritical') },
    high:     { color: 'text-amber-400',  bg: 'bg-amber-500/15',  border: 'border-amber-500/25',  label: t('ui.priorityHigh') },
    medium:   { color: 'text-blue-400',   bg: 'bg-blue-500/15',   border: 'border-blue-500/25',   label: t('ui.priorityMedium') },
    low:      { color: 'text-slate-400',  bg: 'bg-slate-500/15',  border: 'border-slate-500/25',  label: t('ui.priorityLow') },
  }

  const statusConfig = {
    overdue:     { label: t('ui.statusOverdue'),    icon: AlertTriangle, color: 'text-red-400',    bg: 'bg-red-500/10' },
    in_progress: { label: t('ui.statusInProgress'), icon: Clock,         color: 'text-amber-400',  bg: 'bg-amber-500/10' },
    not_started: { label: t('ui.statusNotStarted'), icon: Circle,        color: 'text-slate-400',  bg: 'bg-white/5' },
    completed:   { label: t('ui.statusCompleted'),  icon: CheckCircle2,  color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  }

  const pCfg = priorityConfig[task.priority] ?? priorityConfig.low
  const sCfg = statusConfig[task.status] ?? statusConfig.not_started
  const StatusIcon = sCfg.icon
  const ProofIcon = proofIcons[task.completionProof] || Mail
  const doneCount = task.subtasks.filter(s => s.done).length
  const totalSubs = task.subtasks.length
  const progress = totalSubs > 0 ? Math.round((doneCount / totalSubs) * 100) : 0

  return (
    <div
      onClick={() => onClick(task)}
      className={`bg-card card-border rounded-2xl p-4 cursor-pointer hover:bg-white/5 transition-all glow-blue group ${
        task.status === 'overdue' ? 'border-red-500/20' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-md ${categoryColors[task.category]}`}>
            {task.category.toUpperCase()}
          </span>
          <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-md border ${pCfg.bg} ${pCfg.color} ${pCfg.border}`}>
            {pCfg.label.toUpperCase()}
          </span>
          {task.escalated && (
            <span className="text-[9px] font-semibold px-2 py-0.5 rounded-md bg-red-500/20 text-red-300 border border-red-500/30">
              {t('ui.taskEscalated')}
            </span>
          )}
        </div>
        <ChevronRight size={12} className="text-slate-600 group-hover:text-slate-400 transition-colors flex-shrink-0 mt-0.5" />
      </div>

      <p className="text-white text-xs font-semibold leading-snug mb-1 line-clamp-2">{task.title}</p>

      {(task.deal || task.client) && (
        <p className="text-slate-400 text-[10px] mb-2 truncate">
          {task.deal ? `${t('ui.taskDealPrefix')} ${task.deal}` : `${t('ui.taskClientPrefix')} ${task.client}`}
        </p>
      )}

      <div className="flex items-center gap-2 mb-3">
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg ${sCfg.bg}`}>
          <StatusIcon size={10} className={sCfg.color} />
          <span className={`text-[9px] font-medium ${sCfg.color}`}>{sCfg.label}</span>
        </div>
        {task.status === 'overdue' && task.daysOverdue > 0 ? (
          <span className="text-[9px] text-red-400">+{task.daysOverdue}{t('ui.taskDaysOverdue')}</span>
        ) : (
          <span className="text-[9px] text-slate-500">{t('ui.taskDue')} {task.dueDate}</span>
        )}
      </div>

      {totalSubs > 0 && task.status !== 'completed' && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-slate-500">{t('ui.taskSubtasks')}</span>
            <span className="text-[9px] text-slate-400">{doneCount}/{totalSubs}</span>
          </div>
          <div className="h-1 bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${task.status === 'overdue' ? 'bg-red-500' : 'bg-blue-500'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold flex-shrink-0"
            style={{ backgroundColor: `${task.assigneeColor}25`, color: task.assigneeColor }}
          >
            {task.assigneeAvatar}
          </div>
          <span className="text-[9px] text-slate-400 truncate">{task.assignee.split(' ')[0]}</span>
        </div>
        <div className="flex items-center gap-1 text-slate-600">
          <ProofIcon size={10} />
          <span className="text-[9px]">{t('ui.taskProofReq')}</span>
        </div>
      </div>
    </div>
  )
}
