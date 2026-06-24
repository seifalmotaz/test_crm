import { CheckCircle } from 'lucide-react';
import { fmtCents } from '../../lib/format';
import type { DealWithCommission } from '../../api/commissions';

interface ClosingSoonPanelProps {
  deals: DealWithCommission[];
  onSelect: (deal: DealWithCommission) => void;
}

export default function ClosingSoonPanel({ deals, onSelect }: ClosingSoonPanelProps) {
  return (
    <div className="bg-card card-border rounded-2xl p-4 glow-blue">
      <p className="text-white font-semibold text-xs mb-3 flex items-center gap-2">
        <CheckCircle size={13} className="text-emerald-400" />
        Closing This Week
      </p>
      <div className="space-y-2">
        {deals.length === 0 ? (
          <p className="text-slate-500 text-xs">No deals closing this week</p>
        ) : (
          deals.map((d) => {
            const daysLeft = d.daysUntilClose ?? 0;
            return (
              <div
                key={d.id}
                onClick={() => onSelect(d)}
                className="flex items-center gap-2 p-2.5 bg-white/4 border border-white/8 rounded-xl cursor-pointer hover:bg-white/8 transition-all"
              >
                <div className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-300 text-[9px] font-bold flex-shrink-0">
                  {d.property?.title?.charAt(0) || 'D'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-[10px] font-medium truncate">
                    {d.property?.title || 'Deal'}
                  </p>
                  <p className="text-emerald-400 text-[9px]">
                    {daysLeft === 0 ? 'Today' : `${daysLeft}d`} · {fmtCents(d.value)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
