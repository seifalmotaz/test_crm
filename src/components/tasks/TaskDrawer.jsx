import { useState } from 'react'
import { X, AlertTriangle, Clock, CheckCircle2, Circle, Mail, Timer, Camera, Tag, User, Calendar, Zap, ChevronRight } from 'lucide-react'
import { useLang } from '../../context/LanguageContext'
import api from '../../lib/api'
import { mapTask } from '../../lib/mappers'

const categoryColors = {
  Deal:     'text-blue-400 bg-blue-500/10 border-blue-500/20',
  Lead:     'text-amber-400 bg-amber-500/10 border-amber-500/20',
  Property: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  Client:   'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  Admin:    'text-slate-400 bg-slate-500/10 border-slate-500/20',
}

function Section({ title, children }) {
  return (
    <div>
      <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-widest mb-2">{title}</p>
      {children}
    </div>
  )
}

export default function TaskDrawer({ task, onClose, onComplete }) {
  const { t } = useLang()
  const [completing, setCompleting]   = useState(false)
  const [proofText,  setProofText]    = useState('')
  const [submitting, setSubmitting]   = useState(false)
  const [completeErr, setCompleteErr] = useState('')

  async function handleComplete() {
    setSubmitting(true)
    setCompleteErr('')
    try {
      const res = await api.patch(`/api/tasks/${task.id}/complete`, { proof: proofText || undefined })
      onComplete?.(mapTask(res.data))
      setCompleting(false)
      setProofText('')
    } catch {
      setCompleteErr('Failed to mark complete. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const priorityConfig = {
    critical: { label: t('ui.priorityCritical'), color: 'text-red-400',   bg: 'bg-red-500/15',   border: 'border-red-500/25' },
    high:     { label: t('ui.priorityHigh'),     color: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/25' },
    medium:   { label: t('ui.priorityMedium'),   color: 'text-blue-400',  bg: 'bg-blue-500/15',  border: 'border-blue-500/25' },
    low:      { label: t('ui.priorityLow'),      color: 'text-slate-400', bg: 'bg-slate-500/15', border: 'border-slate-500/25' },
  }

  const statusConfig = {
    overdue:     { label: t('ui.statusOverdue'),     icon: AlertTriangle, color: 'text-red-400',     bg: 'bg-red-500/10' },
    in_progress: { label: t('ui.statusInProgress'),  icon: Clock,          color: 'text-amber-400',   bg: 'bg-amber-500/10' },
    not_started: { label: t('ui.statusNotStarted'),  icon: Circle,         color: 'text-slate-400',   bg: 'bg-white/5' },
    completed:   { label: t('ui.statusCompleted'),   icon: CheckCircle2,   color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  }

  const proofConfig = {
    email:     { icon: Mail,   label: t('tasks.drawer.proofEmail'),     color: 'text-blue-400',   bg: 'bg-blue-500/10' },
    timestamp: { icon: Timer,  label: t('tasks.drawer.proofTimestamp'), color: 'text-amber-400',  bg: 'bg-amber-500/10' },
    photo:     { icon: Camera, label: t('tasks.drawer.proofPhoto'),     color: 'text-purple-400', bg: 'bg-purple-500/10' },
  }

  if (!task) return null

  const pCfg = priorityConfig[task.priority]
  const sCfg = statusConfig[task.status]
  const StatusIcon = sCfg.icon
  const proof = proofConfig[task.completionProof] || { icon: Timer, label: '—', color: 'text-slate-400', bg: 'bg-white/5' }
  const ProofIcon = proof.icon
  const doneCount = task.subtasks.filter(s => s.done).length
  const totalSubs = task.subtasks.length
  const progress = totalSubs > 0 ? Math.round((doneCount / totalSubs) * 100) : 0

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[500px] bg-navy-800 border-l border-blue-500/15 z-50 overflow-y-auto shadow-2xl">

        <div className="sticky top-0 bg-navy-800/95 backdrop-blur-sm border-b border-white/5 px-6 py-4 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${categoryColors[task.category]}`}>
                {task.category.toUpperCase()}
              </span>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${pCfg.bg} ${pCfg.color} ${pCfg.border}`}>
                {pCfg.label.toUpperCase()}
              </span>
              {task.escalated && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-red-500/20 text-red-300 border border-red-500/30">
                  {t('tasks.drawer.escalatedBadge')}
                </span>
              )}
            </div>
            <h2 className="text-white font-bold text-sm leading-snug">{task.title}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors flex-shrink-0 mt-0.5">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">

          <div className="grid grid-cols-3 gap-2">
            <div className={`flex flex-col items-center gap-1 p-3 rounded-xl ${sCfg.bg}`}>
              <StatusIcon size={14} className={sCfg.color} />
              <span className={`text-[10px] font-semibold ${sCfg.color}`}>{sCfg.label}</span>
            </div>
            <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-white/5">
              <Calendar size={14} className="text-slate-400" />
              <span className="text-[10px] text-slate-300 font-medium">{task.dueDate}</span>
              <span className="text-[9px] text-slate-500">{t('tasks.drawer.dueDate')}</span>
            </div>
            <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-white/5">
              <Calendar size={14} className="text-slate-400" />
              <span className="text-[10px] text-slate-300 font-medium">{task.createdDate}</span>
              <span className="text-[9px] text-slate-500">{t('tasks.drawer.created')}</span>
            </div>
          </div>

          {task.status === 'overdue' && task.daysOverdue > 0 && (
            <div className="bg-red-500/10 border border-red-500/25 rounded-xl p-3 flex items-center gap-2">
              <AlertTriangle size={14} className="text-red-400 flex-shrink-0" />
              <p className="text-red-300 text-xs font-semibold">
                {task.daysOverdue} {task.daysOverdue !== 1 ? t('tasks.drawer.daysOverdue') : t('tasks.drawer.dayOverdue')}
              </p>
            </div>
          )}

          <Section title={t('tasks.drawer.businessImpact')}>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-start gap-2">
              <Zap size={13} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-amber-200 text-xs leading-relaxed">{task.impact}</p>
            </div>
          </Section>

          <Section title={t('tasks.drawer.description')}>
            <p className="text-slate-300 text-xs leading-relaxed bg-white/3 border border-white/5 rounded-xl p-3">
              {task.description}
            </p>
          </Section>

          <Section title={`${t('tasks.drawer.subtasks')} — ${doneCount}/${totalSubs} ${t('tasks.drawer.complete')}`}>
            <div className="mb-2">
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${task.status === 'completed' ? 'bg-emerald-500' : 'bg-blue-500'}`}
                  style={{ width: `${task.status === 'completed' ? 100 : progress}%` }}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              {task.subtasks.map((s, i) => (
                <div key={i} className="flex items-center gap-2.5 p-2.5 bg-white/3 border border-white/5 rounded-xl">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    s.done ? 'border-emerald-500 bg-emerald-500' : 'border-slate-600'
                  }`}>
                    {s.done && <CheckCircle2 size={10} className="text-white" />}
                  </div>
                  <span className={`text-xs ${s.done ? 'text-slate-500 line-through' : 'text-slate-300'}`}>
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </Section>

          <Section title={t('tasks.drawer.proofRequired')}>
            <div className={`${proof.bg} border border-white/5 rounded-xl p-3 flex items-start gap-2.5`}>
              <ProofIcon size={14} className={`${proof.color} flex-shrink-0 mt-0.5`} />
              <div>
                <p className={`text-xs font-semibold ${proof.color}`}>{proof.label}</p>
                <p className="text-slate-400 text-[10px] mt-0.5">{task.proofLabel}</p>
              </div>
            </div>
          </Section>

          <Section title={t('tasks.drawer.assignment')}>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white/3 border border-white/5 rounded-xl p-3 flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ backgroundColor: `${task.assigneeColor}25`, color: task.assigneeColor }}
                >
                  {task.assigneeAvatar}
                </div>
                <div>
                  <p className="text-white text-xs font-semibold">{task.assignee}</p>
                  <p className="text-slate-500 text-[9px]">{t('tasks.drawer.assignee')}</p>
                </div>
              </div>
              {(task.deal || task.client) && (
                <div className="bg-white/3 border border-white/5 rounded-xl p-3 flex items-center gap-2.5">
                  <User size={14} className="text-slate-400 flex-shrink-0" />
                  <div>
                    <p className="text-white text-xs font-semibold truncate">{task.deal || task.client}</p>
                    <p className="text-slate-500 text-[9px]">{task.deal ? t('tasks.drawer.deal') : t('tasks.drawer.client')}</p>
                  </div>
                </div>
              )}
            </div>
          </Section>

          {task.escalated && (
            <Section title={t('tasks.drawer.escalation')}>
              <div className="bg-red-500/10 border border-red-500/25 rounded-xl p-3 flex items-center gap-2.5">
                <AlertTriangle size={14} className="text-red-400 flex-shrink-0" />
                <div>
                  <p className="text-red-300 text-xs font-semibold">{t('tasks.drawer.escalatedTo')} {task.escalateTo}</p>
                  <p className="text-slate-400 text-[10px] mt-0.5">{t('tasks.drawer.escalatedMsg')}</p>
                </div>
              </div>
            </Section>
          )}

          {task.tags?.length > 0 && (
            <Section title={t('tasks.drawer.tags')}>
              <div className="flex flex-wrap gap-1.5">
                {task.tags.map(tag => (
                  <span key={tag} className="flex items-center gap-1 text-[9px] text-slate-400 bg-white/5 border border-white/8 px-2 py-0.5 rounded-lg">
                    <Tag size={8} />
                    {tag}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {task.workflowTemplate && (
            <Section title={t('tasks.drawer.workflowTemplate')}>
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <Zap size={11} className="text-purple-400" />
                  </div>
                  <span className="text-purple-300 text-xs font-medium">{task.workflowTemplate.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                </div>
                <ChevronRight size={12} className="text-purple-400" />
              </div>
            </Section>
          )}

          {task.status !== 'completed' && (
            <div className="pt-2 border-t border-white/5">
              {!completing ? (
                <button
                  onClick={() => setCompleting(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-semibold hover:bg-emerald-500/25 transition-all"
                >
                  <CheckCircle2 size={14} />
                  Mark as Complete
                </button>
              ) : (
                <div className="space-y-2.5">
                  <p className="text-slate-400 text-[10px] font-semibold uppercase tracking-widest">Completion Notes (optional)</p>
                  <textarea
                    value={proofText}
                    onChange={e => setProofText(e.target.value)}
                    placeholder="Add any notes or proof of completion..."
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/40 resize-none transition-all"
                  />
                  {completeErr && (
                    <p className="text-red-400 text-[10px]">{completeErr}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setCompleting(false); setProofText(''); setCompleteErr('') }}
                      className="flex-1 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-slate-300 hover:bg-white/8 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleComplete}
                      disabled={submitting}
                      className="flex-1 py-2 bg-emerald-500 rounded-xl text-xs font-semibold text-white hover:bg-emerald-600 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <CheckCircle2 size={12} />
                      {submitting ? 'Saving...' : 'Confirm Complete'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </>
  )
}
