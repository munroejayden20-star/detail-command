/**
 * Photo upload + signed URL helpers.
 *
 * Files live in the private `photos` Storage bucket at:
 *   <user_id>/<photo_id>.<ext>
 *
 * RLS allows each user to read/write/delete only their own folder. Signed URLs
 * are used for display (1h expiry) and cached in-memory so we don't re-sign on
 * every render.
 */
import { api } from "./api";
import type { Photo, PhotoType } from "./types";
import { uid } from "./utils";

const SIGN_EXPIRY_SECONDS = 60 * 60; // 1 hour
const SIGN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // refresh 5 min before expiry

interface SignedEntry {
  url: string;
  expiresAt: number;
}
const signedCache = new Map<string, SignedEntry>();

/** Returns a signed URL for displaying a photo, cached for ~55 min. */
export async function getSignedPhotoUrl(path: string): Promise<string | null> {
  const now = Date.now();
  const cached = signedCache.get(path);
  if (cached && cached.expiresAt - now > SIGN_REFRESH_BUFFER_MS) {
    return cached.url;
  }
  const { data, error } = await api.signPhotoUrl(path, SIGN_EXPIRY_SECONDS);
  if (error || !data?.signedUrl) {
    console.error("[photos] sign failed", path, error);
    return null;
  }
  signedCache.set(path, {
    url: data.signedUrl,
    expiresAt: now + SIGN_EXPIRY_SECONDS * 1000,
  });
  return data.signedUrl;
}

export function clearSignedUrlCache(path?: string) {
  if (path) signedCache.delete(path);
  else signedCache.clear();
}

/** Read a File and return a thumbnail-resized Blob (max 1600px on the longest
 *  edge, JPEG quality 0.85). Reduces upload size for phone-camera shots. */
async function resizeForUpload(file: File, maxEdge = 1600): Promise<File> {
  // SVG and HEIC and small images: skip resize.
  if (
    file.type === "image/svg+xml" ||
    file.type === "image/heic" ||
    file.size < 600_000
  ) {
    return file;
  }
  return new Promise<File>((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const { naturalWidth: w, naturalHeight: h } = img;
      const longest = Math.max(w, h);
      const scale = longest > maxEdge ? maxEdge / longest : 1;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (!blob) {
            resolve(file);
            return;
          }
          const out = new File(
            [blob],
            file.name.replace(/\.(\w+)$/i, ".jpg"),
            { type: "image/jpeg", lastModified: Date.now() }
          );
          resolve(out);
        },
        "image/jpeg",
        0.85
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

/** Read intrinsic image dimensions (best-effort). */
function readDimensions(file: File): Promise<{ width: number; height: number } | null> {
  if (!file.type.startsWith("image/")) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

export interface UploadOptions {
  type: PhotoType;
  customerId?: string;
  appointmentId?: string;
  vehicle?: string;
  notes?: string;
  tags?: string[];
}

/**
 * Resize → upload to Storage → return a Photo metadata object (NOT yet inserted
 * into the photos table — the caller dispatches `addPhoto` so optimistic UI +
 * sync stays in one place).
 */
export async function uploadPhoto(
  file: File,
  userId: string,
  opts: UploadOptions
): Promise<Photo> {
  const sized = await resizeForUpload(file);
  const dims = await readDimensions(sized);
  const id = uid();
  const ext = (sized.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${userId}/${id}.${ext}`;

  const { error } = await api.uploadPhotoFile(sized, path);
  if (error) {
    throw new Error(error.message || "Upload failed");
  }

  return {
    id,
    storagePath: path,
    type: opts.type,
    customerId: opts.customerId,
    appointmentId: opts.appointmentId,
    vehicle: opts.vehicle,
    notes: opts.notes,
    tags: opts.tags ?? [],
    width: dims?.width,
    height: dims?.height,
    sizeBytes: sized.size,
    createdAt: new Date().toISOString(),
  };
}

/** Delete the file from Storage (best-effort) and clear cache. Caller dispatches
 *  `deletePhoto` separately for the metadata row. */
export async function removePhotoFile(path: string): Promise<void> {
  await api.removePhotoFile(path);
  clearSignedUrlCache(path);
}
