// chrome.storage.sync caps a single item at ~8 KB. `siteProfiles` and `keymap`
// are user-growable, so a power user can cross that line — and a rejected
// `set` that silently drops the user's settings is the worst possible failure.
// This module measures size up front and reports a verdict the store acts on.

/** Chrome's per-item sync quota is 8 KB; warn well before the cliff. */
export const SYNC_ITEM_LIMIT_BYTES = 8192;
export const WARN_AT_FRACTION = 0.7;

export type QuotaVerdict = "ok" | "warn" | "exceeded";

export interface QuotaStatus {
  bytes: number;
  limitBytes: number;
  fraction: number;
  verdict: QuotaVerdict;
}

/** Estimate the serialized size of a value in UTF-8 bytes. */
export function estimateBytes(value: unknown): number {
  let json: string;
  try {
    json = JSON.stringify(value) ?? "";
  } catch {
    return Number.POSITIVE_INFINITY;
  }
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(json).length;
  }
  // Conservative fallback: worst-case 2 bytes per code unit.
  return json.length * 2;
}

/** Classify an estimated size against the sync item limit. */
export function quotaStatus(bytes: number): QuotaStatus {
  const fraction = bytes / SYNC_ITEM_LIMIT_BYTES;
  const verdict: QuotaVerdict = fraction >= 1 ? "exceeded" : fraction >= WARN_AT_FRACTION ? "warn" : "ok";
  return { bytes, limitBytes: SYNC_ITEM_LIMIT_BYTES, fraction, verdict };
}

/** Convenience: measure a settings object directly. */
export function measureSettings(settings: unknown): QuotaStatus {
  return quotaStatus(estimateBytes(settings));
}
