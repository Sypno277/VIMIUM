// Typed message protocol between the content script, the background service
// worker, and the options page. Every listener switches exhaustively on
// `type`, so a message with no handler is a compile error rather than a
// silent no-op (which is exactly how `enterFindMode` used to vanish).

import type { CommandName, ExtensionSettings } from "../types";

export interface OmnibarHistoryEntry {
  url: string;
  title: string;
  lastVisitTime: number;
  visitCount: number;
}

export interface OmnibarBookmarkEntry {
  url: string;
  title: string;
  dateAdded: number;
}

export interface TabEntry {
  id: number;
  url: string;
  title: string;
  active: boolean;
  index: number;
}

export type ExtMessage =
  // ---- broadcast: settings changed anywhere (content <- options/bg) ----
  | { type: "settings:changed"; settings: ExtensionSettings }
  // ---- content -> background: run a tab/history-level command ----
  | { type: "command"; command: CommandName }
  // ---- content -> background: open a URL (optionally scroll after load) ----
  | { type: "navigate"; url: string; x?: number; y?: number }
  // ---- content -> background: tell the active tab to open an overlay ----
  | { type: "overlay:open"; overlay: "palette" | "omnibar" | "omnibarNewTab" | "tabSearch" }
  // ---- omnibar data queries ----
  | { type: "history:query"; query: string; max: number }
  | { type: "bookmarks:query"; query: string; max: number }
  | { type: "tabs:list" }
  // ---- omnibar / tab-search actions ----
  | { type: "tab:activate"; tabId: number }
  | { type: "tab:close"; tabId: number }
  // ---- toggle the extension on the current site ----
  | { type: "extension:toggle" };

/** Query/response payloads keyed by the request message type. */
export interface MessageResponses {
  "history:query": OmnibarHistoryEntry[];
  "bookmarks:query": OmnibarBookmarkEntry[];
  "tabs:list": TabEntry[];
  "extension:toggle": { enabled: boolean };
}

/**
 * Validate an unknown value as an `ExtMessage`. Chrome delivers untyped
 * payloads, so every listener funnels through here first. Returns `null` for
 * anything that is not a message we recognise.
 */
export function narrowMessage(raw: unknown): ExtMessage | null {
  if (!raw || typeof raw !== "object") return null;
  const type = (raw as { type?: unknown }).type;
  if (typeof type !== "string") return null;
  const msg = raw as Record<string, unknown>;

  switch (type) {
    case "settings:changed":
      return isSettingsPayload(msg.settings)
        ? { type, settings: msg.settings as ExtensionSettings }
        : null;
    case "command":
      return typeof msg.command === "string"
        ? { type, command: msg.command as CommandName }
        : null;
    case "navigate":
      if (typeof msg.url !== "string") return null;
      return {
        type,
        url: msg.url,
        x: finiteOrUndefined(msg.x),
        y: finiteOrUndefined(msg.y),
      };
    case "overlay:open":
      return isOverlay(msg.overlay) ? { type, overlay: msg.overlay } : null;
    case "history:query":
      return typeof msg.query === "string" && typeof msg.max === "number"
        ? { type, query: msg.query, max: msg.max }
        : null;
    case "bookmarks:query":
      return typeof msg.query === "string" && typeof msg.max === "number"
        ? { type, query: msg.query, max: msg.max }
        : null;
    case "tabs:list":
      return { type };
    case "tab:activate":
      return typeof msg.tabId === "number" ? { type, tabId: msg.tabId } : null;
    case "tab:close":
      return typeof msg.tabId === "number" ? { type, tabId: msg.tabId } : null;
    case "extension:toggle":
      return { type };
    default:
      return null;
  }
}

function finiteOrUndefined(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function isOverlay(v: unknown): v is "palette" | "omnibar" | "omnibarNewTab" | "tabSearch" {
  return v === "palette" || v === "omnibar" || v === "omnibarNewTab" || v === "tabSearch";
}

function isSettingsPayload(v: unknown): boolean {
  return !!v && typeof v === "object" && "keymap" in (v as Record<string, unknown>);
}
/** True when a message expects a typed response from the background. */
export type RequestMessage = Extract<
  ExtMessage,
  { type: "history:query" | "bookmarks:query" | "tabs:list" | "extension:toggle" }
>;

/**
 * Send a request to the background and await its typed response. Returns `null`
 * outside a Chrome extension context or when the background rejects.
 */
export async function requestFromBackground<K extends RequestMessage["type"]>(
  message: Extract<ExtMessage, { type: K }>,
): Promise<MessageResponses[K] | null> {
  try {
    const res = await chrome.runtime.sendMessage(message);
    return (res ?? null) as MessageResponses[K] | null;
  } catch {
    return null;
  }
}

/** Fire-and-forget message to the background (never throws into a UI path). */
export function notifyBackground(message: ExtMessage): void {
  try {
    void chrome.runtime.sendMessage(message);
  } catch {
    /* no background in this context */
  }
}
