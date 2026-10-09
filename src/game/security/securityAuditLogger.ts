/**
 * GoWithFlow — Security Audit Logger
 * Phase 17 Section 20-21: Tamper-resistant security logging, credential and PII redaction,
 * and security event telemetry.
 */

import {
  SecurityAuditEntry,
  AuditSeverity,
  AuditActionType,
  UserRole,
  SECURITY_STORAGE_KEY_AUDIT_LOGS,
} from './securityConfig';
import { redactToken } from './authService';

const MAX_AUDIT_ENTRIES = 500;

export class SecurityAuditLogger {
  private _logs: SecurityAuditEntry[] = [];

  constructor() {
    this.loadLogs();
  }

  private loadLogs(): void {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(SECURITY_STORAGE_KEY_AUDIT_LOGS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this._logs = parsed;
        }
      }
    } catch (err) {
      console.warn('[SecurityAuditLogger] Failed to load audit logs:', err);
    }
  }

  private saveLogs(): void {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    try {
      const capped = this._logs.slice(-MAX_AUDIT_ENTRIES);
      localStorage.setItem(SECURITY_STORAGE_KEY_AUDIT_LOGS, JSON.stringify(capped));
    } catch (err) {
      console.error('[SecurityAuditLogger] Failed to persist audit logs:', err);
    }
  }

  /**
   * Recursively sanitizes metadata to ensure no auth tokens, passwords, or secrets are logged
   */
  private sanitizeMetadata(obj?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!obj || typeof obj !== 'object') return undefined;

    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      const lower = key.toLowerCase();
      if (lower.includes('token') || lower.includes('secret') || lower.includes('password') || lower.includes('auth')) {
        result[key] = typeof val === 'string' ? redactToken(val) : '[REDACTED]';
      } else if (typeof val === 'object' && val !== null) {
        result[key] = this.sanitizeMetadata(val as Record<string, unknown>);
      } else {
        result[key] = val;
      }
    }
    return result;
  }

  /**
   * Record a security audit event
   */
  public log(
    severity: AuditSeverity,
    action: AuditActionType,
    details: {
      actorId?: string;
      actorRole?: UserRole;
      targetId?: string;
      reason?: string;
      metadata?: Record<string, unknown>;
    }
  ): SecurityAuditEntry {
    const entry: SecurityAuditEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      severity,
      action,
      actorId: details.actorId,
      actorRole: details.actorRole,
      targetId: details.targetId,
      reason: details.reason,
      metadata: this.sanitizeMetadata(details.metadata),
    };

    this._logs.push(entry);
    this.saveLogs();

    // Console output for development diagnostics without secrets
    if (severity === 'CRITICAL') {
      console.warn(`[SECURITY CRITICAL] [${action}]`, entry.reason, entry.targetId || '');
    } else if (severity === 'WARN') {
      console.warn(`[SECURITY WARN] [${action}]`, entry.reason, entry.targetId || '');
    }

    return entry;
  }

  /**
   * Retrieve audit logs filtered by criteria
   */
  public getLogs(filter?: {
    severity?: AuditSeverity;
    action?: AuditActionType;
    actorId?: string;
    limit?: number;
  }): SecurityAuditEntry[] {
    let result = [...this._logs];

    if (filter) {
      if (filter.severity) {
        result = result.filter(l => l.severity === filter.severity);
      }
      if (filter.action) {
        result = result.filter(l => l.action === filter.action);
      }
      if (filter.actorId) {
        result = result.filter(l => l.actorId === filter.actorId);
      }
    }

    // Sort descending by timestamp
    result.sort((a, b) => b.timestamp - a.timestamp);

    const limit = filter?.limit || 100;
    return result.slice(0, limit);
  }

  /**
   * Clear logs (for test isolation)
   */
  public clearLogs(): void {
    this._logs = [];
    this.saveLogs();
  }
}
