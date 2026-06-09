import type { LeadResponseDto } from '../../api/types.gen';
import {
  LEAD_TYPE_LABELS,
  isLeadOverdue,
} from '../../types/leads';
import { Phone, Shield, CheckCircle } from 'lucide-react';

interface LeadListViewProps {
  leads: LeadResponseDto[];
  onRowClick: (lead: LeadResponseDto) => void;
}

const STAGE_BADGES: Record<string, { label: string; bg: string; text: string }> = {
  fresh: { label: 'Fresh', bg: 'bg-blue-500/15', text: 'text-blue-400' },
  qualified: { label: 'Qualified', bg: 'bg-amber-500/15', text: 'text-amber-400' },
  followUp: { label: 'Follow-up', bg: 'bg-purple-500/15', text: 'text-purple-400' },
  reservation: { label: 'Reservation', bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
  lost: { label: 'Lost', bg: 'bg-slate-500/15', text: 'text-slate-400' },
};

export default function LeadListView({ leads, onRowClick }: LeadListViewProps) {
  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 bg-card card-border rounded-2xl">
        <p className="text-slate-400 text-sm">No leads found</p>
      </div>
    );
  }

  return (
    <div className="bg-card card-border rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/5">
              <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-slate-500 font-medium">Name</th>
              <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-slate-500 font-medium">Phone</th>
              <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-slate-500 font-medium">Stage</th>
              <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-slate-500 font-medium">Type</th>
              <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-slate-500 font-medium">Source</th>
              <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-slate-500 font-medium">Score</th>
              <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-slate-500 font-medium">Next Action</th>
              <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-slate-500 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => {
              const sb = STAGE_BADGES[lead.stage] ?? STAGE_BADGES.fresh;
              const overdue = isLeadOverdue(lead);
              return (
                <tr
                  key={lead.id}
                  onClick={() => onRowClick(lead)}
                  className="border-b border-white/3 hover:bg-white/3 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <p className="text-white text-xs font-medium truncate max-w-[200px]">
                      {lead.name}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    <div className="flex items-center gap-1">
                      <Phone size={10} />
                      {lead.phone}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full border border-white/10 ${sb.bg} ${sb.text}`}
                    >
                      {sb.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {LEAD_TYPE_LABELS[lead.type] ?? lead.type}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {lead.source}
                  </td>
                  <td className="px-4 py-3 text-white text-xs font-semibold">
                    {lead.score}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {lead.nextAction ? (
                      <span className={overdue ? 'text-red-400' : 'text-slate-400'}>
                        {lead.nextAction}
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {lead.isDnc && <Shield size={11} className="text-red-400" aria-label="DNC" />}
                      {lead.isConverted && <CheckCircle size={11} className="text-amber-400" aria-label="Converted" />}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
