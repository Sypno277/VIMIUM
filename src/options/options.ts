import { settingsStore } from "../storage/storage";
import type { ExtensionSettings } from "../types";

import { renderAccess } from "./tabs/access-tab";
import { renderBindings } from "./tabs/bindings-tab";
import { renderData } from "./tabs/data-tab";
import { renderHints } from "./tabs/hints-tab";
import { renderPrivacy } from "./tabs/privacy-tab";
import { renderScroll } from "./tabs/scroll-tab";
import { setCurrentSettings } from "./tabs/shared";
import { renderSites } from "./tabs/sites-tab";

// --------------------------------------------------------------------------
// Tab registry & active tab management
// --------------------------------------------------------------------------

type TabId = "keys" | "scroll" | "hints" | "sites" | "access" | "data" | "privacy";

const TAB_RENDERERS: Record<TabId, (root: HTMLElement) => void> = {
  keys: renderBindings,
  scroll: renderScroll,
  hints: renderHints,
  sites: renderSites,
  access: renderAccess,
  data: renderData,
  privacy: renderPrivacy,
};

let activeTab: TabId = "keys";

function getRootForTab(tab: TabId): HTMLElement | null {
  const map: Record<TabId, string> = {
    keys: "keymap-root",
    scroll: "scroll-root",
    hints: "hints-root",
    sites: "sites-root",
    access: "access-root",
    data: "data-root",
    privacy: "privacy-root",
  };
  return document.getElementById(map[tab]);
}

function renderTab(tab: TabId): void {
  const root = getRootForTab(tab);
  if (!root) return;
  const renderer = TAB_RENDERERS[tab];
  if (renderer) {
    renderer(root);
  }
}

function switchTab(tab: TabId, updateHash = true): void {
  activeTab = tab;
  const nav = document.getElementById("tabs");
  if (nav) {
    nav.querySelectorAll("button").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-tab") === tab);
    });
  }

  document.querySelectorAll("main section").forEach((sec) => {
    sec.classList.toggle("active", sec.id === tab);
  });

  renderTab(tab);

  if (updateHash && window.location.hash !== `#${tab}`) {
    history.replaceState(null, "", `#${tab}`);
  }
}

// --------------------------------------------------------------------------
// Quota & Sync status
// --------------------------------------------------------------------------

function updateSyncStatus(): void {
  const elStatus = document.getElementById("sync-status");
  if (!elStatus) return;

  const quota = settingsStore.getQuota();
  if (quota.usingLocalFallback) {
    elStatus.textContent = "Sync quota exceeded · using local storage";
    elStatus.style.color = "var(--danger)";
    return;
  }

  if (typeof chrome !== "undefined" && chrome.storage?.sync?.getBytesInUse) {
    chrome.storage.sync.getBytesInUse(null, (used: number) => {
      const kb = (used / 1024).toFixed(1);
      elStatus.textContent = `Synced (${kb} KB in use) · ${new Date().toLocaleTimeString()}`;
      elStatus.style.color = "var(--muted)";
    });
  } else {
    const kb = (quota.status.bytes / 1024).toFixed(1);
    elStatus.textContent = `Synced (~${kb} KB) · ${new Date().toLocaleTimeString()}`;
    elStatus.style.color = "var(--muted)";
  }
}

// --------------------------------------------------------------------------
// Bootstrap & Events
// --------------------------------------------------------------------------

function setupNavigation(): void {
  const nav = document.getElementById("tabs");
  if (nav) {
    nav.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest("button");
      if (!btn) return;
      const tab = btn.getAttribute("data-tab") as TabId;
      if (tab && TAB_RENDERERS[tab]) {
        switchTab(tab);
      }
    });
  }

  window.addEventListener("hashchange", () => {
    const hash = window.location.hash.replace(/^#/, "") as TabId;
    if (hash && TAB_RENDERERS[hash] && hash !== activeTab) {
      switchTab(hash, false);
    }
  });
}

async function load(): Promise<void> {
  setupNavigation();

  const settings: ExtensionSettings = await settingsStore.init();
  setCurrentSettings(settings);

  // Restore active tab from hash if valid
  const initialHash = window.location.hash.replace(/^#/, "") as TabId;
  if (initialHash && TAB_RENDERERS[initialHash]) {
    activeTab = initialHash;
  }

  switchTab(activeTab, false);
  updateSyncStatus();

  settingsStore.onChange((nextSettings) => {
    setCurrentSettings(nextSettings);
    // Targeted update: only re-render the current active tab
    renderTab(activeTab);
    updateSyncStatus();
  });

  settingsStore.onQuotaChange(() => {
    updateSyncStatus();
  });
}

void load();
