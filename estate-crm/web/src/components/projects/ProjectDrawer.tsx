import { useState } from 'react';
import { X, Building2, MapPin, Calendar, Layers, Trash2, Edit2, Check, AlertTriangle } from 'lucide-react';
import type { ProjectView } from '../../types/projects';
import type { UpdateProjectDto } from '../../api/types.gen';

interface ProjectDrawerProps {
  project: ProjectView | null;
  onClose: () => void;
  onUpdate: (data: UpdateProjectDto) => Promise<void>;
  onDelete: () => void;
  onChangeStatus: (status: string) => void;
  canManage: boolean;
}

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  planning: { label: 'Planning', bg: 'bg-blue-500/15', text: 'text-blue-400' },
  preLaunch: { label: 'Pre-Launch', bg: 'bg-purple-500/15', text: 'text-purple-400' },
  active: { label: 'Active', bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
  soldOut: { label: 'Sold Out', bg: 'bg-amber-500/15', text: 'text-amber-400' },
  delivered: { label: 'Delivered', bg: 'bg-slate-500/15', text: 'text-slate-400' },
};

const statusTransitions: Record<string, string[]> = {
  planning: ['preLaunch', 'active'],
  preLaunch: ['active', 'planning'],
  active: ['soldOut', 'delivered'],
  soldOut: ['delivered'],
  delivered: [],
};

function generateGradient(id: string): string {
  const colors = [
    'from-blue-600/40 via-indigo-600/30 to-purple-700/40',
    'from-emerald-600/40 via-teal-600/30 to-cyan-700/40',
    'from-amber-600/40 via-orange-600/30 to-red-700/40',
    'from-violet-600/40 via-purple-600/30 to-fuchsia-700/40',
    'from-rose-600/40 via-pink-600/30 to-red-700/40',
    'from-sky-600/40 via-blue-600/30 to-indigo-700/40',
  ];
  const idx = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length;
  return colors[idx];
}

