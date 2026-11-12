import type { Mode } from "../types";
import type { ExtensionSettings } from "../types";
import { setModeBadge } from "../ui/badge";

// One explicit state machine for "which mode owns the keyboard?". Previously
// the mode was scattered across `mode`, `charWait` and three `if` blocks in a
// 170-line controller (§3.21), which is how the two-answer site bug happened.
// Transitions are centralised here and the badge is updated on every change.

export class ModeMachine {
  private current: Mode = "normal";
  private settings: ExtensionSettings | undefined;

  get mode(): Mode {
    return this.current;
  }

  /** Provide the theme source used when painting the badge. */
  setSettings(settings: ExtensionSettings): void {
    this.settings = settings;
  }

  /** Transition to `next`. No-op (and no repaint) when already there. */
  enter(next: Mode): void {
    if (this.current === next) return;
    this.current = next;
    setModeBadge(next, next !== "normal", this.settings);
  }

  /** Return to normal and hide the badge. */
  reset(): void {
    this.enter("normal");
    setModeBadge("normal", false, this.settings);
  }

  is(mode: Mode): boolean {
    return this.current === mode;
  }
}
