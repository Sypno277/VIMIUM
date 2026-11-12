// One channel for "settings changed". Kept separate from the store so the
// options page, the service worker and the content script all speak the same
// message, and so tests can import it without pulling in chrome.tabs.

import type { ExtMessage } from "../core/messages";
import type { ExtensionSettings } from "../types";


/** Payload sent whenever settings change anywhere. */
export function settingsChangedMessage(settings: ExtensionSettings): ExtMessage {
  return { type: "settings:changed", settings };
}

/**
 * Broadcast to every content script in the active tab. Best-effort: it must
 * never throw into a save path, and it must no-op cleanly outside Chrome.
 */
export async function broadcastToActiveTab(settings: ExtensionSettings): Promise<void> {
  try {
    const tabs = await chrome.tabs?.query({ active: true, currentWindow: true });
    if (!tabs) return;
    await Promise.all(
      tabs.map((tab) =>
        tab.id
          ? chrome.tabs.sendMessage(tab.id, settingsChangedMessage(settings)).catch(() => {})
          : Promise.resolve(),
      ),
    );
  } catch {
    /* ignore in non-extension contexts */
  }
}
