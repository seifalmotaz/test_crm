import { useState } from 'react';
import { X, UserCheck, Trash2, Download, Upload, ChevronDown } from 'lucide-react';

interface Agent {
  id: string;
  name: string;
}

interface BulkActionsBarProps {
  selectedIds: string[];
  agents: Agent[];
  onClear: () => void;
  onAssign: (agentId: string | null) => Promise<void> | void;
  onImport?: () => void;
  onExport?: () => void;
  busy?: boolean;
  canManage: boolean;
}

export default function BulkActionsBar({
  selectedIds,
  agents,
  onClear,
  onAssign,
  onImport,
  onExport,
  busy,
  canManage,
}: BulkActionsBarProps) {
  const [assignOpen, setAssignOpen] = useState(false);

  if (selectedIds.length === 0) {
    if (!onImport && !onExport) return null;
    return (
      <div className="flex items-center gap-2 mb-3">
        {onImport && canManage && (
          <button
            onClick={onImport}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[10px] text-slate-300 hover:text-white hover:bg-white/10 transition-all"
          >
            <Upload size={11} /> Import
          </button>
        )}
        {onExport && (
          <button
            onClick={onExport}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[10px] text-slate-300 hover:text-white hover:bg-white/10 transition-all"
          >
            <Download size={11} /> Export
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mb-3 p-2 bg-blue-500/10 border border-blue-500/20 rounded-xl">
      <span className="text-[10px] uppercase tracking-wider text-blue-300 font-semibold px-2">
        {selectedIds.length} selected
      </span>

      <div className="relative">
        <button
          onClick={() => setAssignOpen((o) => !o)}
          disabled={busy || !canManage}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-60 rounded-lg text-[10px] text-white font-medium transition-all"
        >
          <UserCheck size={11} /> Assign to agent <ChevronDown size={10} />
        </button>
        {assignOpen && (
          <div
            className="absolute top-full left-0 mt-1 w-56 bg-slate-900 border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden"
            onMouseLeave={() => setAssignOpen(false)}
          >
            <div className="max-h-64 overflow-y-auto py-1">
              <button
                onClick={async () => {
                  setAssignOpen(false);
                  await onAssign(null);
                }}
                disabled={busy}
                className="w-full text-left px-3 py-2 text-[11px] text-slate-300 hover:bg-white/5 transition-colors"
              >
                Unassigned
              </button>
              <div className="border-t border-white/5 my-1" />
              {agents.length === 0 ? (
                <p className="px-3 py-2 text-[10px] text-slate-500">No agents available</p>
              ) : (
                agents.map((a) => (
                  <button
                    key={a.id}
                    onClick={async () => {
                      setAssignOpen(false);
                      await onAssign(a.id);
                    }}
                    disabled={busy}
                    className="w-full text-left px-3 py-2 text-[11px] text-slate-300 hover:bg-white/5 transition-colors"
                  >
                    {a.name}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <button
        onClick={onClear}
        disabled={busy}
        className="flex items-center gap-1 px-2 py-1.5 text-[10px] text-slate-400 hover:text-white transition-colors"
      >
        <X size={11} /> Clear
      </button>

      <div className="flex-1" />

      {onImport && canManage && (
        <button
          onClick={onImport}
          disabled={busy}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[10px] text-slate-300 hover:text-white hover:bg-white/10 transition-all"
        >
          <Upload size={11} /> Import
        </button>
      )}
      {onExport && (
        <button
          onClick={onExport}
          disabled={busy}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[10px] text-slate-300 hover:text-white hover:bg-white/10 transition-all"
        >
          <Download size={11} /> Export
        </button>
      )}
    </div>
  );
}