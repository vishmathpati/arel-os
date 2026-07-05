import * as React from "react";

import { toast } from "sonner";

/**
 * Local media upload (Chapter 7). Uploads dropped/selected files to the vault
 * server (`POST /vault/upload`), which saves them under `media/` and returns a
 * served URL. Replaces the cloud (uploadthing) uploader — this app is local-first.
 */

const BASE_URL = import.meta.env.VITE_VAULT_API ?? "http://localhost:5274";

export interface UploadedFile {
  key: string;
  url: string;
  name: string;
  size: number;
  type: string;
}

interface UseUploadFileProps {
  onUploadComplete?: (file: UploadedFile) => void;
  onUploadError?: (error: unknown) => void;
}

export function useUploadFile({ onUploadComplete, onUploadError }: UseUploadFileProps = {}) {
  const [uploadedFile, setUploadedFile] = React.useState<UploadedFile>();
  const [uploadingFile, setUploadingFile] = React.useState<File>();
  const [progress, setProgress] = React.useState(0);
  const [isUploading, setIsUploading] = React.useState(false);

  async function uploadFile(file: File) {
    setIsUploading(true);
    setUploadingFile(file);

    try {
      const result = await uploadToVault(file, (p) => setProgress(Math.min(p, 100)));
      setUploadedFile(result);
      onUploadComplete?.(result);
      return result;
    } catch (error) {
      toast.error(getErrorMessage(error));
      onUploadError?.(error);
      throw error;
    } finally {
      setProgress(0);
      setIsUploading(false);
      setUploadingFile(undefined);
    }
  }

  return { isUploading, progress, uploadedFile, uploadFile, uploadingFile };
}

/** POST the file to the vault server; report upload progress via XHR. */
function uploadToVault(file: File, onProgress: (pct: number) => void): Promise<UploadedFile> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE_URL}/vault/upload`);
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) onProgress((e.loaded / e.total) * 100);
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as UploadedFile);
        } catch {
          reject(new Error("Upload succeeded but the response was unreadable."));
        }
      } else {
        reject(new Error(`Upload failed (${xhr.status} ${xhr.statusText}).`));
      }
    });
    xhr.addEventListener("error", () => reject(new Error("Upload network error.")));
    xhr.send(form);
  });
}

export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Something went wrong, please try again later.";
}

export function showErrorToast(err: unknown) {
  return toast.error(getErrorMessage(err));
}
