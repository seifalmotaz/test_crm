import { useState, useMemo } from 'react';
import { Search, AlertTriangle, Loader2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dealsControllerFindAll } from '../../api/sdk.gen';
import type { DealWithCommission } from '../../api/commissions';
import DealPipelineHeader from '../../components/deals/DealPipelineHeader';
import DealKanbanColumn from '../../components/deals/DealKanbanColumn';
import CommissionPanel from '../../components/deals/CommissionPanel';
import ClosingSoonPanel from '../../components/deals/ClosingSoonPanel';
import PipelineByAgentPanel from '../../components/deals/PipelineByAgentPanel';
import DealDrawer from '../../components/deals/DealDrawer';

const STAGES = [
  { key: 'initialContact', label: 'Initial Contact', headerBg: 'bg-slate-500/10 text-slate-300', borderColor: 'border-slate-500/30' },
  { key: 'negotiation', label: 'Negotiation', headerBg: 'bg-amber-500/10 text-amber-300', borderColor: 'border-amber-500/30' },
  { key: 'contractPending', label: 'Contract Pending', headerBg: 'bg-blue-500/10 text-blue-300', borderColor: 'border-blue-500/30' },
  { key: 'closedWon', label: 'Closed Won', headerBg: 'bg-emerald-500/10 text-emerald-300', borderColor: 'border-emerald-500/30' },
  { key: 'closedLost', label: 'Closed Lost', headerBg: 'bg-red-500/10 text-red-300', borderColor: 'border-red-500/30' },
];

const STAGE_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'initialContact', label: 'Initial Contact' },
  { key: 'negotiation', label: 'Negotiation' },
  { key: 'contractPending', label: 'Contract Pending' },
  { key: 'closedWon', label: 'Closed Won' },
  { key: 'closedLost', label: 'Closed Lost' },
];

