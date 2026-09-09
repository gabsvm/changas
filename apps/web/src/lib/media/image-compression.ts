export const IMAGE_COMPRESSION_TARGET_BYTES = 100 * 1024;
export const IMAGE_COMPRESSION_MAX_DIMENSION = 1200;

const OUTPUT_MIME_TYPE = "image/jpeg";
const MAX_SOURCE_IMAGE_BYTES = 25 * 1024 * 1024;
const MIN_DIMENSION = 480;
const MIN_QUALITY = 0.45;
const MAX_QUALITY = 0.94;
const QUALITY_PASSES = 8;

export type ImageCompressionResult = {
  file: File;
  originalBytes: number;
  compressedBytes: number;
  wasCompressed: boolean;
};

export function isCompressibleImageType(mimeType: string): boolean {
  return [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
  ].includes(mimeType.toLowerCase());
}

export function buildCompressedImageName(name: string): string {
  const safe = name
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(-72);
  return `${safe || "imagen"}.jpg`;
}

function fitWithinDimension(width: number, height: number, maxDimension: number) {
  const largest = Math.max(width, height);
  if (largest <= maxDimension) return { width, height };
  const scale = maxDimension / largest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("No se pudo comprimir la imagen."));
      },
      OUTPUT_MIME_TYPE,
      quality,
    );
  });
}

async function loadImage(file: File): Promise<{
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
}> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close(),
    };
  }

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        source: image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        close: () => undefined,
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("No se pudo leer la imagen."));
    };
    image.src = objectUrl;
  });
}

async function bestJpegUnderTarget(
  canvas: HTMLCanvasElement,
  targetBytes: number,
): Promise<Blob> {
  let low = MIN_QUALITY;
  let high = MAX_QUALITY;
  let best: Blob | null = null;

  for (let index = 0; index < QUALITY_PASSES; index += 1) {
    const quality = (low + high) / 2;
    const candidate = await canvasToBlob(canvas, quality);
    if (candidate.size <= targetBytes) {
      best = candidate;
      low = quality;
    } else {
      high = quality;
    }
  }

  return best ?? canvasToBlob(canvas, MIN_QUALITY);
}

function drawImage(
  source: CanvasImageSource,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Tu navegador no permite optimizar imágenes.");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(source, 0, 0, width, height);
  return canvas;
}

export async function compressImageForUpload(
  file: File,
  targetBytes = IMAGE_COMPRESSION_TARGET_BYTES,
): Promise<ImageCompressionResult> {
  if (!isCompressibleImageType(file.type)) {
    return {
      file,
      originalBytes: file.size,
      compressedBytes: file.size,
      wasCompressed: false,
    };
  }

  if (file.size > MAX_SOURCE_IMAGE_BYTES) {
    throw new Error("La imagen original supera 25 MiB.");
  }

  if (file.size <= targetBytes && file.type === OUTPUT_MIME_TYPE) {
    return {
      file,
      originalBytes: file.size,
      compressedBytes: file.size,
      wasCompressed: false,
    };
  }

  const loaded = await loadImage(file);
  try {
    let maxDimension = IMAGE_COMPRESSION_MAX_DIMENSION;
    let candidate: Blob | null = null;

    while (maxDimension >= MIN_DIMENSION) {
      const dimensions = fitWithinDimension(
        loaded.width,
        loaded.height,
        maxDimension,
      );
      const canvas = drawImage(loaded.source, dimensions.width, dimensions.height);
      candidate = await bestJpegUnderTarget(canvas, targetBytes);
      canvas.width = 1;
      canvas.height = 1;

      if (candidate.size <= targetBytes || maxDimension === MIN_DIMENSION) break;
      maxDimension = Math.max(MIN_DIMENSION, Math.floor(maxDimension * 0.82));
    }

    if (!candidate) throw new Error("No se pudo comprimir la imagen.");

    const compressed = new File(
      [candidate],
      buildCompressedImageName(file.name),
      {
        type: OUTPUT_MIME_TYPE,
        lastModified: Date.now(),
      },
    );

    return {
      file: compressed,
      originalBytes: file.size,
      compressedBytes: compressed.size,
      wasCompressed: true,
    };
  } finally {
    loaded.close();
  }
}
