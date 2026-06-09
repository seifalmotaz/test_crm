import { useMutation } from '@tanstack/react-query';
import { propertiesControllerGetPresignedUploadUrl } from '@/api/sdk.gen';

export interface UploadResult {
  uploadUrl: string;
  fileUrl: string;
}

export function usePresignedUpload() {
  return useMutation({
    mutationFn: async ({ propertyId, file }: { propertyId: string; file: File }): Promise<UploadResult> => {
      const { data, error } = await propertiesControllerGetPresignedUploadUrl({
        path: { id: propertyId },
        body: { filename: file.name, contentType: file.type },
      });

      if (error || !data) {
        throw new Error('Failed to get pre-signed upload URL');
      }

      const result = data as unknown as UploadResult;

      if (!result.uploadUrl || !result.fileUrl) {
        throw new Error('Invalid response: missing uploadUrl or fileUrl');
      }

      // Upload directly to S3
      const uploadRes = await fetch(result.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });

      if (!uploadRes.ok) {
        throw new Error(`S3 upload failed: ${uploadRes.status} ${uploadRes.statusText}`);
      }

      return { uploadUrl: result.uploadUrl, fileUrl: result.fileUrl };
    },
  });
}