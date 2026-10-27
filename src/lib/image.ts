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

const MAX_SIDE = 1400;

/**
 * Reads a File, downsizes it so the longest edge is <= MAX_SIDE and returns a data URL.
 * Keeps PNG for transparency, otherwise encodes JPEG to keep the request payload small.
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

  const isPng = file.type === "image/png";
  const dataUrl = isPng ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.9);
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
