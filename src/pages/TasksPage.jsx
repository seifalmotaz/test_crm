import { useState, useMemo, useEffect } from 'react'
import { Search, AlertTriangle, BarChart3 } from 'lucide-react'
import { useLang } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'
import TasksSummaryBar from '../components/tasks/TasksSummaryBar'
import TaskCard from '../components/tasks/TaskCard'
import TaskDrawer from '../components/tasks/TaskDrawer'
import WorkflowPanel from '../components/tasks/WorkflowPanel'
import NewTaskModal from '../components/tasks/NewTaskModal'
import { workflowTemplates, categories, priorities, statuses } from '../data/tasksData'
import api from '../lib/api'
import { mapTask } from '../lib/mappers'

const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }

const categoryColors = {
  Deal:     { bar: 'bg-blue-500',    text: 'text-blue-400' },
  Lead:     { bar: 'bg-amber-500',   text: 'text-amber-400' },
  Property: { bar: 'bg-purple-500',  text: 'text-purple-400' },
  Client:   { bar: 'bg-emerald-500', text: 'text-emerald-400' },
  Admin:    { bar: 'bg-slate-500',   text: 'text-slate-400' },
}

function sortTasks(list) {
  return [...list].sort((a, b) => {
    if (a.status === 'overdue' && b.status !== 'overdue') return -1
    if (b.status === 'overdue' && a.status !== 'overdue') return 1
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    }
    return (a.dueDate || '').localeCompare(b.dueDate || '')
  })
}

