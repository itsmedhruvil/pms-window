/**
 * Cloudinary upload utility for all asset storage.
 * Replace any direct file upload with these functions.
 */
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary from environment variables
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

export interface CloudinaryUploadResult {
  url: string;
  publicId: string;
  name: string;
  size: number;
  format: string;
  resourceType: string;
  createdAt: Date;
}

/**
 * Upload a file buffer to Cloudinary.
 * Supports images (jpg, png, gif, webp), PDFs, and other document types.
 *
 * @param fileBuffer - The raw file buffer
 * @param fileName - Original file name (used for public_id)
 * @param folder - Cloudinary folder to upload into (e.g. 'tasks', 'projects', 'profiles')
 * @returns Upload result with URL, public ID, and metadata
 */
export async function uploadToCloudinary(
  fileBuffer: Buffer,
  fileName: string,
  folder: string = 'uploads'
): Promise<CloudinaryUploadResult> {
  const ext = fileName.split('.').pop()?.toLowerCase() || 'bin';
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
  const isVideo = ['mp4', 'webm', 'mov'].includes(ext);

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${fileName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60)}`,
        resource_type: isVideo ? 'video' : 'auto',
        format: isImage ? undefined : ext,
        // For non-image assets, Cloudinary stores as 'raw'
        type: isImage || isVideo ? 'upload' : 'upload',
        // Allow large files (up to 20MB for raw, 10MB for images)
        ...(isImage ? { quality: 'auto', fetch_format: 'auto' } : {}),
      },
      (error, result) => {
        if (error || !result) {
          reject(error || new Error('Upload failed'));
          return;
        }
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          name: fileName,
          size: result.bytes,
          format: result.format || ext,
          resourceType: result.resource_type,
          createdAt: new Date(result.created_at || Date.now()),
        });
      }
    );

    uploadStream.end(fileBuffer);
  });
}

/**
 * Delete an asset from Cloudinary by its public ID.
 */
export async function deleteFromCloudinary(publicId: string): Promise<boolean> {
  try {
    await cloudinary.uploader.destroy(publicId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate a thumbnail URL for an image stored in Cloudinary.
 */
export function getCloudinaryThumbnail(
  publicId: string,
  width: number = 300,
  height: number = 200
): string {
  return cloudinary.url(publicId, {
    transformation: [
      { width, height, crop: 'fill', gravity: 'auto' },
      { quality: 'auto', fetch_format: 'auto' },
    ],
  });
}