import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  usersControllerFindAll,
  usersControllerCreate,
  usersControllerFindById,
  usersControllerUpdate,
  usersControllerChangeRole,
  usersControllerDeactivate,
  usersControllerReactivate,
} from '@/api/sdk.gen';
import type { CreateUserDto, UpdateUserDto, UpdateRoleDto } from '@/api/types.gen';

const USERS_QUERY_KEY = 'users';

export function useUsers(filters?: { limit?: number; status?: string; role?: string; search?: string }) {
  return useQuery({
    queryKey: [USERS_QUERY_KEY, filters],
    queryFn: async () => {
      const { data } = await usersControllerFindAll({
        query: filters as any,
      });
      return data;
    },
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: [USERS_QUERY_KEY, id],
    queryFn: async () => {
      const { data } = await usersControllerFindById({
        path: { id },
      });
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: CreateUserDto) => {
      const { data } = await usersControllerCreate({ body: dto });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY] });
    },
  });
}

export function useUpdateUser(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: UpdateUserDto) => {
      const { data } = await usersControllerUpdate({
        path: { id },
        body: dto,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY, id] });
    },
  });
}

export function useChangeRole(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: UpdateRoleDto) => {
      const { data } = await usersControllerChangeRole({
        path: { id },
        body: dto,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY, id] });
    },
  });
}

export function useDeactivateUser(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await usersControllerDeactivate({ path: { id } });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY, id] });
    },
  });
}

export function useActivateUser(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await usersControllerReactivate({ path: { id } });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY, id] });
    },
  });
}