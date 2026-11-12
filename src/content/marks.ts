import type { ExtensionSettings } from "../types";

// Persistent marks: stored in chrome.storage.local keyed by (tab-independent)
// so a mark survives reloads and, when the user opts in, across sessions.

export interface Mark {
  letter: string;
  x: number;
  y: number;
  url: string;
  createdAt: number;
}

const KEY = "marks";

export class MarksStore {
  private marks = new Map<string, Mark>();

  async init(): Promise<void> {
    try {
      const res = await chrome.storage.local.get(KEY);
      const raw = res[KEY] as Record<string, Mark> | undefined;
      if (raw) for (const [k, v] of Object.entries(raw)) this.marks.set(k, v);
    } catch {
      /* non-extension context */
    }
  }

  set(letter: string, x: number, y: number, url: string): void {
    this.marks.set(letter, { letter, x, y, url, createdAt: Date.now() });
    void this.persist();
  }

  get(letter: string): Mark | undefined {
    return this.marks.get(letter);
  }

  all(): Mark[] {
    return [...this.marks.values()];
  }

  async delete(letter: string): Promise<void> {
    this.marks.delete(letter);
    await this.persist();
  }

  private async persist(): Promise<void> {
    try {
      await chrome.storage.local.set({ [KEY]: Object.fromEntries(this.marks) });
    } catch {
      /* ignore */
    }
  }
}

/** Jump to a mark by restoring scroll to its absolute position. */
export function jumpToMark(mark: Mark, _settings: ExtensionSettings): boolean {
  if (mark.url === location.href) {
    window.scrollTo(mark.x, mark.y);
    return true;
  }
  // Different URL -> navigate first, then scroll after load.
  try {
    chrome.runtime.sendMessage({ type: "navigate", url: mark.url, x: mark.x, y: mark.y });
    return true;
  } catch {
    return false;
  }
}
