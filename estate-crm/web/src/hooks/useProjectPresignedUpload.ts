import { useMutation } from '@tanstack/react-query';
import { projectsControllerGetPresignedUploadUrl } from '@/api/sdk.gen';

export interface ProjectUploadResult {
  uploadUrl: string;
  fileUrl: string;
}

export function useProjectPresignedUpload() {
  return useMutation({
    mutationFn: async ({
      projectId,
      file,
    }: {
      projectId: string;
      file: File;
    }): Promise<ProjectUploadResult> => {
      const { data, error } = await projectsControllerGetPresignedUploadUrl({
        path: { id: projectId },
        body: { filename: file.name, contentType: file.type },
      });

      if (error || !data) {
        throw new Error('Failed to get pre-signed upload URL');
      }

      const result = data as unknown as ProjectUploadResult;
      if (!result.uploadUrl || !result.fileUrl) {
        throw new Error('Invalid response: missing uploadUrl or fileUrl');
      }

      const uploadRes = await fetch(result.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });

      if (!uploadRes.ok) {
        throw new Error(`S3 upload failed: ${uploadRes.status} ${uploadRes.statusText}`);
      }

      return result;
    },
  });
}