export default function TasksPage() {
  const { t } = useLang()
  const { user } = useAuth()
  const [tasks,       setTasks]       = useState([])
  const [loading,     setLoading]     = useState(true)
  const [selected,    setSelected]    = useState(null)
  const [showNewTask, setShowNewTask] = useState(false)
  const [category,    setCategory]    = useState('All')
  const [priority,    setPriority]    = useState('all')
  const [status,      setStatus]      = useState('all')
  const [query,       setQuery]       = useState('')

  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    setLoading(true)
    api.get('/api/tasks?per_page=100')
      .then(res => setTasks((res.data || []).map(mapTask)))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  function handleTaskCreated(raw) {
    setTasks(prev => [mapTask(raw), ...prev])
  }

  function handleTaskComplete(updated) {
    setTasks(prev => prev.map(t => t.id === updated.id ? updated : t))
    setSelected(updated)
  }

  const filtered = useMemo(() => {
    let list = tasks.filter(t => {
      if (category !== 'All' && t.category !== category) return false
      if (priority !== 'all' && t.priority !== priority) return false
      if (status !== 'all' && t.status !== status) return false
      if (query && !`${t.title} ${t.assignee} ${t.dealId ?? ''} ${t.clientId ?? ''} ${(t.tags || []).join(' ')}`.toLowerCase().includes(query.toLowerCase())) return false
      return true
    })
    return sortTasks(list)
  }, [tasks, category, priority, status, query])

  const overdueTasks   = tasks.filter(t => t.status === 'overdue')
  const escalatedTasks = tasks.filter(t => t.escalated)

  const tasksSummary = {
    totalTasks:          tasks.length,
    notStarted:          tasks.filter(t => t.status === 'not_started').length,
    inProgress:          tasks.filter(t => t.status === 'in_progress').length,
    completed:           tasks.filter(t => t.status === 'completed').length,
    overdue:             overdueTasks.length,
    critical:            tasks.filter(t => t.priority === 'critical').length,
    high:                tasks.filter(t => t.priority === 'high').length,
    medium:              tasks.filter(t => t.priority === 'medium').length,
    low:                 tasks.filter(t => t.priority === 'low').length,
    completionRate:      tasks.length ? +((tasks.filter(t => t.status === 'completed').length / tasks.length) * 100).toFixed(1) : 0,
    targetCompletionRate: 98,
    avgTasksPerAgent:    0,
  }

  const breakdownCategories = ['Deal', 'Lead', 'Property', 'Client', 'Admin'].map(cat => ({
    cat,
    count:  tasks.filter(t => t.category === cat).length,
    overdue: tasks.filter(t => t.category === cat && t.status === 'overdue').length,
  }))

  const byAssignee = {}
  tasks.forEach(t => {
    const key = t.assignee || 'Unassigned'
    if (!byAssignee[key]) byAssignee[key] = { count: 0, overdue: 0, color: t.assigneeColor, avatar: t.assigneeAvatar }
    byAssignee[key].count++
    if (t.status === 'overdue') byAssignee[key].overdue++
  })

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-white text-xl font-bold tracking-tight">{t('tasks.title')}</h1>
          <p className="text-slate-400 text-sm mt-0.5">{t('tasks.subtitle')}</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowNewTask(true)}
            className="px-4 py-2 bg-blue-500 rounded-xl text-xs font-medium text-white hover:bg-blue-600 transition-all"
          >
            {t('tasks.newTask')}
          </button>
        )}
      </div>

      <TasksSummaryBar data={tasksSummary} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        {overdueTasks.length > 0 && (
          <div className="bg-red-500/10 border border-red-500/25 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-300 text-xs font-semibold mb-1">{overdueTasks.length} {t('tasks.overdueAlert')}</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {overdueTasks.slice(0, 3).map(t => (
                  <button key={t.id} onClick={() => setSelected(t)}
                    className="text-[10px] text-red-300 bg-red-500/15 border border-red-500/25 px-2 py-0.5 rounded-lg hover:bg-red-500/25 transition-all">
                    {t.title.length > 32 ? t.title.slice(0, 32) + '…' : t.title}
                    {t.daysOverdue > 0 && ` (+${t.daysOverdue}d)`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {escalatedTasks.length > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-300 text-xs font-semibold mb-1">{escalatedTasks.length} {t('tasks.escalatedAlert')}</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {escalatedTasks.map(t => (
                  <button key={t.id} onClick={() => setSelected(t)}
                    className="text-[10px] text-amber-300 bg-amber-500/15 border border-amber-500/25 px-2 py-0.5 rounded-lg hover:bg-amber-500/25 transition-all">
                    {t.title.length > 28 ? t.title.slice(0, 28) + '…' : t.title} → {t.escalateTo}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 min-w-0">
          <div className="bg-card card-border rounded-2xl p-4 mb-4 glow-blue">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={query} onChange={e => setQuery(e.target.value)}
                  placeholder={t('tasks.searchFullPlaceholder')}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-all" />
              </div>
              <select value={priority} onChange={e => setPriority(e.target.value)}
                className="appearance-none bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none cursor-pointer capitalize">
                {priorities.map(p => (
                  <option key={p} value={p} className="bg-navy-800 capitalize">
                    {p === 'all' ? t('tasks.allPriority') : p.charAt(0).toUpperCase() + p.slice(1)}
                  </option>
                ))}
              </select>
              <select value={status} onChange={e => setStatus(e.target.value)}
                className="appearance-none bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none cursor-pointer">
                {statuses.map(s => (
                  <option key={s} value={s} className="bg-navy-800">
                    {s === 'all' ? t('tasks.allStatus') : s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {categories.map(cat => (
                <button key={cat} onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    category === cat ? 'bg-blue-500 text-white' : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/8'
                  }`}>
                  {cat}
                  <span className="ml-1 text-[9px] opacity-70">
                    {cat === 'All' ? tasks.length : tasks.filter(t => t.category === cat).length}
                  </span>
                </button>
              ))}
              <span className="ml-auto text-slate-500 text-xs flex items-center">
                <span className="text-white font-semibold">{filtered.length}</span>&nbsp;{t('tasks.tasksUnit')}
              </span>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-card card-border rounded-2xl">
              <span className="text-4xl mb-3">✅</span>
              <p className="text-white font-semibold">{t('tasks.noMatch')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filtered.map(t => <TaskCard key={t.id} task={t} onClick={setSelected} />)}
            </div>
          )}
        </div>

        <div className="w-full lg:w-64 lg:flex-shrink-0 space-y-4">
          <WorkflowPanel templates={workflowTemplates} />

          <div className="bg-card card-border rounded-2xl p-4 glow-blue">
            <div className="flex items-center justify-between mb-3">
              <p className="text-white font-semibold text-xs">{t('tasks.byCategory')}</p>
              <BarChart3 size={13} className="text-slate-500" />
            </div>
            <div className="space-y-2.5">
              {breakdownCategories.map(({ cat, count, overdue }) => {
                const cfg = categoryColors[cat]
                const pct = tasks.length ? Math.round((count / tasks.length) * 100) : 0
                return (
                  <div key={cat}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[10px] font-medium ${cfg.text}`}>{cat}</span>
                      <div className="flex items-center gap-1.5">
                        {overdue > 0 && <span className="text-[8px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">{overdue} overdue</span>}
                        <span className="text-[10px] text-slate-400">{count}</span>
                      </div>
                    </div>
                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${cfg.bar}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-card card-border rounded-2xl p-4 glow-blue">
            <p className="text-white font-semibold text-xs mb-3">{t('tasks.priorityBreakdown')}</p>
            <div className="space-y-2">
              {[
                { key: 'critical', label: t('tasks.critical'), color: 'text-red-400',   dot: 'bg-red-400' },
                { key: 'high',     label: t('tasks.high'),     color: 'text-amber-400', dot: 'bg-amber-400' },
                { key: 'medium',   label: t('tasks.medium'),   color: 'text-blue-400',  dot: 'bg-blue-400' },
                { key: 'low',      label: t('tasks.low'),      color: 'text-slate-400', dot: 'bg-slate-400' },
              ].map(({ key, label, color, dot }) => {
                const count = tasks.filter(t => t.priority === key).length
                return (
                  <div key={key} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                      <span className={`text-[10px] ${color}`}>{label}</span>
                    </div>
                    <span className="text-[10px] text-slate-400">{count} {count !== 1 ? t('tasks.tasksUnit') : t('tasks.taskUnit')}</span>
                  </div>
                )
              })}
              <div className="pt-2 border-t border-white/5 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500">{t('tasks.completionRate')}</span>
                  <span className="text-[10px] text-emerald-400 font-bold">{tasksSummary.completionRate}%</span>
                </div>
                <div className="h-1 bg-white/5 rounded-full overflow-hidden mt-1.5">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${tasksSummary.completionRate}%` }} />
                </div>
                <p className="text-[9px] text-slate-600 mt-1">{t('tasks.targetPct')} {tasksSummary.targetCompletionRate}%</p>
              </div>
            </div>
          </div>

          <div className="bg-card card-border rounded-2xl p-4 glow-blue">
            <p className="text-white font-semibold text-xs mb-3">{t('tasks.assigneeWorkload')}</p>
            <div className="space-y-2">
              {Object.entries(byAssignee)
                .sort((a, b) => b[1].count - a[1].count)
                .map(([name, data]) => (
                  <div key={name} className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold flex-shrink-0"
                      style={{ backgroundColor: `${data.color}25`, color: data.color }}>
                      {data.avatar || name.slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-300 truncate">{name.split(' ')[0]}</span>
                        <div className="flex items-center gap-1">
                          {data.overdue > 0 && <span className="text-[8px] text-red-400">{data.overdue} {t('tasks.overdueShort')}</span>}
                          <span className="text-[10px] text-slate-500">{data.count}</span>
                        </div>
                      </div>
                      <div className="h-0.5 bg-white/5 rounded-full overflow-hidden mt-0.5">
                        <div className="h-full rounded-full"
                          style={{ width: `${tasks.length ? (data.count / tasks.length) * 100 : 0}%`, backgroundColor: data.color || '#3b82f6' }} />
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      <TaskDrawer task={selected} onClose={() => setSelected(null)} onComplete={handleTaskComplete} />

      {showNewTask && (
        <NewTaskModal onClose={() => setShowNewTask(false)} onCreated={handleTaskCreated} />
      )}
    </div>
  )
}
