import { DollarSign, TrendingUp } from 'lucide-react';
import { fmtCents } from '../../lib/format';

interface CommissionPanelProps {
  forecast: {
    pending: number;
    closingSoon: number;
    byStage: Array<{ stage: string; value: number }>;
    confidence: number;
  };
}

const stageColors: Record<string, string> = {
  'Initial Contact': 'bg-slate-500/15 text-slate-300',
  Negotiation: 'bg-amber-500/15 text-amber-300',
  'Contract Pending': 'bg-blue-500/15 text-blue-300',
  'Closed Won': 'bg-emerald-500/15 text-emerald-300',
  'Closed Lost': 'bg-red-500/15 text-red-300',
};

export default function CommissionPanel({ forecast }: CommissionPanelProps) {
  const { pending = 0, closingSoon = 0, byStage = [], confidence = 0 } = forecast;

  return (
    <div className="bg-card card-border rounded-2xl p-5 glow-blue">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <DollarSign size={15} className="text-purple-400" />
          <p className="text-white font-semibold text-sm">Commission Forecast</p>
        </div>
        <div className="flex items-center gap-1 text-emerald-400 text-xs font-semibold">
          <TrendingUp size={12} />
          {fmtCents(closingSoon)} / 7d
        </div>
      </div>

      {/* 2-cell grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white/3 border border-white/6 rounded-xl p-3 text-center">
          <p className="text-slate-400 text-[9px] uppercase tracking-wider mb-1">Total Pending</p>
          <p className="text-white font-bold text-base">{fmtCents(pending)}</p>
          <p className="text-slate-500 text-[9px]">all active deals</p>
        </div>
        <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-xl p-3 text-center">
          <p className="text-slate-400 text-[9px] uppercase tracking-wider mb-1">Closing Soon</p>
          <p className="text-emerald-400 font-bold text-base">{fmtCents(closingSoon)}</p>
          <p className="text-slate-500 text-[9px]">within 7 days</p>
        </div>
      </div>

      {/* By-stage breakdown */}
      <div className="space-y-2">
        <p className="text-slate-500 text-[9px] uppercase tracking-wider">By Stage</p>
        {byStage.length === 0 ? (
          <p className="text-slate-600 text-xs text-center py-2">No active deals</p>
        ) : (
          byStage.map((s) => (
            <div key={s.stage} className="flex items-center justify-between">
              <span
                className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                  stageColors[s.stage] || 'bg-slate-500/15 text-slate-300'
                }`}
              >
                {s.stage}
              </span>
              <span className="text-white text-[10px] font-semibold">{fmtCents(s.value)}</span>
            </div>
          ))
        )}
      </div>

      {/* Confidence meter */}
      <div className="mt-4 pt-3 border-t border-white/5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Confidence level</span>
          <span className="text-white font-semibold">{confidence}%</span>
        </div>
        <div className="h-1.5 bg-white/5 rounded-full mt-1.5 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-blue-400 rounded-full"
            style={{ width: `${confidence}%` }}
          />
        </div>
      </div>
    </div>
  );
}
