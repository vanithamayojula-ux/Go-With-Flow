import { GAME_VERSION } from '../version';

export interface PerformanceTelemetrySnapshot {
  averageFps: number;
  minFps: number;
  maxFps: number;
  averageFrameTimeMs: number;
  longFrameCount: number; // frames that took > 66.6ms (< 15 fps)
  transitionCount: number;
  lastTransitionDurationMs: number;
  version: string;
}

class PerformanceTelemetry {
  private frameTimes: Float32Array = new Float32Array(60);
  private frameTimeIndex: number = 0;
  private frameCount: number = 0;
  private longFrameCount: number = 0;
  private minFps: number = 60;
  private maxFps: number = 60;
  private transitionCount: number = 0;
  private lastTransitionDurationMs: number = 0;
  private transitionStartTime: number = 0;

  public recordFrame(dtSeconds: number): void {
    const frameTimeMs = dtSeconds * 1000;
    this.frameTimes[this.frameTimeIndex] = frameTimeMs;
    this.frameTimeIndex = (this.frameTimeIndex + 1) % 60;
    this.frameCount++;

    if (frameTimeMs > 66.6) {
      this.longFrameCount++;
    }

    if (dtSeconds > 0) {
      const instantFps = 1 / dtSeconds;
      if (this.frameCount > 60) {
        if (instantFps < this.minFps) this.minFps = Math.round(instantFps);
        if (instantFps > this.maxFps) this.maxFps = Math.round(instantFps);
      }
    }
  }

  public startTransition(): void {
    this.transitionStartTime = performance.now();
  }

  public endTransition(): void {
    if (this.transitionStartTime > 0) {
      this.lastTransitionDurationMs = Math.round(performance.now() - this.transitionStartTime);
      this.transitionCount++;
      this.transitionStartTime = 0;
    }
  }

  public getSnapshot(): PerformanceTelemetrySnapshot {
    let sum = 0;
    const sampleSize = Math.min(this.frameCount, 60);
    for (let i = 0; i < sampleSize; i++) {
      sum += this.frameTimes[i];
    }
    const avgMs = sampleSize > 0 ? sum / sampleSize : 16.6;
    const avgFps = avgMs > 0 ? Math.round(1000 / avgMs) : 60;

    return {
      averageFps: avgFps,
      minFps: this.minFps,
      maxFps: this.maxFps,
      averageFrameTimeMs: Math.round(avgMs * 100) / 100,
      longFrameCount: this.longFrameCount,
      transitionCount: this.transitionCount,
      lastTransitionDurationMs: this.lastTransitionDurationMs,
      version: GAME_VERSION,
    };
  }

  public reset(): void {
    this.frameTimes.fill(0);
    this.frameTimeIndex = 0;
    this.frameCount = 0;
    this.longFrameCount = 0;
    this.minFps = 60;
    this.maxFps = 60;
    this.transitionCount = 0;
    this.lastTransitionDurationMs = 0;
    this.transitionStartTime = 0;
  }
}

export const telemetry = new PerformanceTelemetry();

export interface GameHealthDashboard {
  version: string;
  status: 'OPTIMAL' | 'DEGRADED' | 'CRITICAL';
  telemetry: PerformanceTelemetrySnapshot;
  errorCount: number;
  recentErrors: unknown[];
  memoryHeapMB?: number;
}

export function getGameHealthDashboard(): GameHealthDashboard {
  const snap = telemetry.getSnapshot();
  const getLogs = typeof window !== 'undefined' ? (window as any).__getGameErrorLogs : null;
  const logs = getLogs ? getLogs() : [];
  const errorCount = logs.length;

  let status: 'OPTIMAL' | 'DEGRADED' | 'CRITICAL' = 'OPTIMAL';
  if (errorCount > 5 || snap.averageFps < 20) {
    status = 'CRITICAL';
  } else if (errorCount > 0 || snap.longFrameCount > 10 || snap.averageFps < 45) {
    status = 'DEGRADED';
  }

  let memoryHeapMB: number | undefined;
  if (typeof performance !== 'undefined' && (performance as any).memory) {
    memoryHeapMB = Math.round(((performance as any).memory.usedJSHeapSize / (1024 * 1024)) * 10) / 10;
  }

  return {
    version: GAME_VERSION,
    status,
    telemetry: snap,
    errorCount,
    recentErrors: logs,
    memoryHeapMB,
  };
}

if (typeof window !== 'undefined') {
  (window as any).__getGamePerformanceMetrics = () => telemetry.getSnapshot();
  (window as any).__getGameHealthDashboard = getGameHealthDashboard;
}
