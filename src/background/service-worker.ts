import { createLogger } from "../core/logger";
import { narrowMessage, type ExtMessage } from "../core/messages";
import { settingsStore } from "../storage/storage";

import { installCommandsRouter } from "./commands-router";
import { installNavigationListener, navigateAndScroll } from "./navigation";
import {
  activateTab,
  closeTab,
  listTabs,
  queryBookmarks,
  queryHistory,
} from "./omnibar-data";
import { runTabCommand } from "./tab-commands";

// The service worker routes and nothing else: it validates every message with
// the typed protocol, dispatches to a focused module, and answers queries. All
// decision-making lives in the content script or the options page.

const log = createLogger("background");

installNavigationListener();
installCommandsRouter();

chrome.runtime.onInstalled.addListener(async () => {
  void settingsStore.init();
  try {
    const tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });
    for (const tab of tabs) {
      if (tab.id != null) {
        chrome.scripting
          .executeScript({
            target: { tabId: tab.id },
            files: ["assets/content.js"],
          })
          .catch(() => {});
      }
    }
  } catch {
    /* ignore tabs query or scripting failure */
  }
});

chrome.runtime.onStartup.addListener(() => {
  void settingsStore.init();
});

chrome.runtime.onMessage.addListener(
  (raw: unknown, sender, sendResponse): boolean | void => {
    const msg = narrowMessage(raw);
    if (!msg) return;
    const tabId = sender?.tab?.id;

    switch (msg.type) {
      // ---- fire-and-forget -------------------------------------------------
      case "settings:changed":
      case "overlay:open":
        return;
      case "command":
        void runTabCommand(msg.command, tabId);
        return;
      case "navigate":
        void navigateAndScroll(msg.url, msg.x, msg.y);
        return;
      case "tab:activate":
        void activateTab(msg.tabId);
        return;
      case "tab:close":
        void closeTab(msg.tabId);
        return;
      case "extension:toggle":
        // Handled by the content script; nothing for the background to do.
        return;

      // ---- request / response ---------------------------------------------
      case "history:query":
        void respond(sendResponse, queryHistory(msg.query, msg.max));
        return true;
      case "bookmarks:query":
        void respond(sendResponse, queryBookmarks(msg.query, msg.max));
        return true;
      case "tabs:list":
        void respond(sendResponse, listTabs());
        return true;
      default:
        return assertNever(msg);
    }
  },
);

async function respond<T>(sendResponse: (r?: unknown) => void, work: Promise<T>): Promise<void> {
  try {
    sendResponse(await work);
  } catch (err) {
    log.warn("query failed", err);
    sendResponse(null);
  }
}

/** Compile-time exhaustiveness guard: every message type must be handled. */
function assertNever(message: never): void {
  void message;
}

// Keep the worker's settings cache warm so broadcasts have a source of truth.
void settingsStore.init();

// Reference the type so the import is retained for tooling.
export type { ExtMessage };
