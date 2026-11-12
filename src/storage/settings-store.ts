import { createLogger } from "../core/logger";
import { DEFAULT_SETTINGS, normalizeSettings, SETTINGS_VERSION } from "../settings/settings";
import type { ExtensionSettings } from "../types";

import { broadcastToActiveTab } from "./broadcast";
import { runMigrations } from "./migrations";
import { measureSettings, type QuotaStatus } from "./quota";

const log = createLogger("settings");

const SETTINGS_KEY = "settings";

/**
 * D5: which area currently holds the authoritative copy. Written whenever we
 * fall back to `storage.local`, and read back on load — otherwise a user whose
 * settings exceeded the 8 KB sync item limit saw their configuration silently
 * revert to the old sync copy on every reload.
 */
const LOCATION_KEY = "settingsLocation";
type StoreLocation = "sync" | "local";

export interface QuotaInfo {
  status: QuotaStatus;
  /** True once a sync write was rejected and we fell back to storage.local. */
  usingLocalFallback: boolean;
  lastError?: string;
}

function hasChrome(): boolean {
  return typeof chrome !== "undefined" && !!chrome.storage;
}

/**
 * Single writer for extension settings.
 *
 *  - reads sync, falling back to local (and back) so a quota overflow never
 *    silently strands a user's configuration;
 *  - runs versioned migrations before normalising;
 *  - listens to `chrome.storage.onChanged` so a sync push from another device
 *    (or another window) is picked up live, not just via our own broadcast.
 */
export class SettingsStore {
  private cache: ExtensionSettings = structuredClone(DEFAULT_SETTINGS);
  private listeners = new Set<(s: ExtensionSettings) => void>();
  private quotaListeners = new Set<(q: QuotaInfo) => void>();
  private quota: QuotaInfo = {
    status: measureSettings(DEFAULT_SETTINGS),
    usingLocalFallback: false,
  };
  private storageListenerAttached = false;

  async init(): Promise<ExtensionSettings> {
    this.attachStorageListener();
    const raw = await this.readRaw();
    const migrated = raw ? runMigrations(raw as Record<string, unknown>, SETTINGS_VERSION) : undefined;
    this.cache = normalizeSettings(migrated as Partial<ExtensionSettings> | undefined);
    this.refreshQuota();
    return this.cache;
  }

  get(): ExtensionSettings {
    return this.cache;
  }

  getQuota(): QuotaInfo {
    return this.quota;
  }

  onChange(fn: (s: ExtensionSettings) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  onQuotaChange(fn: (q: QuotaInfo) => void): () => void {
    this.quotaListeners.add(fn);
    return () => this.quotaListeners.delete(fn);
  }

  async save(settings: ExtensionSettings): Promise<void> {
    this.cache = normalizeSettings(settings);
    this.cache.version = SETTINGS_VERSION;
    this.refreshQuota();
    await this.write(this.cache);
    this.emit();
    await broadcastToActiveTab(this.cache);
    try {
      await chrome.runtime?.sendMessage?.({ type: "settings:changed", settings: this.cache });
    } catch {
      /* no listeners is fine */
    }
  }

  async update(mutator: (s: ExtensionSettings) => void): Promise<ExtensionSettings> {
    const next = structuredClone(this.cache);
    mutator(next);
    await this.save(next);
    return this.cache;
  }

  /** Write to sync, transparently falling back to local on a quota rejection. */
  private async write(settings: ExtensionSettings): Promise<void> {
    if (!hasChrome()) return;
    try {
      if (this.quota.status.verdict === "exceeded") {
        throw new Error(`settings exceed the sync item limit (${this.quota.status.bytes} bytes)`);
      }
      await chrome.storage.sync.set({ [SETTINGS_KEY]: settings });
      // The sync copy is authoritative again — clear any stale local marker so
      // a later reload does not resurrect the old local snapshot.
      await this.markLocation("sync");
      this.setQuota({ usingLocalFallback: false, lastError: undefined });
    } catch (err) {
      log.warn("sync write failed; falling back to storage.local", err);
      try {
        await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
        await this.markLocation("local");
        this.setQuota({
          usingLocalFallback: true,
          lastError: err instanceof Error ? err.message : String(err),
        });
      } catch (err2) {
        log.error("local fallback also failed — settings were not persisted", err2);
        this.setQuota({
          usingLocalFallback: true,
          lastError: err2 instanceof Error ? err2.message : String(err2),
        });
      }
    }
  }

  /**
   * Record which area holds the authoritative copy. The marker lives in
   * `storage.local` (tiny, never quota-constrained) so `readRaw()` can honour
   * a fallback that happened in a previous session.
   */
  private async markLocation(location: StoreLocation): Promise<void> {
    if (!hasChrome() || !chrome.storage.local) return;
    try {
      await chrome.storage.local.set({ [LOCATION_KEY]: location });
    } catch (err) {
      log.warn("failed to record the settings store location", err);
    }
  }

  private async readRaw(): Promise<Partial<ExtensionSettings> | undefined> {
    if (!hasChrome()) return undefined;
    try {
      // Query both areas (and the location marker) concurrently, for minimum
      // latency and resilience against Brave Sync restrictions.
      const [syncResult, localResult] = await Promise.allSettled([
        chrome.storage.sync ? chrome.storage.sync.get(SETTINGS_KEY) : Promise.resolve(null),
        chrome.storage.local
          ? chrome.storage.local.get([SETTINGS_KEY, LOCATION_KEY])
          : Promise.resolve(null),
      ]);

      const sync =
        syncResult.status === "fulfilled" && syncResult.value
          ? syncResult.value[SETTINGS_KEY]
          : undefined;
      const localItems =
        localResult.status === "fulfilled" && localResult.value
          ? (localResult.value as Record<string, unknown>)
          : undefined;
      const local = localItems?.[SETTINGS_KEY];
      const markedLocal = localItems?.[LOCATION_KEY] === "local";

      // D5: honour a previous quota fallback. Without this the new settings sit
      // in `local` while every reload reads the stale `sync` copy.
      if (markedLocal && local) {
        this.setQuota({ usingLocalFallback: true });
        return local as Partial<ExtensionSettings>;
      }
      if (sync) {
        this.setQuota({ usingLocalFallback: false });
        return sync as Partial<ExtensionSettings>;
      }
      if (local) {
        this.setQuota({ usingLocalFallback: true });
        return local as Partial<ExtensionSettings>;
      }
    } catch (err) {
      log.warn("failed to read settings", err);
    }
    return undefined;
  }

  private refreshQuota(): void {
    this.setQuota({ status: measureSettings(this.cache) });
  }

  private setQuota(patch: Partial<QuotaInfo>): void {
    this.quota = { ...this.quota, ...patch };
    if (patch.status === undefined) {
      this.quota.status = measureSettings(this.cache);
    }
    this.quotaListeners.forEach((l) => l(this.quota));
  }

  private emit(): void {
    this.listeners.forEach((l) => l(this.cache));
  }

  /** React to settings changed from another context (sync push, second window). */
  private attachStorageListener(): void {
    if (this.storageListenerAttached || !hasChrome() || !chrome.storage.onChanged) return;
    this.storageListenerAttached = true;
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync" && area !== "local") return;
      const change = changes[SETTINGS_KEY];
      if (!change) return;
      const next = normalizeSettings(change.newValue as Partial<ExtensionSettings>);
      this.cache = next;
      this.refreshQuota();
      this.emit();
    });
  }
}

export const settingsStore = new SettingsStore();
