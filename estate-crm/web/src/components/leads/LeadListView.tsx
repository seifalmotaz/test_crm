import type { LeadResponseDto } from '../../api/types.gen';
import {
  LEAD_TYPE_LABELS,
  isLeadOverdue,
} from '../../types/leads';
import { Phone, Shield, CheckCircle } from 'lucide-react';

interface LeadListViewProps {
  leads: LeadResponseDto[];
  onRowClick: (lead: LeadResponseDto) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: (ids: string[]) => void;
}

const STAGE_BADGES: Record<string, { label: string; bg: string; text: string }> = {
  fresh: { label: 'Fresh', bg: 'bg-blue-500/15', text: 'text-blue-400' },
  qualified: { label: 'Qualified', bg: 'bg-amber-500/15', text: 'text-amber-400' },
  followUp: { label: 'Follow-up', bg: 'bg-purple-500/15', text: 'text-purple-400' },
  reservation: { label: 'Reservation', bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
  lost: { label: 'Lost', bg: 'bg-slate-500/15', text: 'text-slate-400' },
};

export default function LeadListView({
  leads,
  onRowClick,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
}: LeadListViewProps) {
  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 bg-card card-border rounded-2xl">
        <p className="text-slate-400 text-sm">No leads found</p>
      </div>
    );
  }

  const allSelected = leads.every((l) => selectedIds.has(l.id));
  const someSelected = leads.some((l) => selectedIds.has(l.id));

  return (
    <div className="bg-card card-border rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/5">
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  aria-label="Select all leads"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected && !allSelected;
                  }}
                  onChange={() =>
                    onToggleSelectAll(
                      allSelected ? [] : leads.map((l) => l.id),
                    )
                  }
                  className="w-4 h-4 rounded bg-white/5 border-white/20 accent-blue-500 cursor-pointer"
                />
              </th>
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
              const isSelected = selectedIds.has(lead.id);
              return (
                <tr
                  key={lead.id}
                  className={`border-b border-white/3 transition-colors ${
                    isSelected ? 'bg-blue-500/8' : 'hover:bg-white/3'
                  }`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label={`Select ${lead.name}`}
                      checked={isSelected}
                      onChange={(e) => {
                        e.stopPropagation();
                        onToggleSelect(lead.id);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 rounded bg-white/5 border-white/20 accent-blue-500 cursor-pointer"
                    />
                  </td>
                  <td
                    onClick={() => onRowClick(lead)}
                    className="px-4 py-3 cursor-pointer"
                  >
                    <p className="text-white text-xs font-medium truncate max-w-[200px]">{lead.name}</p>
                  </td>
                  <td onClick={() => onRowClick(lead)} className="px-4 py-3 text-slate-400 text-xs cursor-pointer">
                    <div className="flex items-center gap-1">
                      <Phone size={10} />
                      {lead.phone}
                    </div>
                  </td>
                  <td onClick={() => onRowClick(lead)} className="px-4 py-3 cursor-pointer">
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full border border-white/10 ${sb.bg} ${sb.text}`}
                    >
                      {sb.label}
                    </span>
                  </td>
                  <td onClick={() => onRowClick(lead)} className="px-4 py-3 text-slate-400 text-xs cursor-pointer">
                    {LEAD_TYPE_LABELS[lead.type] ?? lead.type}
                  </td>
                  <td onClick={() => onRowClick(lead)} className="px-4 py-3 text-slate-500 text-xs cursor-pointer">
                    {lead.source}
                  </td>
                  <td onClick={() => onRowClick(lead)} className="px-4 py-3 text-white text-xs font-semibold cursor-pointer">
                    {lead.score}
                  </td>
                  <td onClick={() => onRowClick(lead)} className="px-4 py-3 text-xs cursor-pointer">
                    {lead.nextAction ? (
                      <span className={overdue ? 'text-red-400' : 'text-slate-400'}>
                        {lead.nextAction}
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td onClick={() => onRowClick(lead)} className="px-4 py-3 cursor-pointer">
                    <div className="flex items-center gap-1">
                      {lead.isDnc && <Shield size={11} className="text-red-400" aria-label="DNC" />}
                      {lead.isClient && <CheckCircle size={11} className="text-amber-400" aria-label="Converted" />}
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