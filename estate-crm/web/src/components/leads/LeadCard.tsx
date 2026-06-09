import { Phone, Shield, CheckCircle, AlertCircle, Calendar } from 'lucide-react';
import type { LeadResponseDto } from '../../api/types.gen';
import {
  LEAD_TYPE_LABELS,
  getLeadInitials,
  isLeadOverdue,
} from '../../types/leads';
import TagChip from './TagChip';
import type { LeadTagResponseDto } from '../../api/types.gen';

interface LeadCardProps {
  lead: LeadResponseDto;
  tags?: LeadTagResponseDto[];
  onClick: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
}

const STAGE_COLORS: Record<string, string> = {
  fresh: '#3B82F6',
  qualified: '#F59E0B',
  followUp: '#8B5CF6',
  reservation: '#10B981',
  lost: '#6B7280',
};

function ScoreBadge({ score }: { score: number }) {
  const style = score >= 90
    ? { background: 'rgba(192,128,144,0.14)', color: '#C08090' }
    : score >= 80
    ? { background: 'rgba(201,150,58,0.12)', color: '#C9963A' }
    : { background: 'rgba(107,158,199,0.12)', color: '#6B9EC7' };
  return (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={style}>
      {score}
    </span>
  );
}

export default function LeadCard({ lead, tags = [], onClick, draggable, onDragStart }: LeadCardProps) {
  const overdue = isLeadOverdue(lead);
  const initials = getLeadInitials(lead.name);
  const stageColor = STAGE_COLORS[lead.stage] ?? '#6B7280';

  return (
    <div
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      className={`group bg-card card-border rounded-xl p-3 cursor-pointer hover:bg-white/5 transition-all ${
        lead.isDnc ? 'border-red-500/30' : ''
      } ${lead.isConverted ? 'border-amber-500/30' : ''}`}
    >
      {/* Header row */}
      <div className="flex items-start gap-2 mb-2">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
          style={{ background: `${stageColor}30`, color: stageColor }}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-xs font-semibold truncate">{lead.name}</p>
          <p className="text-slate-500 text-[10px] truncate flex items-center gap-1">
            <Phone size={9} /> {lead.phone}
          </p>
        </div>
        <ScoreBadge score={lead.score} />
      </div>

      {/* Source + type chips */}
      <div className="flex flex-wrap gap-1 mb-2">
        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 text-slate-400">
          {LEAD_TYPE_LABELS[lead.type] ?? lead.type}
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 text-slate-500">
          {lead.source}
        </span>
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {tags.slice(0, 3).map((tag) => (
            <TagChip key={tag.id} id={tag.id} tag={tag.tag} color={tag.color} />
          ))}
          {tags.length > 3 && (
            <span className="text-[10px] text-slate-500">+{tags.length - 3}</span>
          )}
        </div>
      )}

      {/* Footer: next action + status flags */}
      <div className="flex items-center justify-between text-[10px]">
        {lead.nextAction ? (
          <span className={`flex items-center gap-1 truncate ${overdue ? 'text-red-400' : 'text-slate-400'}`}>
            {overdue ? <AlertCircle size={9} /> : <Calendar size={9} />}
            <span className="truncate">{lead.nextAction}</span>
          </span>
        ) : (
          <span className="text-slate-500">—</span>
        )}
        <div className="flex items-center gap-1 flex-shrink-0">
          {lead.isDnc && (
            <span title="DNC">
              <Shield size={10} className="text-red-400" />
            </span>
          )}
          {lead.isConverted && (
            <span title="Converted">
              <CheckCircle size={10} className="text-amber-400" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
