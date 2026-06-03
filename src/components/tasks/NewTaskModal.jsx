import { useState, useEffect } from 'react'
import { X, Plus } from 'lucide-react'
import api from '../../lib/api'
import { mapAgent } from '../../lib/mappers'
import { useAuth } from '../../context/AuthContext'

const CATEGORIES = ['Deal', 'Lead', 'Property', 'Client', 'Admin']
const PRIORITIES = ['critical', 'high', 'medium', 'low']

export default function NewTaskModal({ onClose, onCreated }) {
  const { user } = useAuth()
  const isAgent  = user?.role === 'agent'
  const [agents, setAgents]   = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [form, setForm]       = useState({
    title:       '',
    category:    'Admin',
    priority:    'medium',
    dueDate:     '',
    assigneeId:  '',
    description: '',
  })

  useEffect(() => {
    api.get('/api/agents?per_page=100')
      .then(res => setAgents((res.data || []).map(mapAgent)))
      .catch(console.error)
  }, [])

  function set(key, val) {
    setForm(f => ({ ...f, [key]: val }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.title.trim()) { setError('Title is required'); return }
    if (!form.dueDate)       { setError('Due date is required'); return }
    if (!form.assigneeId)    { setError('Please select an assignee'); return }
    setLoading(true)
    try {
      const res = await api.post('/api/tasks', {
        ...form,
        status: 'not_started',
      })
      onCreated(res.data)
      onClose()
    } catch (err) {
      setError(err?.message || 'Failed to create task')
    } finally {
      setLoading(false)
    }
  }

  const priorityColors = {
    critical: 'text-red-400',
    high:     'text-amber-400',
    medium:   'text-blue-400',
    low:      'text-slate-400',
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl">

          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
            <h2 className="text-white font-bold text-sm flex items-center gap-2">
              <Plus size={15} className="text-blue-400" />
              New Task
            </h2>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

            {/* Title */}
            <div>
              <label className="text-slate-400 text-[10px] font-semibold uppercase tracking-widest block mb-1.5">
                Title <span className="text-red-400">*</span>
              </label>
              <input
                value={form.title}
                onChange={e => set('title', e.target.value)}
                placeholder="Enter task title..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-all"
              />
            </div>

            {/* Category + Priority */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 text-[10px] font-semibold uppercase tracking-widest block mb-1.5">Category</label>
                <select
                  value={form.category}
                  onChange={e => set('category', e.target.value)}
                  className="w-full appearance-none bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 cursor-pointer"
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c} className="bg-[#0f172a]">{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-slate-400 text-[10px] font-semibold uppercase tracking-widest block mb-1.5">Priority</label>
                <select
                  value={form.priority}
                  onChange={e => set('priority', e.target.value)}
                  className="w-full appearance-none bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 cursor-pointer"
                >
                  {PRIORITIES.map(p => (
                    <option key={p} value={p} className={`bg-[#0f172a] ${priorityColors[p]}`}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Due Date + Assignee */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 text-[10px] font-semibold uppercase tracking-widest block mb-1.5">
                  Due Date <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={e => set('dueDate', e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 cursor-pointer"
                  style={{ colorScheme: 'dark' }}
                />
              </div>
              {!isAgent && (
              <div>
                <label className="text-slate-400 text-[10px] font-semibold uppercase tracking-widest block mb-1.5">
                  Assign To <span className="text-red-400">*</span>
                </label>
                <select
                  value={form.assigneeId}
                  onChange={e => set('assigneeId', e.target.value)}
                  className="w-full appearance-none bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 cursor-pointer"
                >
                  <option value="" disabled className="bg-[#0f172a] text-slate-500">Select agent...</option>
                  {agents.map(a => (
                    <option key={a.id} value={a.id} className="bg-[#0f172a]">{a.name}</option>
                  ))}
                </select>
              </div>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="text-slate-400 text-[10px] font-semibold uppercase tracking-widest block mb-1.5">
                Description <span className="text-slate-600">(optional)</span>
              </label>
              <textarea
                value={form.description}
                onChange={e => set('description', e.target.value)}
                placeholder="Describe what needs to be done..."
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 resize-none transition-all"
              />
            </div>

            {error && (
              <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-slate-300 hover:bg-white/8 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-blue-500 rounded-xl text-xs font-semibold text-white hover:bg-blue-600 transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus size={13} />
                {loading ? 'Creating...' : 'Create Task'}
              </button>
            </div>

          </form>
        </div>
      </div>
    </>
  )
}
