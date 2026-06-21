// Client-side image compression — no external libs, just Canvas API.
//
// Why: a fresh iPhone photo is typically 3–8 MB. Cleaners may upload 5–10
// photos per job over cellular. Compressing to a max long-edge of ~1600 px
// at JPEG 0.8 brings most photos under 500 KB without visible quality loss
// for documentation purposes.

const DEFAULT_MAX_EDGE = 1600;
const DEFAULT_QUALITY = 0.8;

export type CompressOptions = {
  maxEdge?: number;
  quality?: number;
};

export async function compressImage(
  file: File,
  options: CompressOptions = {},
): Promise<Blob> {
  const maxEdge = options.maxEdge ?? DEFAULT_MAX_EDGE;
  const quality = options.quality ?? DEFAULT_QUALITY;

  // HEIC and other formats the browser can't decode: skip compression,
  // upload raw. Supabase Storage doesn't care about format.
  if (!file.type.startsWith("image/")) return file;
  if (file.type === "image/heic" || file.type === "image/heif") return file;

  const bitmap = await loadBitmap(file);
  try {
    const { width, height } = scaleToFit(bitmap.width, bitmap.height, maxEdge);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    return blob ?? file;
  } finally {
    bitmap.close?.();
  }
}

async function loadBitmap(file: File): Promise<ImageBitmap> {
  // createImageBitmap respects EXIF orientation when imageOrientation: 'from-image'
  // is supported (recent Chrome/Safari/Firefox).
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return await createImageBitmap(file);
  }
}

function scaleToFit(w: number, h: number, maxEdge: number) {
  const longest = Math.max(w, h);
  if (longest <= maxEdge) return { width: w, height: h };
  const scale = maxEdge / longest;
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}
