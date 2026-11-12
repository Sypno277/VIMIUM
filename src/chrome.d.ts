// Minimal Chrome extension API typings covering the surfaces this project
// uses. Declared locally to avoid a heavy @types/chrome dependency download.
// Narrow dynamic seams (message payloads) are typed as `unknown` and validated
// in core/messages.ts rather than cast to `any`.

interface ChromeMessageSender {
  tab?: { id?: number; url?: string };
  frameId?: number;
  id?: string;
  url?: string;
}

interface ChromeTab {
  id?: number;
  url?: string;
  title?: string;
  pendingUrl?: string;
  active?: boolean;
  index?: number;
  windowId?: number;
  pinned?: boolean;
  mutedInfo?: { muted?: boolean };
}

interface StorageChange {
  oldValue?: unknown;
  newValue?: unknown;
}

interface ChromeStorageArea {
  get(keys?: string | string[] | null): Promise<Record<string, unknown>>;
  get(keys: string | string[] | null, callback: (items: Record<string, unknown>) => void): void;
  getBytesInUse?(keys?: string | string[] | null): Promise<number>;
  getBytesInUse?(keys: string | string[] | null, callback: (bytes: number) => void): void;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
  clear(): Promise<void>;
}

interface ChromeStorage {
  sync: ChromeStorageArea;
  local: ChromeStorageArea;
  managed?: ChromeStorageArea;
  onChanged?: {
    addListener(
      cb: (changes: Record<string, StorageChange>, areaName: string) => void,
    ): void;
    removeListener(cb: unknown): void;
  };
}

interface ChromeRuntime {
  id?: string;
  onInstalled: { addListener(cb: (details: { reason?: string }) => void): void };
  onStartup: { addListener(cb: () => void): void };
  onMessage: {
    addListener(
      cb: (
        message: unknown,
        sender: ChromeMessageSender,
        sendResponse: (r?: unknown) => void,
      ) => boolean | void,
    ): void;
    removeListener(cb: unknown): void;
  };
  sendMessage(message: unknown): Promise<unknown>;
  getURL(path: string): string;
  lastError?: { message?: string };
  openOptionsPage?(): Promise<void>;
}

interface ChromeTabs {
  query(queryInfo: Record<string, unknown>): Promise<ChromeTab[]>;
  get(tabId: number): Promise<ChromeTab>;
  update(id: number | undefined, updateProperties: Record<string, unknown>): Promise<ChromeTab | undefined>;
  remove(id: number | number[]): Promise<void>;
  create(createProperties: Record<string, unknown>): Promise<ChromeTab>;
  reload(id?: number, properties?: { bypassCache?: boolean }): Promise<void>;
  move?(tabId: number | number[], moveProperties: { index: number; windowId?: number }): Promise<ChromeTab | ChromeTab[]>;
  duplicate?(tabId: number): Promise<ChromeTab>;
  goBack?(id: number): Promise<void>;
  goForward?(id: number): Promise<void>;
  sendMessage(id: number, message: unknown): Promise<unknown>;
  onUpdated: {
    addListener(cb: (tabId: number, info: { status?: string; url?: string }, tab?: ChromeTab) => void): void;
    removeListener(cb: unknown): void;
  };
  onRemoved: {
    addListener(cb: (tabId: number, info: { windowId?: number; isWindowClosing?: boolean }) => void): void;
    removeListener(cb: unknown): void;
  };
  onActivated: {
    addListener(cb: (info: { tabId: number; windowId?: number }) => void): void;
    removeListener(cb: unknown): void;
  };
  onReplaced?: {
    addListener(cb: (addedTabId: number, removedTabId: number) => void): void;
  };
}

interface ChromeScripting {
  executeScript(injection: {
    target: { tabId: number; frameIds?: number[] };
    files?: string[];
    func?: (...args: unknown[]) => void;
    args?: unknown[];
  }): Promise<unknown[]>;
}

interface ChromeSessions {
  restore(sessionId?: string): Promise<unknown>;
}

interface ChromeCommands {
  onCommand: { addListener(cb: (command: string) => void): void };
  getAll(): Promise<{ name?: string; shortcut?: string; description?: string }[]>;
}

interface ChromeAction {
  onClicked: { addListener(cb: (tab: ChromeTab) => void): void };
  setTitle(details: { title: string; tabId?: number }): Promise<void>;
  setBadgeText(details: { text: string; tabId?: number }): Promise<void>;
  setBadgeBackgroundColor(details: { color: string; tabId?: number }): Promise<void>;
}

interface ChromeHistoryItem {
  url?: string;
  title?: string;
  lastVisitTime?: number;
  visitCount?: number;
  typedCount?: number;
}

interface ChromeHistory {
  search(query: { text: string; maxResults?: number; startTime?: number }): Promise<ChromeHistoryItem[]>;
}

interface ChromeBookmarkTreeNode {
  id: string;
  title: string;
  url?: string;
  dateAdded?: number;
  children?: ChromeBookmarkTreeNode[];
}

interface ChromeBookmarks {
  search(query: { title?: string; url?: string; query?: string }): Promise<ChromeBookmarkTreeNode[]>;
  getTree(): Promise<ChromeBookmarkTreeNode[]>;
}

interface ChromeI18n {
  getMessage(key: string, substitutions?: string | string[]): string;
}

interface ChromeWindows {
  create?(createData?: { tabId?: number; url?: string | string[]; focused?: boolean }): Promise<unknown>;
  update(windowId: number, info: { focused?: boolean }): Promise<unknown>;
  getCurrent(): Promise<{ id?: number }>;
}

declare const chrome: {
  storage: ChromeStorage;
  runtime: ChromeRuntime;
  tabs: ChromeTabs;
  scripting: ChromeScripting;
  sessions: ChromeSessions;
  commands?: ChromeCommands;
  action?: ChromeAction;
  history?: ChromeHistory;
  bookmarks?: ChromeBookmarks;
  i18n?: ChromeI18n;
  windows?: ChromeWindows;
};
