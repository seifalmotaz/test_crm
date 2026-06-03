import { useState, useEffect } from 'react'
import { X, MessageSquare, Pencil, Trash2, Check, Clock } from 'lucide-react'
import api from '../../lib/api'

const TYPE_ICONS = {
  call:    '📞',
  email:   '📧',
  meeting: '🤝',
  view:    '👁',
  request: '📋',
  form:    '📝',
  action:  '⚡',
}

export default function LeadCommentsModal({ lead, onClose }) {
  const [comments, setComments]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [editId, setEditId]       = useState(null)
  const [editText, setEditText]   = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [saving, setSaving]       = useState(false)
  const [deleteId, setDeleteId]   = useState(null)
  const [deleting, setDeleting]   = useState(false)
  const [error, setError]         = useState('')

  useEffect(() => {
    if (!lead?.id) return
    setLoading(true)
    api.get(`/api/leads/${lead.id}/interactions?per_page=50`)
      .then(res => setComments(res.data || []))
      .catch(() => setError('Failed to load comments'))
      .finally(() => setLoading(false))
  }, [lead?.id])

  function startEdit(c) {
    setEditId(c.id)
    setEditText(c.action || '')
    setEditNotes(c.notes || '')
    setError('')
  }

  async function saveEdit() {
    if (!editText.trim() || saving) return
    setSaving(true)
    setError('')
    try {
      const res = await api.patch(`/api/leads/${lead.id}/interactions/${editId}`, {
        action: editText.trim(),
        notes:  editNotes.trim() || null,
      })
      setComments(prev => prev.map(c => c.id === editId ? res.data : c))
      setEditId(null)
    } catch (err) {
      setError(err.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteId || deleting) return
    setDeleting(true)
    setError('')
    try {
      await api.delete(`/api/leads/${lead.id}/interactions/${deleteId}`)
      setComments(prev => prev.filter(c => c.id !== deleteId))
      setDeleteId(null)
    } catch (err) {
      setError(err.message || 'Failed to delete')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card card-border rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 flex-shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquare size={15} className="text-blue-400" />
            <h2 className="text-white font-semibold text-sm">Comments</h2>
            <span className="text-slate-500 text-xs">— {lead.name}</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-500 text-sm">No comments yet for this lead.</p>
            </div>
          ) : (
            comments.map(c => (
              <div key={c.id} className="bg-white/4 border border-white/8 rounded-xl p-3">
                {editId === c.id ? (
                  /* Edit form */
                  <div className="space-y-2">
                    <input
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      className="w-full bg-white/5 border border-white/12 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50"
                      placeholder="Comment text…"
                      autoFocus
                    />
                    <textarea
                      value={editNotes}
                      onChange={e => setEditNotes(e.target.value)}
                      rows={2}
                      className="w-full bg-white/5 border border-white/12 rounded-lg px-3 py-1.5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 resize-none"
                      placeholder="Notes (optional)…"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={saveEdit}
                        disabled={saving || !editText.trim()}
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 rounded-lg text-white text-xs font-semibold transition-all"
                      >
                        <Check size={11} /> {saving ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        onClick={() => setEditId(null)}
                        className="px-3 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg text-slate-400 text-xs transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : deleteId === c.id ? (
                  /* Delete confirmation */
                  <div className="space-y-2">
                    <p className="text-red-300 text-xs">Delete this comment? This cannot be undone.</p>
                    <div className="flex gap-2">
                      <button
                        onClick={confirmDelete}
                        disabled={deleting}
                        className="px-3 py-1.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 rounded-lg text-white text-xs font-semibold transition-all"
                      >
                        {deleting ? 'Deleting…' : 'Yes, Delete'}
                      </button>
                      <button
                        onClick={() => setDeleteId(null)}
                        className="px-3 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg text-slate-400 text-xs transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Normal view */
                  <div className="flex items-start gap-2">
                    <span className="text-base leading-none mt-0.5 flex-shrink-0">
                      {TYPE_ICONS[c.type] || '💬'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-200 text-sm leading-snug">{c.action}</p>
                      {c.notes && (
                        <p className="text-slate-500 text-xs mt-0.5 italic">{c.notes}</p>
                      )}
                      <div className="flex items-center gap-1 mt-1.5 text-slate-600 text-[10px]">
                        <Clock size={9} />
                        {c.date ? new Date(c.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => startEdit(c)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
                        title="Edit"
                      >
                        <Pencil size={11} />
                      </button>
                      <button
                        onClick={() => { setDeleteId(c.id); setError('') }}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        title="Delete"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}

          {error && (
            <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/8 flex-shrink-0">
          <p className="text-slate-600 text-[10px]">
            {comments.length} comment{comments.length !== 1 ? 's' : ''} · Only you (admin/manager) can edit or delete
          </p>
        </div>
      </div>
    </div>
  )
}
