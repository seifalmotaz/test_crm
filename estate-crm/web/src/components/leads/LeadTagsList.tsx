import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useAddTag, useRemoveTag } from '../../hooks/useLeadTags';
import TagChip from './TagChip';
import type { LeadTagResponseDto } from '../../api/types.gen';

interface LeadTagsListProps {
  leadId: string;
  tags: LeadTagResponseDto[];
  canManage: boolean;
}

export default function LeadTagsList({ leadId, tags, canManage }: LeadTagsListProps) {
  const [showAdd, setShowAdd] = useState(false);
  const removeTag = useRemoveTag(leadId);

  if (tags.length === 0 && !canManage) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold">Tags</p>
        {canManage && !showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1 text-blue-400 text-[10px] hover:text-blue-300 transition-colors"
          >
            <Plus size={10} /> Add
          </button>
        )}
      </div>

      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <TagChip
              key={tag.id}
              id={tag.id}
              tag={tag.tag}
              color={tag.color}
              onRemove={canManage ? (id) => removeTag.mutate(id) : undefined}
            />
          ))}
        </div>
      ) : (
        <p className="text-slate-600 text-[10px]">No tags yet</p>
      )}

      {showAdd && (
        <div className="pt-2">
          <AddTagInline leadId={leadId} onClose={() => setShowAdd(false)} />
        </div>
      )}
    </div>
  );
}

// Inline add form (similar to AddTagPopover but compact)
function AddTagInline({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const addTag = useAddTag(leadId);
  const [tag, setTag] = useState('');
  const [color, setColor] = useState('#EF4444');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tag.trim()) return;
    addTag.mutate(
      { tag: tag.trim(), color },
      { onSuccess: onClose },
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-1.5">
      <input
        type="text"
        value={tag}
        onChange={(e) => setTag(e.target.value)}
        placeholder="Tag name"
        maxLength={100}
        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-[10px] focus:outline-none focus:border-blue-500/50"
        autoFocus
      />
      <input
        type="text"
        value={color}
        onChange={(e) => setColor(e.target.value)}
        pattern="^#[0-9A-Fa-f]{6}$"
        className="w-16 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-[10px] focus:outline-none focus:border-blue-500/50"
      />
      <button
        type="submit"
        disabled={!tag.trim() || addTag.isPending}
        className="px-2 py-1 bg-blue-500 text-white text-[10px] rounded-lg hover:bg-blue-600 disabled:opacity-50"
      >
        Add
      </button>
      <button
        type="button"
        onClick={onClose}
        className="px-2 py-1 text-slate-400 text-[10px] hover:text-white"
      >
        <X size={10} />
      </button>
    </form>
  );
}
