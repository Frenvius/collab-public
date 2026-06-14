export type ClipboardPart = { text?: string; image?: Blob };

const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/bmp": "bmp",
  "image/svg+xml": "svg",
  "image/tiff": "tiff",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/avif": "avif",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
};

export async function extractAllClipboardData(
  e: ClipboardEvent,
): Promise<ClipboardPart[]> {
  const dt = e.clipboardData;
  if (!dt) return [];

  const parts: ClipboardPart[] = [];
  for (const item of Array.from(dt.items)) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) parts.push({ image: file });
    }
  }

  if (parts.length === 0) {
    const text = dt.getData("text/plain");
    if (text) parts.push({ text });
  }

  return parts;
}

// Persists a pasted image Blob to an OS temp file and returns its absolute path,
// so it can be handed to Claude Code via a bracketed-paste of the path.
export async function createTempImageFromBlob(blob: Blob): Promise<string> {
  if (blob.size > 5 * 1024 * 1024) {
    throw new Error("Image too large (>5MB)");
  }
  const ext = MIME_TO_EXT[blob.type];
  if (!blob.type.startsWith("image/") || !ext) {
    throw new Error(`Unsupported image type: ${blob.type}`);
  }

  const buffer = await blob.arrayBuffer();
  const fileName = `collab_paste_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;

  return window.api.writeTempImage(fileName, buffer);
}
