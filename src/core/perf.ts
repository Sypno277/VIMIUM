// Tiny performance instrumentation behind the debug flag. Used to hold the
// budgets the plan sets (first hint paint < 50 ms, re-filter < 8 ms) without
// shipping overhead when debug is off.

import { isDebugEnabled } from "./logger";

const marks = new Map<string, number>();

/** Mark the start of a measured phase. No-op unless debug is enabled. */
export function perfStart(label: string): void {
  if (!isDebugEnabled() || typeof performance === "undefined") return;
  marks.set(label, performance.now());
}

/**
 * End a measured phase and return the elapsed milliseconds (also logged when
 * debug is on). Returns 0 when the mark is missing or debug is off.
 */
export function perfEnd(label: string): number {
  if (!isDebugEnabled() || typeof performance === "undefined") return 0;
  const start = marks.get(label);
  if (start === undefined) return 0;
  marks.delete(label);
  return performance.now() - start;
}

/** Measure a synchronous function, returning both its value and duration. */
export function measure<T>(label: string, fn: () => T): { value: T; ms: number } {
  perfStart(label);
  const value = fn();
  const ms = perfEnd(label);
  return { value, ms };
}
