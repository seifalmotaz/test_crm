import { useMemo, useState } from 'react';
import { ArrowUpDown, ChevronRight } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';

function fmt(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  return `$${(v / 1000).toFixed(0)}K`;
}

const stageColors: Record<string, string> = {
  Closing: 'bg-blue-500/15 text-blue-400',
  Inspection: 'bg-amber-500/15 text-amber-400',
  'Due Diligence': 'bg-purple-500/15 text-purple-400',
  Negotiation: 'bg-emerald-500/15 text-emerald-400',
  'Offer Sent': 'bg-slate-500/15 text-slate-400',
};

function Spark({ trend }: { trend: 'up' | 'down' }) {
  return (
    <svg width="60" height="24" viewBox="0 0 60 24">
      {trend === 'up' ? (
        <polyline points="0,20 12,14 24,16 36,8 48,6 60,2" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <polyline points="0,4 12,8 24,6 36,14 48,16 60,20" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

interface Deal {
  id: string | number;
  property: string;
  type?: string;
  agent: string;
  listPrice: number;
  stage: string;
  changePct: number;
  volume?: string;
  sparkTrend: 'up' | 'down';
  closingInDays?: number;
}

type TabKey = 'all' | 'closing_soon' | 'at_risk';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'closing_soon', label: 'Closing Soon' },
  { key: 'at_risk', label: 'At Risk' },
];

export default function DealsTable({ deals }: { deals: Deal[] }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const cols = ['Property', 'Agent', 'List Price', 'Stage', 'Change', 'Volume', 'Last 7d'];

  const filtered = useMemo(() => {
    if (activeTab === 'all') return deals;
    if (activeTab === 'closing_soon') {
      return deals.filter((d) => d.closingInDays !== undefined && d.closingInDays <= 7 && d.closingInDays >= 0);
    }
    // at_risk: negative change or in Due Diligence with negative trend
    return deals.filter((d) => d.changePct < 0 || (d.stage === 'Due Diligence' && d.sparkTrend === 'down'));
  }, [deals, activeTab]);

  return (
    <div className="bg-card card-border rounded-2xl p-5 glow-blue">
      <div className="flex items-center justify-between mb-4">
        <p className="text-white font-semibold text-sm">Active Deals</p>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                aria-pressed={activeTab === t.key}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === t.key
                    ? 'bg-blue-500 text-white'
                    : 'text-slate-400 border border-white/10 hover:text-white hover:bg-white/5'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => navigate({ to: '/deals' })}
            className="flex items-center gap-1 text-blue-400 text-xs hover:text-white transition-colors"
          >
            All <ChevronRight size={13} />
          </button>
        </div>
      </div>
      {filtered.length === 0 ? (
        <p className="text-slate-500 text-xs py-8 text-center">No deals match this filter</p>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              {cols.map((h) => (
                <th key={h} className="text-start text-slate-500 text-xs font-medium py-2 pe-4 last:pe-0">
                  <div className="flex items-center gap-1">
                    {h}
                    {['List Price', 'Change'].includes(h) && <ArrowUpDown size={11} />}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((deal) => (
              <tr
                key={deal.id}
                onClick={() => navigate({ to: '/deals' })}
                className="border-b border-white/4 hover:bg-white/3 transition-colors group cursor-pointer"
              >
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-blue-500/20 flex items-center justify-center text-xs">🏠</div>
                    <div>
                      <p className="text-white text-xs font-medium">{deal.property}</p>
                      <p className="text-slate-500 text-[10px]">{deal.type}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3 pr-4 text-slate-300 text-xs">{deal.agent}</td>
                <td className="py-3 pr-4 text-white text-xs font-medium">{fmt(deal.listPrice)}</td>
                <td className="py-3 pr-4">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${stageColors[deal.stage] ?? 'bg-slate-500/15 text-slate-400'}`}>
                    {deal.stage}
                  </span>
                </td>
                <td className="py-3 pr-4">
                  <span className={`text-xs font-medium ${deal.changePct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {deal.changePct >= 0 ? '+' : ''}{deal.changePct}%
                  </span>
                </td>
                <td className="py-3 pr-4 text-slate-400 text-xs">{deal.volume}</td>
                <td className="py-3"><Spark trend={deal.sparkTrend} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}