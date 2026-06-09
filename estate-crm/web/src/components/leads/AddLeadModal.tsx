import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { useCreateLead } from '../../hooks/useLeads';
import { LEAD_SOURCE_LABELS, LEAD_TYPE_LABELS } from '../../types/leads';
import type { CreateLeadDto } from '../../api/types.gen';

interface AddLeadModalProps {
  onClose: () => void;
  onSaved: (data: CreateLeadDto) => Promise<unknown>;
  agents: { id: string; name: string }[];
}

export default function AddLeadModal({ onClose, onSaved, agents }: AddLeadModalProps) {
  const [formData, setFormData] = useState<CreateLeadDto>({
    name: '',
    email: '',
    phone: '',
    source: 'website',
    type: 'buyer',
    budgetMin: undefined,
    budgetMax: undefined,
    timeline: undefined,
    preferredLocation: '',
    preferredType: '',
    notes: '',
    nextAction: '',
    nextActionDate: undefined,
    score: 0,
    agentId: undefined,
  });

  const createLead = useCreateLead();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Clean up optional empty fields
    const dto: CreateLeadDto = { ...formData };
    if (!dto.email) delete dto.email;
    if (!dto.budgetMin) delete dto.budgetMin;
    if (!dto.budgetMax) delete dto.budgetMax;
    if (!dto.timeline) delete dto.timeline;
    if (!dto.preferredLocation) delete dto.preferredLocation;
    if (!dto.preferredType) delete dto.preferredType;
    if (!dto.notes) delete dto.notes;
    if (!dto.nextAction) delete dto.nextAction;
    if (!dto.nextActionDate) delete dto.nextActionDate;
    if (!dto.agentId) delete dto.agentId;

    try {
      await onSaved(dto);
      onClose();
    } catch (err) {
      // Error surfaced via onSaved promise
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-card card-border rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <h2 className="text-white text-sm font-semibold">Add Lead</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Full name *" required>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                maxLength={255}
                placeholder="Ahmed Hassan"
                className="input"
              />
            </Field>
            <Field label="Phone *" required>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
                minLength={5}
                maxLength={50}
                placeholder="+201001234567"
                className="input"
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={formData.email ?? ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                maxLength={255}
                placeholder="ahmed@example.com"
                className="input"
              />
            </Field>
            <Field label="Source *" required>
              <select
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                required
                className="input"
              >
                {Object.entries(LEAD_SOURCE_LABELS).map(([k, v]) => (
                  <option key={k} value={k} className="bg-slate-900">{v}</option>
                ))}
              </select>
            </Field>
            <Field label="Type *" required>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                required
                className="input"
              >
                {Object.entries(LEAD_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k} className="bg-slate-900">{v}</option>
                ))}
              </select>
            </Field>
            <Field label="Assign to agent">
              <select
                value={formData.agentId ?? ''}
                onChange={(e) => setFormData({ ...formData, agentId: e.target.value || undefined })}
                className="input"
              >
                <option value="" className="bg-slate-900">Unassigned</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id} className="bg-slate-900">{a.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Budget min (cents)">
              <input
                type="number"
                value={formData.budgetMin ?? ''}
                onChange={(e) => setFormData({ ...formData, budgetMin: e.target.value ? Number(e.target.value) : undefined })}
                min={0}
                className="input"
              />
            </Field>
            <Field label="Budget max (cents)">
              <input
                type="number"
                value={formData.budgetMax ?? ''}
                onChange={(e) => setFormData({ ...formData, budgetMax: e.target.value ? Number(e.target.value) : undefined })}
                min={0}
                className="input"
              />
            </Field>
            <Field label="Timeline (months)">
              <input
                type="number"
                value={formData.timeline ?? ''}
                onChange={(e) => setFormData({ ...formData, timeline: e.target.value ? Number(e.target.value) : undefined })}
                min={0}
                className="input"
              />
            </Field>
            <Field label="Preferred location">
              <input
                type="text"
                value={formData.preferredLocation ?? ''}
                onChange={(e) => setFormData({ ...formData, preferredLocation: e.target.value })}
                maxLength={255}
                placeholder="New Cairo"
                className="input"
              />
            </Field>
            <Field label="Preferred type">
              <select
                value={formData.preferredType ?? ''}
                onChange={(e) => setFormData({ ...formData, preferredType: e.target.value || undefined })}
                className="input"
              >
                <option value="" className="bg-slate-900">—</option>
                {Object.entries(LEAD_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k} className="bg-slate-900">{v}</option>
                ))}
              </select>
            </Field>
            <Field label="Score (0-100)">
              <input
                type="number"
                value={formData.score ?? 0}
                onChange={(e) => setFormData({ ...formData, score: Math.min(100, Math.max(0, Number(e.target.value))) })}
                min={0}
                max={100}
                className="input"
              />
            </Field>
          </div>

          <Field label="Next action">
            <input
              type="text"
              value={formData.nextAction ?? ''}
              onChange={(e) => setFormData({ ...formData, nextAction: e.target.value })}
              maxLength={255}
              placeholder="Call back tomorrow"
              className="input"
            />
          </Field>
          <Field label="Next action date">
            <input
              type="datetime-local"
              value={formData.nextActionDate ? formData.nextActionDate.slice(0, 16) : ''}
              onChange={(e) => setFormData({ ...formData, nextActionDate: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
              className="input"
            />
          </Field>
          <Field label="Notes">
            <textarea
              value={formData.notes ?? ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="input resize-none"
              placeholder="Initial context about the lead…"
            />
          </Field>
        </form>

        <div className="flex justify-end gap-2 p-4 border-t border-white/5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={createLead.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white text-xs font-medium rounded-xl hover:bg-blue-600 disabled:opacity-50"
          >
            <Plus size={12} />
            {createLead.isPending ? 'Creating…' : 'Create lead'}
          </button>
        </div>
      </div>

      <style>{`
        .input {
          width: 100%;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 0.75rem;
          padding: 0.5rem 0.75rem;
          color: white;
          font-size: 0.75rem;
        }
        .input:focus { outline: none; border-color: rgba(59,130,246,0.5); }
        .input::placeholder { color: rgba(148,163,184,0.5); }
      `}</style>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-slate-400 text-[10px] uppercase tracking-wider font-semibold mb-1">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}
