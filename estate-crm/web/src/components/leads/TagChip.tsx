import { X } from 'lucide-react';

interface TagChipProps {
  id: string;
  tag: string;
  color: string;
  onRemove?: (id: string) => void;
}

export default function TagChip({ id, tag, color, onRemove }: TagChipProps) {
  // Background: ~14% opacity of the hex color. Foreground: full hex.
  const style = {
    background: `${color}24`, // 14% alpha
    color: color,
    borderColor: `${color}40`,
  };

  return (
    <span
      className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded-full border"
      style={style}
    >
      {tag}
      {onRemove && (
        <button
          onClick={() => onRemove(id)}
          className="hover:opacity-80 transition-opacity"
          aria-label={`Remove ${tag}`}
        >
          <X size={10} />
        </button>
      )}
    </span>
  );
}
