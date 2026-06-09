import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  leadsControllerFindActivities,
  leadsControllerAddActivity,
} from '@/api/sdk.gen';
import type { AddActivityDto, LeadsControllerFindActivitiesData } from '@/api/types.gen';

const ACTIVITIES_QUERY_KEY = 'lead-activities';

export interface ActivityFilters {
  type?: string;
  page?: number;
  limit?: number;
}

function buildFindActivitiesQuery(filters?: ActivityFilters): LeadsControllerFindActivitiesData['query'] {
  const query: LeadsControllerFindActivitiesData['query'] = { limit: filters?.limit ?? 50 };
  if (filters?.type) query.type = filters.type as any;
  if (filters?.page) query.page = filters.page;
  return query;
}

export function useLeadActivities(leadId: string, filters?: ActivityFilters) {
  return useQuery({
    queryKey: [ACTIVITIES_QUERY_KEY, leadId, filters],
    queryFn: async () => {
      const { data } = await leadsControllerFindActivities({
        path: { id: leadId },
        query: buildFindActivitiesQuery(filters),
      });
      return data;
    },
    enabled: !!leadId,
  });
}

export function useAddActivity(leadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: AddActivityDto) => {
      const { data } = await leadsControllerAddActivity({
        path: { id: leadId },
        body: dto,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ACTIVITIES_QUERY_KEY, leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads', leadId] });
    },
  });
}
