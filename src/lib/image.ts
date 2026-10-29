/** Client-side image helpers (browser only). */

export interface UploadedScreenshot {
  id: string;
  name: string;
  dataUrl: string;
  /** natural width / natural height */
  aspect: number;
  width: number;
  height: number;
}

/** Long edge after resizing. High enough for SAM 3.1 to find small UI regions. */
const MAX_SIDE = 2000;
/** JPEG keeps three screenshots well under the 4.5 MB serverless request limit. */
const JPEG_QUALITY = 0.86;

/**
 * Reads a File, downsizes it so the longest edge is <= MAX_SIDE and returns a JPEG data URL.
 * Screenshots never need transparency, so JPEG is always used to keep requests small.
 */
export async function fileToScreenshot(file: File): Promise<UploadedScreenshot> {
  const bitmap = await loadImage(URL.createObjectURL(file));
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.naturalWidth, bitmap.naturalHeight));
  const width = Math.round(bitmap.naturalWidth * scale);
  const height = Math.round(bitmap.naturalHeight * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(bitmap, 0, 0, width, height);

  // Paint white first so transparent PNG pixels do not turn black in the JPEG.
  ctx.globalCompositeOperation = "destination-over";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  URL.revokeObjectURL(bitmap.src);

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name,
    dataUrl,
    aspect: width / height,
    width,
    height,
  };
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = src;
  });
}