export default function DealsPage() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [selectedDeal, setSelectedDeal] = useState<DealWithCommission | null>(null);

  // Fetch deals
  const dealsQuery = useQuery({
    queryKey: ['deals', stageFilter],
    queryFn: async () => {
      const { data, error } = await dealsControllerFindAll({
        query: {
          stage: stageFilter !== 'all' ? (stageFilter as any) : undefined,
          limit: 100,
        },
      });
      if (error) throw error;
      return data!;
    },
  });

  // Deals are now enriched by the backend (property, agent, risk, daysUntilClose, daysElapsed)
  const deals = (dealsQuery.data?.data || []) as DealWithCommission[];

  // Search filter
  const filtered = useMemo(() => {
    if (!search.trim()) return deals;
    const q = search.toLowerCase();
    return deals.filter((d) => {
      const property = (d.property?.title ?? '').toLowerCase();
      const agentName = (d.agent?.name ?? '').toLowerCase();
      return property.includes(q) || agentName.includes(q);
    });
  }, [deals, search]);

  // Computed values
  const atRiskDeals = deals.filter((d) => d.risk === 'high');
  const closingThisWeek = deals.filter((d) => {
    const duc = d.daysUntilClose;
    return duc !== null && duc !== undefined && duc >= 0 && duc <= 7;
  });
  const totalValue = deals.reduce((s, d) => s + (d.value || 0), 0);
  const commissionPending = deals
    .filter((d) => d.stage !== 'closedWon' && d.stage !== 'closedLost')
    .reduce((s, d) => s + (d.resolvedCommission?.calculated ?? 0), 0);
  const commissionThisMonth = closingThisWeek.reduce(
    (s, d) => s + (d.resolvedCommission?.calculated ?? 0),
    0,
  );
  const avgDaysToClose = (() => {
    const withDays = deals.filter((d) => d.daysElapsed != null);
    if (withDays.length === 0) return 0;
    return Math.round(withDays.reduce((s, d) => s + (d.daysElapsed ?? 0), 0) / withDays.length);
  })();

  // Commission forecast for sidebar
  const commissionForecast = useMemo(() => {
    const activeDeals = deals.filter((d) => d.stage !== 'closedWon' && d.stage !== 'closedLost');
    const pending = activeDeals.reduce((s, d) => s + (d.resolvedCommission?.calculated ?? 0), 0);
    const closingSoon = closingThisWeek.reduce(
      (s, d) => s + (d.resolvedCommission?.calculated ?? 0),
      0,
    );
    const byStage = STAGES.map((st) => ({
      stage: st.label,
      value: activeDeals
        .filter((d) => d.stage === st.key)
        .reduce((s, d) => s + (d.resolvedCommission?.calculated ?? 0), 0),
    }));
    const totalPossible = deals.reduce((s, d) => s + (d.resolvedCommission?.calculated ?? 0), 0);
    const confidence = totalPossible > 0
      ? Math.round((closingSoon / totalPossible) * 100)
      : 0;

    return { pending, closingSoon, byStage, confidence };
  }, [deals, closingThisWeek]);

  // Pipeline by agent
  const pipelineByAgent = useMemo(() => {
    const agentMap2 = new Map<string, { name: string; dealCount: number; totalValue: number }>();
    for (const d of deals) {
      const name = d.agent?.name || 'Unknown';
      const existing = agentMap2.get(name) || { name, dealCount: 0, totalValue: 0 };
      existing.dealCount++;
      existing.totalValue += d.value || 0;
      agentMap2.set(name, existing);
    }
    return Array.from(agentMap2.values())
      .sort((a, b) => b.dealCount - a.dealCount)
      .slice(0, 4);
  }, [deals]);

  // Loading state
  if (dealsQuery.isLoading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="flex items-center justify-center py-40">
          <Loader2 size={32} className="text-blue-400 animate-spin" />
        </div>
      </div>
    );
  }

  // Error state
  if (dealsQuery.error) {
    return (
      <div className="p-4 sm:p-6">
        <div className="flex flex-col items-center justify-center py-20 bg-card card-border rounded-2xl">
          <p className="text-white font-semibold mb-1">Failed to load deals</p>
          <p className="text-slate-400 text-xs">
            {(dealsQuery.error as any)?.detail ||
              (dealsQuery.error as any)?.message ||
              'An unexpected error occurred'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-white text-xl font-bold tracking-tight">Deals</h1>
          <p className="text-slate-400 text-sm mt-0.5">Manage your sales pipeline</p>
        </div>
      </div>

      {/* Pipeline Header */}
      <DealPipelineHeader
        totalDeals={deals.length}
        totalValue={totalValue}
        closingThisWeek={closingThisWeek.length}
        closingThisWeekValue={closingThisWeek.reduce((s, d) => s + (d.value || 0), 0)}
        atRisk={atRiskDeals.length}
        commissionPending={commissionPending}
        commissionThisMonth={commissionThisMonth}
        avgDaysToClose={avgDaysToClose}
      />

      {/* At-risk banner */}
      {atRiskDeals.length > 0 && (
        <div className="mb-4 bg-red-500/10 border border-red-500/25 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-red-300 text-sm font-semibold mb-1">
              {atRiskDeals.length} deal{atRiskDeals.length !== 1 ? 's' : ''} need attention
            </p>
            <div className="flex flex-wrap gap-2">
              {atRiskDeals.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setSelectedDeal(d)}
                  className="text-xs text-red-300 bg-red-500/15 border border-red-500/25 px-2.5 py-1 rounded-lg hover:bg-red-500/25 transition-all"
                >
                  {d.property?.title ?? 'Deal'} · {d.daysUntilClose ?? '?'}d left
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Search + Stage filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by property or agent..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-all"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {STAGE_FILTERS.map((sf) => (
            <button
              key={sf.key}
              onClick={() => setStageFilter(sf.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                stageFilter === sf.key
                  ? sf.key === 'all'
                    ? 'bg-blue-500 text-white'
                    : sf.key === 'closedWon'
                    ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                    : sf.key === 'closedLost'
                    ? 'bg-red-500/20 border border-red-500/40 text-red-300'
                    : 'bg-blue-500/20 border border-blue-500/40 text-blue-300'
                  : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/8'
              }`}
            >
              {sf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main grid: Kanban + Sidebar */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Kanban columns */}
        <div className="flex-1 min-w-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 bg-card card-border rounded-2xl">
              <p className="text-slate-400 text-sm mb-1">No deals found</p>
              <p className="text-slate-500 text-xs">
                {search
                  ? 'Try adjusting your search query.'
                  : 'No deals match the selected filter.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto pb-2 -mx-1 px-1">
              <div className="grid grid-cols-5 gap-3 min-w-[700px]">
                {STAGES.map((stage) => {
                  const stageDeals = filtered.filter((d) => d.stage === stage.key);
                  return (
                    <DealKanbanColumn
                      key={stage.key}
                      stage={stage}
                      deals={stageDeals}
                      onSelect={(deal) => setSelectedDeal(deal)}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-64 lg:flex-shrink-0 space-y-4">
          <CommissionPanel forecast={commissionForecast} />
          <ClosingSoonPanel
            deals={closingThisWeek}
            onSelect={(deal) => setSelectedDeal(deal)}
          />
          <PipelineByAgentPanel agents={pipelineByAgent} />
        </div>
      </div>

      {/* Deal Drawer */}
      {selectedDeal && (
        <DealDrawer
          deal={selectedDeal}
          onClose={() => setSelectedDeal(null)}
          onDealUpdated={() => {
            queryClient.invalidateQueries({ queryKey: ['deals'] });
          }}
        />
      )}
    </div>
  );
}
