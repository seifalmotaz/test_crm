import { Search, X } from 'lucide-react';
import {
  LEAD_SOURCE_LABELS,
  LEAD_TYPE_LABELS,
} from '../../types/leads';
import type { LeadFilters } from '../../types/leads';

interface LeadFiltersBarProps {
  filters: LeadFilters;
  onChange: (filters: LeadFilters) => void;
  resultCount: number;
}

const STAGE_OPTIONS = [
  { id: 'all', label: 'All Stages' },
  { id: 'fresh', label: 'Fresh' },
  { id: 'qualified', label: 'Qualified' },
  { id: 'followUp', label: 'Follow-up' },
  { id: 'reservation', label: 'Reservation' },
  { id: 'lost', label: 'Lost' },
];

export default function LeadFiltersBar({ filters, onChange, resultCount }: LeadFiltersBarProps) {
  function handleClear() {
    onChange({
      search: '',
      stage: 'all',
      source: undefined,
      type: undefined,
      agentId: undefined,
      isDnc: undefined,
      isClient: undefined,
      page: 1,
      limit: 100,
    });
  }

  const hasActiveFilters =
    filters.search ||
    (filters.stage && filters.stage !== 'all') ||
    filters.source ||
    filters.type ||
    filters.isDnc !== undefined ||
    filters.isClient !== undefined;

  return (
    <div className="space-y-2 mb-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={filters.search ?? ''}
            onChange={(e) => onChange({ ...filters, search: e.target.value, page: 1 })}
            placeholder="Search by name, email, or phone…"
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500/50"
          />
        </div>

        <select
          value={filters.source ?? ''}
          onChange={(e) => onChange({ ...filters, source: e.target.value || undefined, page: 1 })}
          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500/50 min-w-[140px]"
        >
          <option value="" className="bg-slate-900">All Sources</option>
          {Object.entries(LEAD_SOURCE_LABELS).map(([k, v]) => (
            <option key={k} value={k} className="bg-slate-900">{v}</option>
          ))}
        </select>

        <select
          value={filters.type ?? ''}
          onChange={(e) => onChange({ ...filters, type: e.target.value || undefined, page: 1 })}
          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500/50 min-w-[140px]"
        >
          <option value="" className="bg-slate-900">All Types</option>
          {Object.entries(LEAD_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k} className="bg-slate-900">{v}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {STAGE_OPTIONS.map((opt) => {
          const isActive = (filters.stage ?? 'all') === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => onChange({ ...filters, stage: opt.id, page: 1 })}
              className={`px-3 py-1 rounded-lg text-[10px] font-medium transition-all ${
                isActive
                  ? 'bg-blue-500 text-white'
                  : 'text-slate-400 border border-white/10 hover:text-white hover:bg-white/5'
              }`}
            >
              {opt.label}
            </button>
          );
        })}

        {hasActiveFilters && (
          <button
            onClick={handleClear}
            className="ml-auto flex items-center gap-1 px-2 py-1 text-[10px] text-slate-400 hover:text-white transition-colors"
          >
            <X size={10} /> Clear
          </button>
        )}

        <span className="text-slate-500 text-[10px] ml-2">
          {resultCount} {resultCount === 1 ? 'lead' : 'leads'}
        </span>
      </div>
    </div>
  );
}
