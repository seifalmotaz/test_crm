import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  leadsControllerFindTags,
  leadsControllerAddTag,
  leadsControllerRemoveTag,
} from '@/api/sdk.gen';
import type { AddTagDto } from '@/api/types.gen';

const TAGS_QUERY_KEY = 'lead-tags';

export function useLeadTags(leadId: string) {
  return useQuery({
    queryKey: [TAGS_QUERY_KEY, leadId],
    queryFn: async () => {
      const { data } = await leadsControllerFindTags({
        path: { id: leadId },
      });
      return data;
    },
    enabled: !!leadId,
  });
}

export function useAddTag(leadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: AddTagDto) => {
      const { data } = await leadsControllerAddTag({
        path: { id: leadId },
        body: dto,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TAGS_QUERY_KEY, leadId] });
    },
  });
}

export function useRemoveTag(leadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tagId: string) => {
      const { data } = await leadsControllerRemoveTag({
        path: { id: leadId, tagId },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TAGS_QUERY_KEY, leadId] });
    },
  });
}
