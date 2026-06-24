import { AlertTriangle } from 'lucide-react';
import { fmtCents } from '../../lib/format';
import type { DealWithCommission } from '../../api/commissions';

interface DealKanbanCardProps {
  deal: DealWithCommission;
  onClick: () => void;
}

const riskColors: Record<string, string> = {
  low: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
  medium: 'text-amber-400 bg-amber-500/10 border-amber-500/25',
  high: 'text-red-400 bg-red-500/10 border-red-500/25',
};

const riskLabels: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

function ProbabilityRing({ value }: { value: number }) {
  const color =
    value >= 85 ? '#10b981' : value >= 70 ? '#3b82f6' : value >= 55 ? '#f59e0b' : '#ef4444';
  const r = 14;
  const circ = 2 * Math.PI * r;
  return (
    <div className="relative w-9 h-9 flex-shrink-0">
      <svg width="36" height="36" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeDasharray={`${(value / 100) * circ} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 18 18)"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold" style={{ color }}>
        {value}%
      </span>
    </div>
  );
}

const STAGE_ORDER = ['initialContact', 'negotiation', 'contractPending', 'closedWon', 'closedLost'] as const;

function ProgressDots({ stage }: { stage: string }) {
  const idx = STAGE_ORDER.indexOf(stage as typeof STAGE_ORDER[number]);
  return (
    <div className="flex items-center gap-1">
      {STAGE_ORDER.map((s, i) => (
        <div
          key={s}
          className={`w-1.5 h-1.5 rounded-full ${i <= idx ? 'bg-blue-500' : 'bg-white/10'}`}
        />
      ))}
    </div>
  );
}

export default function DealKanbanCard({ deal, onClick }: DealKanbanCardProps) {
  const risk = deal.risk || 'low';
  const riskLabel = riskLabels[risk] || 'Low';
  const daysUntilClose = deal.daysUntilClose ?? 999;
  const probability = deal.probability ?? 50;
  const commission = deal.resolvedCommission?.calculated ?? null;
  const propertyTitle = deal.property?.title ?? deal.id.slice(0, 8);
  const agentName = deal.agent?.name ?? 'Agent';

  return (
    <div
      onClick={onClick}
      className={`bg-card rounded-xl border cursor-pointer transition-all hover:shadow-lg hover:shadow-blue-500/5 group p-3 ${
        risk === 'high' ? 'border-red-500/30 hover:border-red-500/50' : 'card-border hover:border-blue-500/30'
      }`}
    >
      {/* Top row: property + probability ring */}
      <div className="flex items-start gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-white text-xs font-semibold leading-tight truncate">
            {propertyTitle}
          </p>
          <p className="text-slate-500 text-[10px] truncate">
            {agentName}
          </p>
        </div>
        <ProbabilityRing value={probability} />
      </div>

      {/* Value + risk badge */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-white font-bold text-sm">{fmtCents(deal.value)}</p>
        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full border ${riskColors[risk]}`}>
          {riskLabel}
        </span>
      </div>

      {/* Agent + days */}
      <div className="flex items-center justify-between text-[10px] text-slate-500 mb-2">
        <span>
          Agent: <span className="text-slate-300">{agentName.split(' ')[0] || '—'}</span>
        </span>
        <span className={daysUntilClose <= 7 ? 'text-amber-400 font-medium' : ''}>
          {daysUntilClose >= 0 ? `${daysUntilClose}d left` : '—'}
        </span>
      </div>

      {/* Progress dots */}
      <div className="mb-2">
        <ProgressDots stage={deal.stage} />
      </div>

      {/* Commission forecast */}
      <div className="flex items-center justify-between text-[10px]">
        {commission !== null ? (
          <span className="text-emerald-400 font-medium">
            comm: {fmtCents(commission)}
          </span>
        ) : (
          <span className="text-slate-600" title="No commission plan configured">
            comm: —
          </span>
        )}
        {risk === 'high' && (
          <div className="flex items-center gap-0.5 text-red-400">
            <AlertTriangle size={10} />
            <span className="font-medium">Action</span>
          </div>
        )}
      </div>
    </div>
  );
}
