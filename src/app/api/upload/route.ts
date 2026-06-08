import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { uploadToCloudinary } from '@/lib/cloudinary';

/**
 * POST /api/upload
 * Upload any file to Cloudinary.
 * Accepts: all common image types, PDF, DOC, DOCX, XLS, XLSX, CSV, TXT
 * Supports: multipart/form-data with field name 'file'
 * Returns: { success, data: { url, name, size, format, publicId, resourceType } }
 */
export const POST = withAuth(async (req: NextRequest) => {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      'text/plain',
      'text/csv',
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Only PDF, DOC, DOCX, XLS, XLSX, CSV, TXT, and image files are allowed' },
        { status: 400 }
      );
    }

    // Convert File to Buffer for Cloudinary upload
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // Determine folder based on file type
    const folder = file.type.startsWith('image/') ? 'pms/task-images' : 'pms/task-files';

    // Upload to Cloudinary
    const result = await uploadToCloudinary(fileBuffer, file.name, folder);

    return NextResponse.json({
      success: true,
      data: {
        url: result.url,
        publicId: result.publicId,
        name: file.name,
        size: file.size,
        format: result.format,
        resourceType: result.resourceType,
        uploadedAt: result.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to upload file' },
      { status: 500 }
    );
  }
});