export default function ProjectDrawer({
  project,
  onClose,
  onUpdate,
  onDelete,
  onChangeStatus,
  canManage,
}: ProjectDrawerProps) {
  const [editing, setEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<UpdateProjectDto>({});

  if (!project) return null;
  const p = project;

  const statusCfg = statusConfig[p.status] || statusConfig.planning;
  const transitions = statusTransitions[p.status] || [];

  const pct = p.totalUnits && p.totalUnits > 0
    ? Math.round((p.soldUnits / p.totalUnits) * 100)
    : 0;

  function startEditing() {
    setForm({
      name: p.name,
      description: p.description,
      location: p.location,
      developerName: p.developerName,
      launchDate: p.launchDate ? p.launchDate.split('T')[0] : undefined,
      completionDate: p.completionDate ? p.completionDate.split('T')[0] : undefined,
      totalUnits: p.totalUnits,
    });
    setEditing(true);
    setError('');
  }

  function cancelEditing() {
    setEditing(false);
    setForm({});
    setError('');
  }

  async function saveEdits() {
    setSaving(true);
    setError('');
    try {
      const updateData: UpdateProjectDto = { ...form };
      // Convert date-only values back to ISO strings if they're date input values
      if (updateData.launchDate && updateData.launchDate.length === 10) {
        updateData.launchDate = updateData.launchDate;
      }
      if (updateData.completionDate && updateData.completionDate.length === 10) {
        updateData.completionDate = updateData.completionDate;
      }
      await onUpdate(updateData);
      setEditing(false);
      setForm({});
    } catch (err: any) {
      setError(err?.detail || err?.message || 'Failed to update project');
    } finally {
      setSaving(false);
    }
  }

  function handleChangeStatus(status: string) {
    onChangeStatus(status);
  }

  function inputCls() {
    return `w-full bg-white/5 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-all`;
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed end-0 top-0 h-full w-full sm:w-[480px] bg-card border-s border-white/10 z-50 overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-card/95 backdrop-blur-sm border-b border-white/5 px-5 py-4 flex items-center gap-3 z-10">
          <div className="flex-1 min-w-0">
            {editing ? (
              <input
                value={(form.name as string) || ''}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sm text-white font-semibold focus:outline-none focus:border-blue-500/50"
              />
            ) : (
              <p className="text-white font-bold text-base truncate">{project.name}</p>
            )}
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border border-white/10 ${statusCfg.bg} ${statusCfg.text}`}>
                {statusCfg.label}
              </span>
            </div>
          </div>
          {canManage && !editing && (
            <button
              onClick={startEditing}
              className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 hover:bg-blue-500/20 transition-all"
            >
              <Edit2 size={14} />
            </button>
          )}
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Gradient header */}
          <div className={`h-32 bg-gradient-to-br ${generateGradient(project.id)} rounded-2xl flex items-center justify-center`}>
            <Building2 size={48} className="text-white/25" />
          </div>

          {/* Description */}
          {(project.description || editing) && (
            <div>
              <p className="text-slate-500 text-[9px] uppercase tracking-wider mb-1">Description</p>
              {editing ? (
                <textarea
                  value={(form.description as string) || ''}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-all resize-none h-20"
                  placeholder="Add description..."
                />
              ) : (
                <p className="text-slate-400 text-xs leading-relaxed">{project.description}</p>
              )}
            </div>
          )}

          {/* Details Grid */}
          <div>
            <p className="text-slate-500 text-[9px] uppercase tracking-wider mb-2">Details</p>
            <div className="grid grid-cols-2 gap-2">
              {/* Location */}
              <div className="bg-white/4 border border-white/8 rounded-xl p-3">
                <p className="text-slate-500 text-[9px] uppercase tracking-wider mb-1">Location</p>
                {editing ? (
                  <input
                    value={(form.location as string) || ''}
                    onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                    className={inputCls()}
                    placeholder="Project location"
                  />
                ) : (
                  <p className="text-white text-xs font-medium flex items-center gap-1">
                    <MapPin size={12} className="text-slate-500 flex-shrink-0" />
                    {project.location}
                  </p>
                )}
              </div>

              {/* Developer */}
              <div className="bg-white/4 border border-white/8 rounded-xl p-3">
                <p className="text-slate-500 text-[9px] uppercase tracking-wider mb-1">Developer</p>
                {editing ? (
                  <input
                    value={(form.developerName as string) || ''}
                    onChange={(e) => setForm((f) => ({ ...f, developerName: e.target.value }))}
                    className={inputCls()}
                    placeholder="Developer name"
                  />
                ) : (
                  <p className="text-white text-xs font-medium">
                    {project.developerName || '—'}
                  </p>
                )}
              </div>

              {/* Launch Date */}
              <div className="bg-white/4 border border-white/8 rounded-xl p-3">
                <p className="text-slate-500 text-[9px] uppercase tracking-wider mb-1">Launch Date</p>
                {editing ? (
                  <input
                    type="date"
                    value={(form.launchDate as string) || ''}
                    onChange={(e) => setForm((f) => ({ ...f, launchDate: e.target.value }))}
                    className={inputCls()}
                  />
                ) : (
                  <p className="text-white text-xs font-medium flex items-center gap-1">
                    <Calendar size={12} className="text-slate-500 flex-shrink-0" />
                    {project.launchDate
                      ? new Date(project.launchDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : '—'}
                  </p>
                )}
              </div>

              {/* Completion Date */}
              <div className="bg-white/4 border border-white/8 rounded-xl p-3">
                <p className="text-slate-500 text-[9px] uppercase tracking-wider mb-1">Completion Date</p>
                {editing ? (
                  <input
                    type="date"
                    value={(form.completionDate as string) || ''}
                    onChange={(e) => setForm((f) => ({ ...f, completionDate: e.target.value }))}
                    className={inputCls()}
                  />
                ) : (
                  <p className="text-white text-xs font-medium flex items-center gap-1">
                    <Calendar size={12} className="text-slate-500 flex-shrink-0" />
                    {project.completionDate
                      ? new Date(project.completionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : '—'}
                  </p>
                )}
              </div>

              {/* Total Units */}
              <div className="bg-white/4 border border-white/8 rounded-xl p-3">
                <p className="text-slate-500 text-[9px] uppercase tracking-wider mb-1">Total Units</p>
                {editing ? (
                  <input
                    type="number"
                    min="0"
                    value={form.totalUnits ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, totalUnits: e.target.value ? Number(e.target.value) : undefined }))
                    }
                    className={inputCls()}
                    placeholder="—"
                  />
                ) : (
                  <p className="text-white text-xs font-medium flex items-center gap-1">
                    <Layers size={12} className="text-slate-500 flex-shrink-0" />
                    {project.totalUnits ?? '—'}
                  </p>
                )}
              </div>

              {/* Sold Units */}
              <div className="bg-white/4 border border-white/8 rounded-xl p-3">
                <p className="text-slate-500 text-[9px] uppercase tracking-wider mb-1">Sold Units</p>
                <p className="text-white text-xs font-medium">
                  {project.soldUnits ?? 0}
                </p>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          {project.totalUnits && project.totalUnits > 0 && (
            <div>
              <p className="text-slate-500 text-[9px] uppercase tracking-wider mb-2">Sales Progress</p>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">{project.soldUnits} / {project.totalUnits} units sold</span>
                  <span className="text-slate-400 font-medium">{pct}%</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Created at */}
          <div>
            <p className="text-slate-500 text-[9px] uppercase tracking-wider mb-1">Created</p>
            <p className="text-slate-400 text-xs">
              {new Date(project.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          </div>

          {/* Admin/Manager Controls */}
          {canManage && (
            <div className="space-y-3 pt-2 border-t border-white/10">
              {editing ? (
                /* Edit mode controls */
                <div className="space-y-2">
                  {error && (
                    <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={cancelEditing}
                      className="flex-1 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveEdits}
                      disabled={saving}
                      className="flex-1 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-60 rounded-xl text-xs font-semibold text-white transition-all flex items-center justify-center gap-1"
                    >
                      {saving ? 'Saving...' : <><Check size={13} /> Save</>}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Status transition */}
                  {transitions.length > 0 && (
                    <div>
                      <p className="text-slate-500 text-[9px] uppercase tracking-wider mb-2">Change Status</p>
                      <div className="flex flex-wrap gap-1.5">
                        {transitions.map((st) => {
                          const cfg = statusConfig[st] || statusConfig.planning;
                          return (
                            <button
                              key={st}
                              onClick={() => handleChangeStatus(st)}
                              className={`text-[10px] font-medium px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.text} border-white/10 hover:opacity-80 transition-all`}
                            >
                              {cfg.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Delete */}
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-500/10 border border-red-500/25 rounded-xl text-red-300 text-xs font-medium hover:bg-red-500/20 transition-all"
                  >
                    <Trash2 size={13} /> Delete Project
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card card-border rounded-2xl w-full max-w-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={16} className="text-red-400" />
              <p className="text-white font-semibold text-sm">Delete Project</p>
            </div>
            <p className="text-slate-400 text-xs mb-4">
              Are you sure you want to delete <span className="text-white font-medium">{project.name}</span>?
              This action can be undone later (soft delete).
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-slate-400 hover:text-white transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  onDelete();
                }}
                className="flex-1 py-2 bg-red-500 rounded-xl text-xs font-semibold text-white hover:bg-red-600 transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}