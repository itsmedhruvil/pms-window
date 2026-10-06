'use client';

/**
 * Shared fast-upload helper used by discussion + comment file inputs.
 *
 * Why uploads were slow / failing:
 * 1. Phone photos (5–15 MB) were sent at full resolution — slow on mobile
 *    networks and prone to Vercel's ~4.5 MB serverless body timeout.
 * 2. Files uploaded strictly one-by-one (sequential `await` in a loop).
 * 3. Failures were silently swallowed (`catch {}`), so it just looked stuck.
 *
 * Fixes:
 * - Images are downscaled client-side (max 1600px, JPEG q0.8) before upload —
 *   typically 5–15 MB → 200–600 KB with no visible quality loss in chat.
 * - All files upload in parallel with per-file error reporting.
 * - 15 MB post-compression cap with a clear message instead of a hang.
 */

import type { ICommentAttachment } from '@/types';

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.8;
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not read image "${file.name}"`));
    };
    img.src = url;
  });
}

/**
 * Downscale an image client-side. Returns the original file when:
 * - it isn't an image, is SVG/GIF (must not be re-encoded), or
 * - it's already small enough that compression buys nothing (< 400 KB).
 */
export async function compressImageIfNeeded(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') return file;
  if (file.size < 400 * 1024) return file;

  try {
    const img = await loadImage(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
    // Already within bounds but large (e.g. uncompressed PNG) → re-encode only.
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    // JPEG has no alpha — paint white behind transparent PNGs.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    const outType =
      file.type === 'image/png' && scale >= 1 ? 'image/png' : 'image/jpeg';
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, outType, JPEG_QUALITY)
    );
    if (!blob || blob.size >= file.size) return file;

    const base = file.name.replace(/\.[^.]+$/, '') || 'image';
    const ext = outType === 'image/png' ? 'png' : 'jpg';
    return new File([blob], `${base}.${ext}`, { type: outType });
  } catch {
    // Compression is best-effort — fall back to the original file.
    return file;
  }
}

export interface UploadResult {
  attachment: ICommentAttachment;
  /** Original file name, for error messages. */
  fileName: string;
  /** Cloudinary public id (task files need it for delete). */
  publicId?: string;
}

export interface UploadFailure {
  fileName: string;
  message: string;
}

/**
 * Upload files in parallel. Compresses images first, enforces a size cap,
 * and reports per-file failures instead of silently dropping them.
 */
export async function uploadFilesFast(
  files: File[] | FileList,
  opts: { signal?: AbortSignal; projectId?: string } = {}
): Promise<{ uploaded: UploadResult[]; failed: UploadFailure[] }> {
  const list = Array.from(files);
  const settled = await Promise.all(
    list.map(async (original): Promise<
      | { ok: true; value: UploadResult }
      | { ok: false; value: UploadFailure }
    > => {
      const fail = (message: string) => ({
        ok: false as const,
        value: { fileName: original.name, message },
      });
      try {
        const file = await compressImageIfNeeded(original);
        if (file.size > MAX_UPLOAD_BYTES) {
          return fail(
            `"${original.name}" is ${(file.size / 1024 / 1024).toFixed(1)} MB — max ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`
          );
        }
        const formData = new FormData();
        formData.append('file', file);
        if (opts.projectId) formData.append('projectId', opts.projectId);
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
          signal: opts.signal,
        });
        let data: {
          success?: boolean;
          error?: string;
          data?: { url: string; publicId?: string; name?: string; size?: number };
        };
        try {
          data = await res.json();
        } catch {
          return fail(`"${original.name}" — server returned an unreadable response (${res.status}).`);
        }
        if (!res.ok || !data.success || !data.data?.url) {
          const msg =
            typeof data.error === 'string' && data.error
              ? data.error
              : `Upload failed (${res.status}).`;
          return fail(`"${original.name}" — ${msg}`);
        }
        return {
          ok: true,
          value: {
            fileName: original.name,
            publicId: data.data.publicId,
            attachment: {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              name: original.name,
              url: data.data.url,
              type: original.type,
              size: file.size,
              uploadedAt: new Date(),
            },
          },
        };
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return fail(`"${original.name}" — upload cancelled.`);
        }
        return fail(
          `"${original.name}" — ${err instanceof Error ? err.message : 'network error, check connection and retry.'}`
        );
      }
    })
  );

  return {
    uploaded: settled.filter((s) => s.ok).map((s) => (s as { value: UploadResult }).value),
    failed: settled.filter((s) => !s.ok).map((s) => (s as { value: UploadFailure }).value),
  };
}
