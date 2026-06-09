import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  leadsControllerFindAll,
  leadsControllerCreate,
  leadsControllerFindById,
  leadsControllerUpdate,
  leadsControllerRemove,
  leadsControllerChangeStage,
  leadsControllerConvert,
  leadsControllerSetDnc,
} from '@/api/sdk.gen';
import type {
  CreateLeadDto,
  UpdateLeadDto,
  ChangeLeadStageDto,
  SetDncDto,
  LeadsControllerFindAllData,
} from '@/api/types.gen';
import type { LeadFilters } from '@/types/leads';

const LEADS_QUERY_KEY = 'leads';

function buildFindAllQuery(filters?: LeadFilters): LeadsControllerFindAllData['query'] {
  if (!filters) return { limit: 100 };

  const query: LeadsControllerFindAllData['query'] = { limit: filters.limit ?? 100 };

  if (filters.search) query.search = filters.search;
  if (filters.stage && filters.stage !== 'all') {
    query.stage = filters.stage as 'fresh' | 'qualified' | 'followUp' | 'reservation' | 'lost';
  }
  if (filters.source) query.source = filters.source;
  if (filters.type) query.type = filters.type;
  if (filters.agentId) query.agentId = filters.agentId;
  if (filters.isDnc !== undefined) query.isDnc = filters.isDnc;
  if (filters.isConverted !== undefined) query.isConverted = filters.isConverted;
  if (filters.page) query.page = filters.page;
  if (filters.limit) query.limit = filters.limit;
  if (filters.sortBy) query.sortBy = filters.sortBy;
  if (filters.sortOrder) query.sortOrder = filters.sortOrder;

  return query;
}

export function useLeads(filters?: LeadFilters) {
  return useQuery({
    queryKey: [LEADS_QUERY_KEY, filters],
    queryFn: async () => {
      const { data } = await leadsControllerFindAll({
        query: buildFindAllQuery(filters),
      });
      return data;
    },
  });
}

export function useLead(id: string) {
  return useQuery({
    queryKey: [LEADS_QUERY_KEY, id],
    queryFn: async () => {
      const { data } = await leadsControllerFindById({
        path: { id },
      });
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: CreateLeadDto) => {
      const { data } = await leadsControllerCreate({ body: dto });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LEADS_QUERY_KEY] });
    },
  });
}

export function useUpdateLead(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: UpdateLeadDto) => {
      const { data } = await leadsControllerUpdate({
        path: { id },
        body: dto,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LEADS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [LEADS_QUERY_KEY, id] });
    },
  });
}

export function useDeleteLead(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await leadsControllerRemove({
        path: { id },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LEADS_QUERY_KEY] });
    },
  });
}

export function useChangeLeadStage(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: ChangeLeadStageDto) => {
      const { data } = await leadsControllerChangeStage({
        path: { id },
        body: dto,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LEADS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [LEADS_QUERY_KEY, id] });
    },
  });
}

export function useConvertLead(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await leadsControllerConvert({
        path: { id },
        body: {},
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LEADS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [LEADS_QUERY_KEY, id] });
    },
  });
}

export function useSetDnc(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: SetDncDto) => {
      const { data } = await leadsControllerSetDnc({
        path: { id },
        body: dto,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LEADS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [LEADS_QUERY_KEY, id] });
    },
  });
}
