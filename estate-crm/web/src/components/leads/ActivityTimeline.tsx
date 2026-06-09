import { Phone, Mail, Users, FileText, GitBranch, UserCheck, ShieldOff, ShieldCheck, CheckCircle } from 'lucide-react';
import type { LeadActivityResponseDto } from '../../api/types.gen';
import { LEAD_ACTIVITY_TYPE_LABELS } from '../../types/leads';

const TYPE_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  call: Phone,
  email: Mail,
  meeting: Users,
  note: FileText,
  stage_change: GitBranch,
  assignment: UserCheck,
  dnc_set: ShieldOff,
  dnc_unset: ShieldCheck,
  convert: CheckCircle,
};

const TYPE_COLORS: Record<string, string> = {
  call: '#3B82F6',      // blue
  email: '#8B5CF6',     // violet
  meeting: '#F59E0B',   // amber
  note: '#6B7280',      // gray
  stage_change: '#10B981', // emerald
  assignment: '#06B6D4',  // cyan
  dnc_set: '#EF4444',     // red
  dnc_unset: '#22C55E',   // green
  convert: '#EC4899',     // pink
};

function timeAgo(date: string): string {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return past.toLocaleDateString();
}

interface ActivityTimelineProps {
  activities: LeadActivityResponseDto[];
  isLoading?: boolean;
}

export default function ActivityTimeline({ activities, isLoading }: ActivityTimelineProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-slate-400 text-xs">Loading activities…</div>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <p className="text-slate-400 text-xs">No activities yet</p>
        <p className="text-slate-500 text-[10px] mt-1">Add a call, note, or log a meeting</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activities.map((activity, idx) => {
        const Icon = TYPE_ICONS[activity.type] ?? FileText;
        const color = TYPE_COLORS[activity.type] ?? '#6B7280';
        const isLast = idx === activities.length - 1;

        return (
          <div key={activity.id} className="flex gap-3">
            {/* Timeline line + dot */}
            <div className="flex flex-col items-center">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: `${color}24`, border: `1px solid ${color}40`, color }}
              >
                <Icon size={14} />
              </div>
              {!isLast && <div className="w-px flex-1 bg-white/5 mt-1" />}
            </div>

            {/* Content */}
            <div className="flex-1 pb-3 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color }}>
                  {LEAD_ACTIVITY_TYPE_LABELS[activity.type] ?? activity.type}
                </span>
                <span className="text-slate-500 text-[10px] flex-shrink-0">{timeAgo(activity.createdAt)}</span>
              </div>
              <p className="text-white text-xs leading-relaxed break-words">{activity.content}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
