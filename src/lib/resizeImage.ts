import {
  RESIZE_JPEG_QUALITY,
  RESIZE_MAX_BYTES,
  RESIZE_MAX_SIDE,
} from '@/const/bills';
import { isBillImageMime } from '@/lib/imageValidation';

/**
 * Downscales large receipt photos before upload. Returns the original file
 * when no resize is needed or when anything fails.
 */
export async function prepareBillImage(file: File): Promise<File> {
  if (!isBillImageMime(file.type)) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  try {
    const { width, height } = bitmap;
    const longSide = Math.max(width, height);
    if (file.size <= RESIZE_MAX_BYTES && longSide <= RESIZE_MAX_SIDE) {
      return file;
    }

    const scale = Math.min(1, RESIZE_MAX_SIDE / longSide);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', RESIZE_JPEG_QUALITY);
    });
    if (!blob) return file;

    const dot = file.name.lastIndexOf('.');
    const baseName = dot > 0 ? file.name.slice(0, dot) : file.name;
    return new File([blob], `${baseName}.jpg`, {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  } finally {
    bitmap.close();
  }
}
