/**
 * Texture decode worker: fetch an image, decode it (flipped for WebGL when
 * asked) and hand back raw RGBA pixels. Uploading raw pixels is a plain copy
 * on the main thread (~1 ms for 1024px), with no image decode and no wait on
 * the GPU process, unlike uploading an <img> (decode inside texImage2D) or
 * an ImageBitmap (which can block on GPU-side work in Chrome/Edge).
 */

interface DecodeRequest {
  id: number;
  url: string;
  flipY: boolean;
}

const ctx = self as unknown as {
  onmessage: ((ev: MessageEvent<DecodeRequest>) => void) | null;
  postMessage(message: unknown, transfer?: Transferable[]): void;
};

ctx.onmessage = (ev: MessageEvent<DecodeRequest>) => {
  const { id, url, flipY } = ev.data;
  decode(url, flipY).then(
    ({ width, height, buffer }) => ctx.postMessage({ id, width, height, buffer }, [buffer]),
    (err) => ctx.postMessage({ id, error: String((err as Error)?.message ?? err) })
  );
};

async function decode(url: string, flipY: boolean): Promise<{ width: number; height: number; buffer: ArrayBuffer }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob, {
    imageOrientation: flipY ? 'flipY' : 'from-image',
    premultiplyAlpha: 'none',
    colorSpaceConversion: 'none',
  });
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const c2d = canvas.getContext('2d', { willReadFrequently: true });
  if (!c2d) throw new Error('no 2d context');
  c2d.drawImage(bitmap, 0, 0);
  bitmap.close();
  const data = c2d.getImageData(0, 0, canvas.width, canvas.height);
  return { width: data.width, height: data.height, buffer: data.data.buffer as ArrayBuffer };
}
