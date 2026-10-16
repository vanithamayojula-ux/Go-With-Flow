/**
 * Road texture worker: generates the procedural asphalt maps' pixels
 * (roadTexturePixels.ts) off the main thread and hands back the three RGBA
 * buffers (transferred, not copied).
 */
import { computeRoadPixels, RoadTextureSpec } from './roadTexturePixels';

const ctx = self as unknown as {
  onmessage: ((ev: MessageEvent<RoadTextureSpec>) => void) | null;
  postMessage(message: unknown, transfer?: Transferable[]): void;
};

ctx.onmessage = (ev: MessageEvent<RoadTextureSpec>) => {
  try {
    const px = computeRoadPixels(ev.data);
    ctx.postMessage(px, [px.albedo.buffer, px.roughness.buffer, px.normal.buffer]);
  } catch (err) {
    ctx.postMessage({ error: String((err as Error)?.message ?? err) });
  }
};
