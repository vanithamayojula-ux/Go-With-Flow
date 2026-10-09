import React, { Component, ErrorInfo, ReactNode } from 'react';
import { GAME_VERSION } from '../version';

export interface GameErrorRecord {
  timestamp: number;
  message: string;
  subsystem?: string;
  worldId?: string;
  stack?: string;
  version: string;
}

const ERROR_BUFFER_LIMIT = 20;
const errorLogBuffer: GameErrorRecord[] = [];

/**
 * Record a game exception into the in-memory telemetry buffer.
 */
export function reportGameError(
  error: unknown,
  context?: { subsystem?: string; worldId?: string }
): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  const record: GameErrorRecord = {
    timestamp: Date.now(),
    message,
    subsystem: context?.subsystem || 'unknown',
    worldId: context?.worldId || 'sky-isles',
    stack,
    version: GAME_VERSION,
  };

  if (errorLogBuffer.length >= ERROR_BUFFER_LIMIT) {
    errorLogBuffer.shift();
  }
  errorLogBuffer.push(record);

  // In production, keep console log structured and clean
  console.error(`[GoWithFlow Engine Error] [${record.subsystem}] [${record.worldId}]:`, message);
}

/**
 * Access recent non-fatal runtime error records for diagnostics.
 */
export function getGameErrorLogs(): readonly GameErrorRecord[] {
  return errorLogBuffer;
}

/**
 * Install top-level browser runtime exception hooks.
 */
export function initErrorMonitoring(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('error', (event) => {
    reportGameError(event.error || event.message, { subsystem: 'window.onerror' });
  });

  window.addEventListener('unhandledrejection', (event) => {
    reportGameError(event.reason, { subsystem: 'window.unhandledrejection' });
  });

  (window as any).__getGameErrorLogs = getGameErrorLogs;
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

/**
 * Production-safe React Error Boundary for GoWithFlow.
 */
export class GameErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false, errorMessage: '' };
  public props: ErrorBoundaryProps;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.props = props;
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorMessage: error.message || 'Unknown runtime desync' };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    reportGameError(error, { subsystem: 'ReactErrorBoundary' });
    console.error('[GameErrorBoundary]', error, errorInfo);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleResetState = (): void => {
    try {
      localStorage.removeItem('skyflow_missions');
      localStorage.removeItem('skyflow_graphics_config');
    } catch {}
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950 text-white font-mono">
          <div className="max-w-md w-full p-6 sm:p-8 rounded-2xl bg-black/90 border-2 border-red-500/50 shadow-[0_0_50px_rgba(239,68,68,0.3)] text-center">
            <div className="inline-block px-3 py-1 mb-4 rounded border border-red-500/40 bg-red-950/60 text-red-400 text-xs font-black tracking-widest uppercase">
              // NEURAL SYSTEM FAULT
            </div>
            <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-orange-300 to-amber-200 mb-2 uppercase">
              Application Desync
            </h1>
            <p className="text-xs text-white/70 mb-4 leading-relaxed">
              A critical engine exception interrupted the rendering pipeline. The session state has been safely preserved.
            </p>
            <div className="p-3 mb-6 rounded-lg bg-white/5 border border-white/10 text-left overflow-x-auto text-[11px] text-red-300 font-mono">
              {this.state.errorMessage}
            </div>
            <div className="flex flex-col space-y-3">
              <button
                onClick={this.handleReload}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-black text-xs uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all cursor-pointer"
              >
                Re-initialize Neural Link (Reload)
              </button>
              <button
                onClick={this.handleResetState}
                className="w-full py-2.5 px-4 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                Reset Saved State & Reload
              </button>
            </div>
            <div className="mt-4 text-[10px] text-white/40">
              GoWithFlow v{GAME_VERSION}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
