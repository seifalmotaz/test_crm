import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  projectsControllerFindAll,
  projectsControllerCreate,
  projectsControllerFindById,
  projectsControllerUpdate,
  projectsControllerRemove,
  projectsControllerChangeStatus,
} from '@/api/sdk.gen';
import type {
  CreateProjectDto,
  UpdateProjectDto,
  ChangeProjectStatusDto,
  ProjectsControllerFindAllData,
} from '@/api/types.gen';
import type { ProjectFilters } from '@/types/projects';

const PROJECTS_QUERY_KEY = 'projects';

function buildFindAllQuery(
  filters?: ProjectFilters,
): ProjectsControllerFindAllData['query'] {
  if (!filters) return { limit: 100 };

  const query: ProjectsControllerFindAllData['query'] = { limit: 100 };

  if (filters.search) query.search = filters.search;
  if (filters.status && filters.status !== 'all') {
    query.status = filters.status as 'planning' | 'preLaunch' | 'active' | 'soldOut' | 'delivered';
  }
  if (filters.page) query.page = filters.page;
  if (filters.limit) query.limit = filters.limit;

  return query;
}

export function useProjects(filters?: ProjectFilters) {
  return useQuery({
    queryKey: [PROJECTS_QUERY_KEY, filters],
    queryFn: async () => {
      const { data } = await projectsControllerFindAll({
        query: buildFindAllQuery(filters),
      });
      return data;
    },
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: [PROJECTS_QUERY_KEY, id],
    queryFn: async () => {
      const { data } = await projectsControllerFindById({
        path: { id },
      });
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: CreateProjectDto) => {
      const { data } = await projectsControllerCreate({ body: dto });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROJECTS_QUERY_KEY] });
    },
  });
}

export function useUpdateProject(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: UpdateProjectDto) => {
      const { data } = await projectsControllerUpdate({
        path: { id },
        body: dto,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROJECTS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [PROJECTS_QUERY_KEY, id] });
    },
  });
}

export function useDeleteProject(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await projectsControllerRemove({
        path: { id },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROJECTS_QUERY_KEY] });
    },
  });
}

export function useChangeProjectStatus(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: ChangeProjectStatusDto) => {
      const { data } = await projectsControllerChangeStatus({
        path: { id },
        body: dto,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROJECTS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [PROJECTS_QUERY_KEY, id] });
    },
  });
}