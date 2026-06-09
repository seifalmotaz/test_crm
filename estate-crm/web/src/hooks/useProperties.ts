import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  propertiesControllerFindAll,
  propertiesControllerCreate,
  propertiesControllerFindById,
  propertiesControllerUpdate,
  propertiesControllerRemove,
  propertiesControllerChangeStatus,
} from '@/api/sdk.gen';
import type {
  CreatePropertyDto,
  UpdatePropertyDto,
  ChangePropertyStatusDto,
  PropertiesControllerFindAllData,
} from '@/api/types.gen';
import type { PropertyFilters } from '@/types/properties';

const PROPERTIES_QUERY_KEY = 'properties';

function buildFindAllQuery(
  filters?: PropertyFilters,
): PropertiesControllerFindAllData['query'] {
  if (!filters) return { limit: 100 };

  const query: PropertiesControllerFindAllData['query'] = { limit: 100 };

  if (filters.search) query.search = filters.search;
  if (filters.status && filters.status !== 'all') {
    query.status = filters.status as 'active' | 'pending' | 'sold' | 'withdrawn';
  }
  if (filters.type && filters.type !== 'all') {
    query.type = filters.type as 'apartment' | 'villa' | 'commercial' | 'land' | 'townhouse';
  }
  if (filters.projectId) query.projectId = filters.projectId;
  if (filters.minPrice !== undefined) query.minPrice = filters.minPrice;
  if (filters.maxPrice !== undefined) query.maxPrice = filters.maxPrice;
  if (filters.beds !== undefined) query.beds = filters.beds;
  if (filters.page) query.page = filters.page;
  if (filters.limit) query.limit = filters.limit;

  return query;
}

export function useProperties(filters?: PropertyFilters) {
  return useQuery({
    queryKey: [PROPERTIES_QUERY_KEY, filters],
    queryFn: async () => {
      const { data } = await propertiesControllerFindAll({
        query: buildFindAllQuery(filters),
      });
      return data;
    },
  });
}

export function useProperty(id: string) {
  return useQuery({
    queryKey: [PROPERTIES_QUERY_KEY, id],
    queryFn: async () => {
      const { data } = await propertiesControllerFindById({
        path: { id },
      });
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateProperty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: CreatePropertyDto) => {
      const { data } = await propertiesControllerCreate({ body: dto });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROPERTIES_QUERY_KEY] });
    },
  });
}

export function useUpdateProperty(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: UpdatePropertyDto) => {
      const { data } = await propertiesControllerUpdate({
        path: { id },
        body: dto,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROPERTIES_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [PROPERTIES_QUERY_KEY, id] });
    },
  });
}

export function useDeleteProperty(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await propertiesControllerRemove({
        path: { id },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROPERTIES_QUERY_KEY] });
    },
  });
}

export function useChangePropertyStatus(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: ChangePropertyStatusDto) => {
      const { data } = await propertiesControllerChangeStatus({
        path: { id },
        body: dto,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROPERTIES_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [PROPERTIES_QUERY_KEY, id] });
    },
  });
}