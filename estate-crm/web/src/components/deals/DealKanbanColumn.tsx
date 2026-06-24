import { fmtCents } from '../../lib/format';
import DealKanbanCard from './DealKanbanCard';
import type { DealWithCommission } from '../../api/commissions';

interface DealKanbanColumnProps {
  stage: {
    key: string;
    label: string;
    headerBg: string;
    borderColor: string;
  };
  deals: DealWithCommission[];
  onSelect: (deal: DealWithCommission) => void;
}

export default function DealKanbanColumn({ stage, deals, onSelect }: DealKanbanColumnProps) {
  const totalValue = deals.reduce((s, d) => s + (d.value || 0), 0);

  return (
    <div className={`flex flex-col min-h-64 rounded-2xl border ${stage.borderColor} bg-white/2`}>
      {/* Header */}
      <div className={`rounded-t-2xl px-3 py-2.5 ${stage.headerBg}`}>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold">{stage.label}</p>
          <span className="bg-black/20 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
            {deals.length}
          </span>
        </div>
        <p className="text-[10px] opacity-70 mt-0.5">{fmtCents(totalValue)}</p>
      </div>

      {/* Cards */}
      <div className="flex-1 p-2 space-y-2">
        {deals.length === 0 ? (
          <div className="flex items-center justify-center h-16 text-slate-600 text-[10px]">
            No deals
          </div>
        ) : (
          deals.map((deal) => (
            <DealKanbanCard key={deal.id} deal={deal} onClick={() => onSelect(deal)} />
          ))
        )}
      </div>
    </div>
  );
}
