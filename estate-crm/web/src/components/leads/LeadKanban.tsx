import { useMemo, useState } from 'react';
import LeadCard from './LeadCard';
import type { LeadResponseDto, LeadTagResponseDto } from '../../api/types.gen';
import { LEAD_STAGE_COLUMNS } from '../../types/leads';
import { CheckSquare, Square, X } from 'lucide-react';

interface LeadKanbanProps {
  leads: LeadResponseDto[];
  tagsByLeadId: Record<string, LeadTagResponseDto[]>;
  onCardClick: (lead: LeadResponseDto) => void;
  onStageChange: (leadId: string, newStage: string) => void;
  canManage: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
}

export default function LeadKanban({
  leads,
  tagsByLeadId,
  onCardClick,
  onStageChange,
  canManage,
  selectedIds,
  onToggleSelect,
}: LeadKanbanProps) {
  const [selectMode, setSelectMode] = useState(false);

  const grouped = useMemo(() => {
    const groups: Record<string, LeadResponseDto[]> = {
      fresh: [],
      qualified: [],
      followUp: [],
      reservation: [],
      lost: [],
    };
    for (const lead of leads) {
      if (groups[lead.stage]) {
        groups[lead.stage].push(lead);
      }
    }
    return groups;
  }, [leads]);

  function handleDragStart(e: React.DragEvent<HTMLDivElement>, leadId: string) {
    e.dataTransfer.setData('text/plain', leadId);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    if (!canManage) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>, newStage: string) {
    if (!canManage) return;
    e.preventDefault();
    const leadId = e.dataTransfer.getData('text/plain');
    if (leadId) {
      onStageChange(leadId, newStage);
    }
  }

  const STAGE_COLOR_BG: Record<string, string> = {
    fresh: 'border-blue-500/20',
    qualified: 'border-amber-500/20',
    followUp: 'border-purple-500/20',
    reservation: 'border-emerald-500/20',
    lost: 'border-slate-500/20',
  };

  return (
    <div>
      {canManage && (
        <div className="flex justify-end mb-2">
          <button
            onClick={() => setSelectMode((m) => !m)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
              selectMode
                ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white'
            }`}
          >
            {selectMode ? <CheckSquare size={11} /> : <Square size={11} />}
            {selectMode ? 'Selecting…' : 'Select leads'}
            {selectMode && (
              <span
                role="button"
                aria-label="Exit select mode"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectMode(false);
                }}
                className="ms-1 p-0.5 hover:bg-white/10 rounded"
              >
                <X size={10} />
              </span>
            )}
          </button>
        </div>
      )}

      <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {LEAD_STAGE_COLUMNS.map((col) => {
          const columnLeads = grouped[col.id] ?? [];
          return (
            <div
              key={col.id}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.id)}
              className={`flex-1 min-w-[260px] bg-card card-border ${STAGE_COLOR_BG[col.id] ?? ''} rounded-2xl p-2 flex flex-col`}
            >
              <div className="px-2 py-2 mb-1 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: `var(--c-${col.color}, #6B7280)` }}
                  />
                  <h3 className="text-white text-xs font-semibold uppercase tracking-wider">
                    {col.label}
                  </h3>
                </div>
                <span className="text-slate-500 text-[10px] font-medium px-1.5 py-0.5 bg-white/5 rounded-md">
                  {columnLeads.length}
                </span>
              </div>
              <div className="space-y-2 flex-1 overflow-y-auto max-h-[calc(100vh-280px)] min-h-[120px] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {columnLeads.length === 0 ? (
                  <div className="text-center py-6 text-slate-600 text-[10px]">
                    Drop leads here
                  </div>
                ) : (
                  columnLeads.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      tags={tagsByLeadId[lead.id] ?? []}
                      onClick={() => {
                        if (selectMode) {
                          onToggleSelect(lead.id);
                        } else {
                          onCardClick(lead);
                        }
                      }}
                      draggable={canManage && !selectMode}
                      onDragStart={(e) => handleDragStart(e, lead.id)}
                      selectable={selectMode}
                      selected={selectedIds.has(lead.id)}
                      onToggleSelect={() => onToggleSelect(lead.id)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}