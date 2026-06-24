import { useState } from 'react';
import {
  X,
  CheckCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Calendar,
} from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { dealsControllerChangeStage } from '../../api/sdk.gen';
import { fmtCents, fmtRate, fmtDate } from '../../lib/format';
import type { DealWithCommission } from '../../api/commissions';

interface DealDrawerProps {
  deal: DealWithCommission | null;
  onClose: () => void;
  onDealUpdated: () => void;
}

const riskBadge: Record<string, string> = {
  low: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  medium: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  high: 'bg-red-500/15 text-red-400 border-red-500/25',
};

const STAGE_ORDER = ['initialContact', 'negotiation', 'contractPending', 'closedWon', 'closedLost'] as const;

const STAGE_LABELS: Record<string, string> = {
  initialContact: 'Initial Contact',
  negotiation: 'Negotiation',
  contractPending: 'Contract Pending',
  closedWon: 'Closed Won',
  closedLost: 'Closed Lost',
};

export default function DealDrawer({ deal, onClose, onDealUpdated }: DealDrawerProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canManage = ['admin', 'manager'].includes(user?.role || '');

  const [stageError, setStageError] = useState<string | null>(null);

  const stageMutation = useMutation({
    mutationFn: async (stage: 'closedWon' | 'closedLost') => {
      const { error } = await dealsControllerChangeStage({
        path: { id: deal!.id },
        body: { stage },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['commission-records'] });
      onDealUpdated();
      onClose();
    },
    onError: (err: any) => {
      setStageError(err?.detail || err?.message || 'Failed to change stage');
    },
  });

  if (!deal) return null;

  const probability = deal.probability ?? 50;
  const daysUntilClose = deal.daysUntilClose ?? null;
  const daysElapsed = deal.daysElapsed ?? null;
  const risk = deal.risk || 'low';
  const progressPct = (() => {
    const idx = STAGE_ORDER.indexOf(deal.stage as typeof STAGE_ORDER[number]);
    if (idx < 0) return 0;
    return Math.round(((idx + 1) / STAGE_ORDER.length) * 100);
  })();

  const commission = deal.resolvedCommission;
  const propertyTitle = deal.property?.title ?? 'Deal';
  const propertyAddress = deal.property?.address ?? '—';
  const agentName = deal.agent?.name ?? 'Agent';

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-[500px] bg-navy-800 border-l border-blue-500/15 z-50 overflow-y-auto shadow-2xl">
        {/* Sticky header */}
        <div className="sticky top-0 bg-navy-800/95 backdrop-blur-sm border-b border-white/5 px-6 py-4 flex items-start justify-between">
          <div>
            <p className="text-white font-bold">{propertyTitle}</p>
            <p className="text-slate-400 text-xs">{propertyAddress}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Top KPI row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/4 border border-white/8 rounded-2xl p-4 text-center">
              <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">Deal Value</p>
              <p className="text-white text-2xl font-bold">{fmtCents(deal.value)}</p>
              <p className="text-slate-500 text-xs mt-1">
                {deal.type} · {fmtRate(deal.resolvedRate)} comm
              </p>
            </div>
            <div className="bg-white/4 border border-white/8 rounded-2xl p-4 text-center">
              <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">Close Probability</p>
              <p
                className={`text-2xl font-bold ${
                  probability >= 85
                    ? 'text-emerald-400'
                    : probability >= 70
                    ? 'text-blue-400'
                    : probability >= 55
                    ? 'text-amber-400'
                    : 'text-red-400'
                }`}
              >
                {probability}%
              </p>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${riskBadge[risk]}`}>
                {risk} risk
              </span>
            </div>
          </div>

          {/* 3-cell counters */}
          <div className="grid grid-cols-3 gap-2">
            {[
              {
                label: 'Days Left',
                value: daysUntilClose !== null ? `${daysUntilClose}d` : '—',
                urgent: daysUntilClose !== null && daysUntilClose <= 14,
                icon: Calendar,
              },
              {
                label: 'Days Elapsed',
                value: daysElapsed !== null ? `${daysElapsed}d` : '—',
                icon: Clock,
              },
              {
                label: 'Progress',
                value: `${progressPct}%`,
                icon: TrendingUp,
              },
            ].map(({ label, value, urgent, icon: Icon }) => (
              <div key={label} className="bg-white/4 border border-white/8 rounded-xl p-3 text-center">
                <Icon size={12} className={`mx-auto mb-1 ${urgent ? 'text-amber-400' : 'text-blue-400'}`} />
                <p className={`text-sm font-bold ${urgent ? 'text-amber-400' : 'text-white'}`}>{value}</p>
                <p className="text-slate-500 text-[9px]">{label}</p>
              </div>
            ))}
          </div>

          {/* 5-stage progress indicator */}
          <div>
            <div className="flex items-center justify-between mb-1.5 text-[10px]">
              <span className="text-slate-400 uppercase tracking-wider">Deal Progress</span>
              <span className="text-white font-medium">{progressPct}%</span>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-3">
              <div
                className={`h-full rounded-full transition-all ${
                  progressPct >= 80
                    ? 'bg-emerald-400'
                    : progressPct >= 50
                    ? 'bg-blue-400'
                    : 'bg-amber-400'
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="grid grid-cols-5 gap-1">
              {STAGE_ORDER.map((s, i) => {
                const currentIdx = STAGE_ORDER.indexOf(deal.stage as typeof STAGE_ORDER[number]);
                const isPassed = i <= currentIdx;
                return (
                  <div key={s} className="text-center">
                    <div
                      className={`w-4 h-4 rounded-full mx-auto mb-1 flex items-center justify-center ${
                        isPassed ? 'bg-emerald-400' : 'bg-white/8'
                      }`}
                    >
                      {isPassed && <CheckCircle size={10} className="text-white" />}
                    </div>
                    <p className="text-[8px] text-slate-600 leading-tight">{STAGE_LABELS[s]}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Commission Breakdown */}
          {commission ? (
            <div className="bg-purple-500/8 border border-purple-500/20 rounded-2xl p-4">
              <p className="text-purple-300 text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
                <DollarSign size={12} />
                Commission Breakdown
              </p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-slate-400 text-[9px] mb-1">Total Commission</p>
                  <p className="text-white font-bold text-sm">{fmtCents(commission.calculated)}</p>
                  <p className="text-slate-500 text-[9px]">{fmtRate(deal.resolvedRate)}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-[9px] mb-1">Agent Payout</p>
                  <p className="text-emerald-400 font-bold text-sm">{fmtCents(commission.agentPayout)}</p>
                  <p className="text-slate-500 text-[9px]">{agentName}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-[9px] mb-1">Brokerage Share</p>
                  <p className="text-blue-400 font-bold text-sm">{fmtCents(commission.brokerage)}</p>
                  <p className="text-slate-500 text-[9px]">brokerage</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-amber-500/8 border border-amber-500/20 rounded-2xl p-4 text-center">
              <p className="text-amber-300 text-xs font-medium">
                No commission plan configured for this deal. Contact your administrator.
              </p>
            </div>
          )}

          {/* Deal info */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-white/3 border border-white/6 rounded-xl p-3">
              <p className="text-slate-500 text-[9px] uppercase tracking-wider mb-1">Agent</p>
              <p className="text-white font-medium">{agentName}</p>
            </div>
            <div className="bg-white/3 border border-white/6 rounded-xl p-3">
              <p className="text-slate-500 text-[9px] uppercase tracking-wider mb-1">Stage</p>
              <p className="text-white font-medium">{STAGE_LABELS[deal.stage] || deal.stage}</p>
            </div>
            <div className="bg-white/3 border border-white/6 rounded-xl p-3">
              <p className="text-slate-500 text-[9px] uppercase tracking-wider mb-1">Target Close</p>
              <p className="text-white font-medium">{fmtDate(deal.targetCloseDate)}</p>
            </div>
            <div className="bg-white/3 border border-white/6 rounded-xl p-3">
              <p className="text-slate-500 text-[9px] uppercase tracking-wider mb-1">Created</p>
              <p className="text-white font-medium">{fmtDate(deal.createdAt)}</p>
            </div>
          </div>

          {/* Notes */}
          {deal.notes && (
            <div className="bg-white/3 border border-white/6 rounded-xl p-3">
              <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">Notes</p>
              <p className="text-slate-300 text-xs leading-relaxed">{deal.notes}</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="space-y-2">
            {stageError && (
              <div className="bg-red-500/10 border border-red-500/25 rounded-xl px-3 py-2 text-xs text-red-300">
                {stageError}
              </div>
            )}

            <div className="flex gap-2">
              {canManage && deal.stage !== 'closedWon' && deal.stage !== 'closedLost' && (
                <button
                  onClick={() => stageMutation.mutate('closedWon')}
                  disabled={stageMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 rounded-xl text-xs font-medium text-white hover:bg-emerald-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {stageMutation.isPending && stageMutation.variables === 'closedWon' ? (
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <CheckCircle size={13} />
                  )}
                  Mark as Won
                </button>
              )}

              {deal.stage !== 'closedWon' && deal.stage !== 'closedLost' && (
                <button
                  onClick={() => stageMutation.mutate('closedLost')}
                  disabled={stageMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/20 border border-red-500/30 rounded-xl text-xs font-medium text-red-300 hover:bg-red-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {stageMutation.isPending && stageMutation.variables === 'closedLost' ? (
                    <div className="w-3 h-3 border-2 border-red-300 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <AlertTriangle size={13} />
                  )}
                  Mark as Lost
                </button>
              )}

              {(deal.stage === 'closedWon' || deal.stage === 'closedLost') && (
                <div className="flex-1 text-center px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-slate-400">
                  Deal is {STAGE_LABELS[deal.stage] || deal.stage}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
