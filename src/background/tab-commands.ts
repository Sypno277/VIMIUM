import { createLogger } from "../core/logger";
import type { CommandName } from "../types";

// Tab / history commands that must run in the background (the content script
// has no access to `chrome.tabs`). This file is policy-free: it receives a
// command and does the tab-level thing.

const log = createLogger("tabs");

/** Run a tab/history-level command for the tab that sent it. */
export async function runTabCommand(command: CommandName, tabId?: number): Promise<void> {
  switch (command) {
    case "tabNext":
      return cycleTab(1);
    case "tabPrev":
      return cycleTab(-1);
    case "tabClose":
      return closeTab(tabId);
    case "tabRestore":
      return restoreTab();
    case "tabNew":
      await chrome.tabs.create({});
      return;
    case "moveTabLeft":
      return moveTab(-1);
    case "moveTabRight":
      return moveTab(1);
    case "moveTabToNewWindow":
      return moveTabToNewWindow();
    case "duplicateTab":
      return duplicateTab(tabId);
    case "togglePinTab":
      return togglePinTab(tabId);
    case "reload":
      return reloadTab(tabId, false);
    case "hardReload":
      return reloadTab(tabId, true);
    case "historyBack":
      if (tabId != null) await chrome.tabs.goBack?.(tabId);
      return;
    case "historyForward":
      if (tabId != null) await chrome.tabs.goForward?.(tabId);
      return;
    case "openOptions":
      return openOptions();
    default:
      log.debug("no background handler for", command);
      return;
  }
}

async function moveTab(delta: -1 | 1): Promise<void> {
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (active?.id == null || active.index == null) return;
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const newIndex = Math.max(0, Math.min(tabs.length - 1, active.index + delta));
  if (newIndex !== active.index && chrome.tabs.move) {
    await chrome.tabs.move(active.id, { index: newIndex });
  }
}

async function moveTabToNewWindow(): Promise<void> {
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (active?.id == null) return;
  if (chrome.windows?.create) {
    await chrome.windows.create({ tabId: active.id });
  }
}

async function duplicateTab(tabId?: number): Promise<void> {
  if (tabId != null && chrome.tabs.duplicate) {
    await chrome.tabs.duplicate(tabId);
    return;
  }
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (active?.id != null && chrome.tabs.duplicate) {
    await chrome.tabs.duplicate(active.id);
  }
}

async function togglePinTab(tabId?: number): Promise<void> {
  const targetId = tabId ?? (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id;
  if (targetId == null) return;
  const tab = await chrome.tabs.get(targetId);
  await chrome.tabs.update(targetId, { pinned: !tab.pinned });
}

async function cycleTab(delta: 1 | -1): Promise<void> {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  if (tabs.length === 0) return;
  const index = tabs.findIndex((t) => t.active);
  const next = tabs[(index + delta + tabs.length) % tabs.length];
  if (next?.id != null) await chrome.tabs.update(next.id, { active: true });
}

async function closeTab(tabId?: number): Promise<void> {
  if (tabId != null) {
    await chrome.tabs.remove(tabId);
    return;
  }
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (active?.id != null) await chrome.tabs.remove(active.id);
}

async function restoreTab(): Promise<void> {
  await chrome.sessions.restore();
}

async function reloadTab(tabId: number | undefined, hard: boolean): Promise<void> {
  if (tabId != null) {
    await chrome.tabs.reload(tabId, { bypassCache: hard });
    return;
  }
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (active?.id != null) await chrome.tabs.reload(active.id, { bypassCache: hard });
}

/** Open the options page, focusing an existing one if it is already open. */
export async function openOptions(hash = ""): Promise<void> {
  const base = chrome.runtime.getURL("options/options.html");
  const url = base + hash;
  const existing = await chrome.tabs.query({ url: base + "*" });
  if (existing[0]?.id != null) {
    await chrome.tabs.update(existing[0].id, { active: true, url });
  } else {
    await chrome.tabs.create({ url });
  }
}
