import { createLogger } from "../core/logger";

// §3.5: the manifest declared commands (including the reserved `_execute_action`)
// but nothing ever registered `chrome.commands.onCommand`, so the extension had
// no global keyboard entry point at all. This module wires the toolbar action and
// the three declared commands to messages the content script understands.

const log = createLogger("commands");

type OverlayKind = "palette" | "omnibar" | "omnibarNewTab" | "tabSearch";

/** Install the action-click and keyboard-command handlers. Idempotent. */
let installed = false;

export function installCommandsRouter(): void {
  if (installed) return;
  installed = true;

  chrome.commands?.onCommand.addListener((command) => {
    void handleCommand(command);
  });

  chrome.action?.onClicked.addListener((tab) => {
    void sendOverlayTo(tab.id, "palette");
  });
}

async function handleCommand(command: string): Promise<void> {
  switch (command) {
    case "_execute_action":
    case "open-palette":
      return sendOverlayToActive("palette");
    case "focus-omnibar":
      return sendOverlayToActive("omnibar");
    case "toggle-enabled":
      return toggleOnActive();
    default:
      log.debug("unknown command", command);
  }
}

async function sendOverlayToActive(overlay: OverlayKind): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await sendOverlayTo(tab?.id, overlay);
}

async function sendOverlayTo(tabId: number | undefined, overlay: OverlayKind): Promise<void> {
  if (tabId == null) return;
  try {
    await chrome.tabs.sendMessage(tabId, { type: "overlay:open", overlay });
  } catch {
    // If sendMessage failed, try on-demand injection in case the tab was opened before extension loaded
    try {
      if (chrome.scripting) {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ["assets/content.js"],
        });
        await chrome.tabs.sendMessage(tabId, { type: "overlay:open", overlay });
        return;
      }
    } catch {
      // Tab is restricted (brave://, chrome://, web store). Provide user feedback by opening options.
      if (overlay === "palette") {
        try {
          await chrome.runtime?.openOptionsPage?.();
        } catch {
          /* ignore */
        }
      }
    }
  }
}

async function toggleOnActive(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id == null) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "extension:toggle" });
  } catch {
    /* nothing to toggle */
  }
}
