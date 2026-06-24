import { useState, useMemo, useCallback } from 'react';
import { Plus, Loader2, Kanban, List, CheckCircle, AlertCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import {
  useLeads,
  useCreateLead,
  useUpdateLead,
  useDeleteLead,
  useChangeLeadStage,
  useConvertLead,
} from '../../hooks/useLeads';
import {
  usersControllerFindAll,
  leadsControllerChangeStage,
  leadsControllerFindTags,
  leadsControllerBulkAssign,
  leadsControllerCreate,
} from '../../api/sdk.gen';
import { useQuery, useMutation } from '@tanstack/react-query';
import type {
  LeadResponseDto,
  CreateLeadDto,
  UpdateLeadDto,
  ChangeLeadStageDto,
} from '../../api/types.gen';
import type { LeadFilters, LeadViewMode } from '../../types/leads';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import LeadFiltersBar from '../../components/leads/LeadFilters';
import LeadKanban from '../../components/leads/LeadKanban';
import LeadListView from '../../components/leads/LeadListView';
import LeadDrawer from '../../components/leads/LeadDrawer';
import AddLeadModal from '../../components/leads/AddLeadModal';
import ConvertLeadModal from '../../components/leads/ConvertLeadModal';
import BulkActionsBar from '../../components/leads/BulkActionsBar';
import ImportLeadsModal from '../../components/leads/ImportLeadsModal';
import { exportLeadsAsCsv, exportLeadsAsXls, downloadBlob } from '../../lib/leads-io';

function toLeadView(dto: LeadResponseDto): LeadResponseDto {
  return dto;
}

export default function LeadsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canManage = ['admin', 'manager'].includes(user?.role || '');

  const [viewMode, setViewMode] = useState<LeadViewMode>('kanban');
  const [selectedLead, setSelectedLead] = useState<LeadResponseDto | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [filters, setFilters] = useState<LeadFilters>({
    search: '',
    stage: 'all',
    source: undefined,
    type: undefined,
    isDnc: undefined,
    isConverted: undefined,
    page: 1,
    limit: 100,
  });

  const debouncedSearch = useDebouncedValue(filters.search, 350);
  const effectiveFilters = useMemo<LeadFilters>(
    () => ({ ...filters, search: debouncedSearch ?? '' }),
    [filters, debouncedSearch],
  );

  const { data: leadsData, isLoading, error, refetch } = useLeads(effectiveFilters);

  // Fetch agents for assignment dropdown
  const { data: agentsData } = useQuery({
    queryKey: ['agents-for-leads'],
    queryFn: async () => {
      const { data } = await usersControllerFindAll({
        query: { role: 'agent', limit: 100 },
      });
      return data;
    },
  });

  const leads = useMemo<LeadResponseDto[]>(() => {
    return (leadsData?.data || []).map(toLeadView);
  }, [leadsData]);

  const agents = useMemo(() => {
    return (agentsData?.data || []).map((u: any) => ({
      id: u.id,
      name: u.name,
    }));
  }, [agentsData]);

  const createMutation = useCreateLead();
  const selectedId = selectedLead?.id || '';
  const updateMutation = useUpdateLead(selectedId);
  const deleteMutation = useDeleteLead(selectedId);
  const changeStageMutation = useChangeLeadStage(selectedId);
  const convertMutation = useConvertLead(selectedId);

  // Bulk assign mutation
  const bulkAssignMutation = useMutation({
    mutationFn: async ({ leadIds, agentId }: { leadIds: string[]; agentId: string | null }) => {
      const { data } = await leadsControllerBulkAssign({
        body: { leadIds, agentId: agentId ?? null },
      });
      return data as { assigned: number; failed: number; failedIds?: string[]; agentId?: string | null };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });

  // Load tags for all leads in a single query per lead (only when kanban is active)
  const { data: tagsByLeadId } = useQuery<Record<string, any[]>>({
    queryKey: ['lead-tags-batch', leads.slice(0, 50).map((l) => l.id).join(',')],
    queryFn: async () => {
      const result: Record<string, any[]> = {};
      const results = await Promise.all(
        leads.slice(0, 50).map(async (lead) => {
          try {
            const { data } = await leadsControllerFindTags({ path: { id: lead.id } });
            return { id: lead.id, tags: data ?? [] };
          } catch {
            return { id: lead.id, tags: [] };
          }
        }),
      );
      for (const r of results) {
        result[r.id] = r.tags;
      }
      return result;
    },
    enabled: viewMode === 'kanban' && leads.length > 0,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

  const tagsMap: Record<string, any[]> = tagsByLeadId ?? {};

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const isOwner = selectedLead?.agentId === user?.id;
  const canConvert = selectedLead ? (canManage || (isOwner && !!selectedLead.agentId)) : false;

  // Note: we intentionally do NOT auto-prune selections across filter changes.
  // Selected IDs that fall off the current page are kept in state until the
  // user clicks "Clear" — this lets an admin bulk-assign a selection that
  // spans multiple filter pages.

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll(ids: string[]) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (ids.length === 0) {
        // Deselect all on this page
        for (const id of ids) next.delete(id);
      }
      for (const id of ids) next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function handleBulkAssign(agentId: string | null) {
    if (selectedIds.size === 0) return;
    try {
      const result = await bulkAssignMutation.mutateAsync({
        leadIds: Array.from(selectedIds),
        agentId,
      });
      const target = agentId
        ? agents.find((a) => a.id === agentId)?.name ?? 'agent'
        : 'unassigned';
      if (result.failed > 0 && result.failedIds?.length) {
        showToast(
          `Assigned ${result.assigned} leads to ${target} (${result.failed} failed)`,
          result.failed > 0 ? 'error' : 'success',
        );
      } else {
        showToast(`Assigned ${result.assigned} leads to ${target}`);
      }
      clearSelection();
    } catch (err: any) {
      showToast(err?.detail || err?.message || 'Failed to assign leads', 'error');
    }
  }

  function exportLeads(format: 'csv' | 'xls') {
    if (leads.length === 0) {
      showToast('No leads to export', 'error');
      return;
    }
    const blob = format === 'csv' ? exportLeadsAsCsv(leads) : exportLeadsAsXls(leads);
    const ext = format === 'csv' ? 'csv' : 'xls';
    const stamp = new Date().toISOString().slice(0, 10);
    downloadBlob(`leads-${stamp}.${ext}`, blob);
  }

  async function performImport(rowsData: CreateLeadDto[]) {
    // Sequential POST per row — fine for ≤200 rows.
    let created = 0;
    let failed = 0;
    for (const dto of rowsData) {
      try {
        await leadsControllerCreate({ body: dto });
        created++;
      } catch (err) {
        failed++;
      }
    }
    queryClient.invalidateQueries({ queryKey: ['leads'] });
    return { created, failed };
  }

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="flex items-center justify-center py-40">
          <Loader2 size={32} className="text-blue-400 animate-spin" />
        </div>
      </div>
    );
  }

  // Inline error (don't unmount filters)
  const errorMessage = error
    ? (error as any)?.detail ||
      (error as any)?.message ||
      (error as any)?.body?.detail ||
      'An unexpected error occurred'
    : null;

  return (
    <div className="p-4 sm:p-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-white text-xl font-bold tracking-tight">Leads</h1>
          <p className="text-slate-400 text-sm mt-0.5">Manage your sales pipeline</p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 rounded-xl text-xs font-medium text-white hover:bg-blue-600 transition-all"
            >
              <Plus size={13} /> Add Lead
            </button>
          )}
        </div>
      </div>

      {/* Inline error */}
      {errorMessage && (
        <div className="mb-4 flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-2xl">
          <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-red-300 text-xs font-semibold">Failed to load leads</p>
            <p className="text-red-300/80 text-xs mt-0.5 break-words">{errorMessage}</p>
          </div>
          <button
            onClick={() => refetch()}
            className="text-[10px] uppercase tracking-wider font-semibold text-red-300 hover:text-white px-2 py-1 rounded-md bg-red-500/15 hover:bg-red-500/25 transition-all"
          >
            Retry
          </button>
        </div>
      )}

      {/* Bulk action bar (also shows Import/Export even with empty selection) */}
      <BulkActionsBar
        selectedIds={Array.from(selectedIds)}
        agents={agents}
        onClear={clearSelection}
        onAssign={handleBulkAssign}
        onImport={canManage ? () => setShowImportModal(true) : undefined}
        onExport={() => exportLeads('csv')}
        busy={bulkAssignMutation.isPending}
        canManage={canManage}
      />

      {/* Filters + View Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 mb-4">
        <div className="flex-1">
          <LeadFiltersBar
            filters={filters}
            onChange={setFilters}
            resultCount={leads.length}
          />
        </div>
        <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-0.5 flex-shrink-0">
          <button
            onClick={() => setViewMode('kanban')}
            className={`p-1.5 rounded-lg transition-all ${
              viewMode === 'kanban'
                ? 'bg-blue-500/20 text-blue-400'
                : 'text-slate-500 hover:text-slate-300'
            }`}
            aria-label="Kanban view"
          >
            <Kanban size={14} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-lg transition-all ${
              viewMode === 'list'
                ? 'bg-blue-500/20 text-blue-400'
                : 'text-slate-500 hover:text-slate-300'
            }`}
            aria-label="List view"
          >
            <List size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      {leads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-card card-border rounded-2xl">
          <p className="text-slate-400 text-sm mb-1">No leads found</p>
          <p className="text-slate-500 text-xs mb-4">
            Try adjusting your filters or add a new lead.
          </p>
          {(filters.search || (filters.stage && filters.stage !== 'all') || filters.source || filters.type) && (
            <button
              onClick={() =>
                setFilters({
                  search: '',
                  stage: 'all',
                  source: undefined,
                  type: undefined,
                  page: 1,
                  limit: 100,
                })
              }
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-slate-400 hover:text-white transition-all"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : viewMode === 'kanban' ? (
        <LeadKanban
          leads={leads}
          tagsByLeadId={tagsMap}
          onCardClick={(lead) => setSelectedLead(lead)}
          onStageChange={async (leadId, newStage) => {
            try {
              await leadsControllerChangeStage({
                path: { id: leadId },
                body: { stage: newStage as any },
              });
              queryClient.invalidateQueries({ queryKey: ['leads'] });
              showToast(`Moved to ${newStage}`);
            } catch (err: any) {
              showToast(err?.detail || 'Failed to move lead', 'error');
            }
          }}
          canManage={canManage}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
        />
      ) : (
        <LeadListView
          leads={leads}
          onRowClick={(lead) => setSelectedLead(lead)}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
        />
      )}

      {/* Drawer */}
      {selectedLead && (
        <LeadDrawer
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdate={async (data: UpdateLeadDto) => {
            return new Promise<void>((resolve, reject) => {
              updateMutation.mutate(data, {
                onSuccess: () => {
                  showToast('Lead updated');
                  resolve();
                },
                onError: (err: any) => {
                  showToast(err?.detail || 'Failed to update', 'error');
                  reject(err);
                },
              });
            });
          }}
          onDelete={
            canManage
              ? () => {
                  deleteMutation.mutate(undefined, {
                    onSuccess: () => {
                      showToast('Lead deleted');
                      setSelectedLead(null);
                    },
                    onError: (err: any) => showToast(err?.detail || 'Failed to delete', 'error'),
                  });
                }
              : undefined
          }
          onChangeStage={(dto: ChangeLeadStageDto) => {
            changeStageMutation.mutate(dto, {
              onSuccess: () => showToast(`Stage → ${dto.stage}`),
              onError: (err: any) => showToast(err?.detail || 'Failed to change stage', 'error'),
            });
          }}
          onConvert={() => setShowConvertModal(true)}
          canManage={canManage}
          canConvert={canConvert}
          isOwner={isOwner}
        />
      )}

      {/* Add Lead Modal */}
      {showAddModal && (
        <AddLeadModal
          onClose={() => setShowAddModal(false)}
          onSaved={async (formData: CreateLeadDto) => {
            return new Promise<void>((resolve, reject) => {
              createMutation.mutate(formData, {
                onSuccess: () => {
                  showToast('Lead created');
                  setShowAddModal(false);
                  resolve();
                },
                onError: (err: any) => {
                  showToast(err?.detail || 'Failed to create lead', 'error');
                  reject(err);
                },
              });
            });
          }}
          agents={agents}
        />
      )}

      {/* Convert Modal */}
      {showConvertModal && selectedLead && (
        <ConvertLeadModal
          lead={selectedLead}
          onClose={() => setShowConvertModal(false)}
          onConfirm={() => {
            convertMutation.mutate(undefined, {
              onSuccess: () => {
                showToast('Lead converted to client');
                setShowConvertModal(false);
              },
              onError: (err: any) => showToast(err?.detail || 'Failed to convert', 'error'),
            });
          }}
          isLoading={convertMutation.isPending}
        />
      )}

      {/* Import Modal */}
      {showImportModal && (
        <ImportLeadsModal
          onClose={() => setShowImportModal(false)}
          onConfirm={performImport}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 text-xs font-medium px-4 py-3 rounded-2xl shadow-lg ${
            toast.type === 'success'
              ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/15 border border-red-500/30 text-red-300'
          }`}
        >
          <CheckCircle size={14} />
          {toast.msg}
        </div>
      )}
    </div>
  );
}