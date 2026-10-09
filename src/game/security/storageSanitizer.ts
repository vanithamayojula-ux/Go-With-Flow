/**
 * GoWithFlow — Local Storage Hardening & Sanitization Service
 * Phase 17 Section 28: Defensive parsing, prototype pollution defense, XSS injection filtering,
 * and graceful fallback recovery against corrupted or tampered local storage payloads.
 */

export class StorageSanitizer {
  /**
   * Deeply cleans an object of prototype pollution vectors and malicious script injections
   */
  public static sanitizeObject<T>(input: unknown): T | null {
    if (typeof input === 'string') {
      return input
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/onerror=/gi, '')
        .replace(/onload=/gi, '') as unknown as T;
    }

    if (input === null || typeof input !== 'object') {
      return (input as T) ?? null;
    }

    if (Array.isArray(input)) {
      return input.map(item => this.sanitizeObject(item)) as unknown as T;
    }

    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      // Prototype pollution block
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue;
      }

      if (typeof value === 'string') {
        // Strip out script tags and inline event handlers
        clean[key] = value
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/onerror=/gi, '')
          .replace(/onload=/gi, '');
      } else if (typeof value === 'number') {
        // Guarantee finite numbers (reject NaN / Infinity)
        clean[key] = Number.isFinite(value) ? value : 0;
      } else if (typeof value === 'object' && value !== null) {
        clean[key] = this.sanitizeObject(value);
      } else {
        clean[key] = value;
      }
    }

    return clean as T;
  }

  /**
   * Safely retrieves and parses an item from localStorage with defensive sanitization
   */
  public static safeGetItem<T>(key: string, fallback: T): T {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return fallback;
    }

    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;

      const parsed = JSON.parse(raw);
      if (parsed === null || parsed === undefined) return fallback;

      const sanitized = this.sanitizeObject<T>(parsed);
      return sanitized ?? fallback;
    } catch (err) {
      console.warn(`[StorageSanitizer] Corrupted data for key "${key}", falling back safely:`, err);
      return fallback;
    }
  }

  /**
   * Safely serializes and persists an item to localStorage
   */
  public static safeSetItem<T>(key: string, value: T): boolean {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return false;
    }

    try {
      const sanitized = this.sanitizeObject(value);
      localStorage.setItem(key, JSON.stringify(sanitized));
      return true;
    } catch (err) {
      console.error(`[StorageSanitizer] Failed to persist key "${key}":`, err);
      return false;
    }
  }
}
