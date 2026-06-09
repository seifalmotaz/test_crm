import { CheckCircle } from 'lucide-react';
import type { LeadResponseDto } from '../../api/types.gen';

interface ConvertLeadModalProps {
  lead: LeadResponseDto;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

export default function ConvertLeadModal({ lead, onClose, onConfirm, isLoading }: ConvertLeadModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-card card-border rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
            <CheckCircle size={20} className="text-amber-400" />
          </div>
          <div>
            <h2 className="text-white text-sm font-semibold">Convert lead to client</h2>
            <p className="text-slate-400 text-xs">{lead.name}</p>
          </div>
        </div>

        <p className="text-slate-300 text-xs leading-relaxed mb-4">
          This will mark the lead as <span className="text-amber-300 font-medium">converted</span>.
          The lead will remain in the system with full history — it will be flagged as a client
          that an Agent is working with on a transaction.
        </p>
        <p className="text-slate-500 text-[10px] leading-relaxed mb-6">
          This action can be used to indicate that a lead is ready to move into a deal.
        </p>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-xs text-slate-400 hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 bg-amber-500 text-white text-xs font-medium rounded-xl hover:bg-amber-600 disabled:opacity-50 transition-all"
          >
            {isLoading ? 'Converting…' : 'Convert lead'}
          </button>
        </div>
      </div>
    </div>
  );
}
