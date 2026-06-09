import { useState } from 'react';
import { Plus, Check } from 'lucide-react';
import { useAddTag } from '../../hooks/useLeadTags';
import type { AddTagDto } from '../../api/types.gen';

const PRESET_COLORS = [
  '#EF4444', // red
  '#F59E0B', // amber
  '#10B981', // emerald
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#6B7280', // gray
];

interface AddTagPopoverProps {
  leadId: string;
  onClose: () => void;
}

export default function AddTagPopover({ leadId, onClose }: AddTagPopoverProps) {
  const [tag, setTag] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const addTagMutation = useAddTag(leadId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tag.trim()) return;

    const dto: AddTagDto = { tag: tag.trim(), color };
    addTagMutation.mutate(dto, {
      onSuccess: () => onClose(),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="bg-card card-border rounded-2xl p-4 space-y-3">
      <div>
        <label className="block text-slate-400 text-xs mb-1">Tag label</label>
        <input
          type="text"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          maxLength={100}
          placeholder="e.g., Hot, VIP, Investor"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50"
        />
      </div>
      <div>
        <label className="block text-slate-400 text-xs mb-2">Color</label>
        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all ${
                color === c ? 'border-white scale-110' : 'border-transparent'
              }`}
              style={{ background: c }}
              aria-label={`Color ${c}`}
            >
              {color === c && <Check size={12} className="text-white" />}
            </button>
          ))}
          <input
            type="text"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            placeholder="#000000"
            pattern="^#[0-9A-Fa-f]{6}$"
            className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-xs w-20 focus:outline-none focus:border-blue-500/50"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!tag.trim() || addTagMutation.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white text-xs rounded-xl hover:bg-blue-600 disabled:opacity-50 transition-all"
        >
          <Plus size={12} />
          {addTagMutation.isPending ? 'Adding…' : 'Add tag'}
        </button>
      </div>
    </form>
  );
}
