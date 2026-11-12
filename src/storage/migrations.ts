import { DEFAULT_SEARCH_ENGINES } from "../settings/settings";
import type { ExtensionSettings } from "../types";

// Versioned migrations. `settings-store.ts` runs every migration whose key is
// greater than the stored version, in ascending order, before normalising.
//
// Rule: a migration only reshapes; it must not import from consumers of the
// store (no cycles). Keep each one total and defensive.

export type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;

/**
 * v0 -> v1: the first release shipped no `searchEngines` and no `debug` group,
 * and carried an inert `telemetryOptIn` toggle which is now removed.
 */
const v1: Migration = (raw) => {
  const next = { ...raw };
  if (!Array.isArray(next.searchEngines)) next.searchEngines = DEFAULT_SEARCH_ENGINES;
  if (!next.debug || typeof next.debug !== "object") next.debug = { enabled: false };
  delete next.telemetryOptIn;
  next.version = 1;
  return next;
};

/**
 * v1 -> v2: `hints.style` gained the "filtered" variant; nothing to reshape,
 * but the version bump records that the shape is now current. (Kept as an
 * explicit no-op so the pattern is obvious to the next author.)
 */
const v2: Migration = (raw) => {
  const next = { ...raw };
  next.version = 2;
  return next;
};

/** Applied in ascending version order; index 0 handles "no version stored". */
export const MIGRATIONS: Record<number, Migration> = {
  0: v1,
  1: v2,
};

/**
 * Run every migration needed to bring `raw` up to `targetVersion`.
 * Returns a new object; never mutates the input.
 */
export function runMigrations(
  raw: Record<string, unknown>,
  targetVersion: number,
): Record<string, unknown> {
  let current = raw;
  let version = typeof current.version === "number" ? (current.version as number) : 0;

  // Sort keys numerically, run in order until we reach the target.
  const versions = Object.keys(MIGRATIONS)
    .map(Number)
    .filter((v) => Number.isFinite(v))
    .sort((a, b) => a - b);

  for (const from of versions) {
    if (from < version) continue;
    if (version >= targetVersion) break;
    const migrate = MIGRATIONS[from];
    current = migrate(current);
    version = typeof current.version === "number" ? (current.version as number) : from + 1;
  }
  return current;
}

/** True when `raw` is older than the running schema. */
export function needsMigration(raw: Partial<ExtensionSettings> | undefined): boolean {
  if (!raw) return true;
  return typeof raw.version !== "number" || raw.version < LATEST_VERSION_FROM_MIGRATIONS();
}

function LATEST_VERSION_FROM_MIGRATIONS(): number {
  const versions = Object.keys(MIGRATIONS).map(Number);
  return versions.length ? Math.max(...versions) + 1 : 0;
}
