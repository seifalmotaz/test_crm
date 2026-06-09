import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useAddActivity } from '../../hooks/useLeadActivities';
import { LEAD_ACTIVITY_TYPE_LABELS } from '../../types/leads';
import type { AddActivityDto } from '../../api/types.gen';

const ACTIVITY_TYPES = ['call', 'email', 'meeting', 'note'] as const;

interface AddActivityFormProps {
  leadId: string;
  onClose: () => void;
}

export default function AddActivityForm({ leadId, onClose }: AddActivityFormProps) {
  const [type, setType] = useState<typeof ACTIVITY_TYPES[number]>('note');
  const [content, setContent] = useState('');
  const addActivity = useAddActivity(leadId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;

    const dto: AddActivityDto = { type, content: content.trim() };
    addActivity.mutate(dto, {
      onSuccess: () => {
        setContent('');
        onClose();
      },
    });
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-white text-xs font-semibold">New activity</h4>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
          <X size={14} />
        </button>
      </div>

      <div>
        <label className="block text-slate-400 text-xs mb-1.5">Type</label>
        <div className="flex gap-1.5 flex-wrap">
          {ACTIVITY_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`px-3 py-1 rounded-lg text-[10px] font-medium transition-all ${
                type === t
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  : 'text-slate-400 border border-white/10 hover:text-white'
              }`}
            >
              {LEAD_ACTIVITY_TYPE_LABELS[t] ?? t}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-slate-400 text-xs mb-1.5">Content</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          minLength={1}
          maxLength={5000}
          rows={3}
          placeholder="What happened? Add details for the timeline…"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500/50 resize-none"
        />
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!content.trim() || addActivity.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white text-xs rounded-xl hover:bg-blue-600 disabled:opacity-50 transition-all"
        >
          <Plus size={12} />
          {addActivity.isPending ? 'Adding…' : 'Add activity'}
        </button>
      </div>
    </form>
  );
}
