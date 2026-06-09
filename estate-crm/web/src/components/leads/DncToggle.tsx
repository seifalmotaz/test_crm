import { useState } from 'react';
import { Shield, ShieldOff, X } from 'lucide-react';
import { useSetDnc } from '../../hooks/useLeads';

interface DncToggleProps {
  leadId: string;
  isDnc: boolean;
  dncReason: string | null | undefined;
  canManage: boolean;
  onUpdate?: () => void;
}

export default function DncToggle({ leadId, isDnc, dncReason, canManage, onUpdate }: DncToggleProps) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [reason, setReason] = useState('');
  const setDnc = useSetDnc(leadId);

  function handleToggle() {
    if (!canManage) return;
    if (isDnc) {
      // Direct unset
      setDnc.mutate(
        { isDnc: false },
        { onSuccess: onUpdate },
      );
    } else {
      // Show reason prompt
      setShowPrompt(true);
    }
  }

  function handleConfirmSet() {
    setDnc.mutate(
      { isDnc: true, reason: reason.trim() || undefined },
      {
        onSuccess: () => {
          setShowPrompt(false);
          setReason('');
          onUpdate?.();
        },
      },
    );
  }

  if (showPrompt) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Shield size={14} className="text-red-400" />
          <p className="text-white text-xs font-medium">Enable Do-Not-Contact</p>
        </div>
        <p className="text-slate-400 text-[10px]">Once enabled, no activities can be logged on this lead.</p>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (optional, max 500 chars)"
          maxLength={500}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-red-500/50"
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setShowPrompt(false)}
            className="px-2.5 py-1 text-[10px] text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmSet}
            disabled={setDnc.isPending}
            className="px-2.5 py-1 bg-red-500 text-white text-[10px] rounded-lg hover:bg-red-600 disabled:opacity-50"
          >
            {setDnc.isPending ? 'Enabling…' : 'Enable DNC'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-3 py-2">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {isDnc ? (
          <Shield size={14} className="text-red-400 flex-shrink-0" />
        ) : (
          <ShieldOff size={14} className="text-slate-500 flex-shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <p className={`text-xs font-medium ${isDnc ? 'text-red-300' : 'text-slate-300'}`}>
            {isDnc ? 'Do-Not-Contact' : 'No DNC flag'}
          </p>
          {isDnc && dncReason && (
            <p className="text-slate-500 text-[10px] truncate">{dncReason}</p>
          )}
        </div>
      </div>
      {canManage && (
        <button
          type="button"
          onClick={handleToggle}
          disabled={setDnc.isPending}
          className="text-[10px] font-medium text-slate-400 hover:text-white transition-colors disabled:opacity-50 flex items-center gap-1"
        >
          {isDnc ? 'Disable' : 'Enable'}
          {isDnc && <X size={10} />}
        </button>
      )}
    </div>
  );
}
