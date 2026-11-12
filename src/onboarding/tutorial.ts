import { tokenFromEvent } from "../keymap/tokens";
import type { ExtensionSettings } from "../types";
import { DOM_IDS } from "../ui/dom-ids";
import { Modal } from "../ui/modal";

// First-run interactive tutorial — the "zero learning cliff" promise made real
// (§3.18 / §5 Phase 4). Each step asks the user to press a real key; the tour
// only advances on the correct keystroke, so the muscle memory is built before
// the user is dropped into a live page.

interface Step {
  key: string;
  label: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  { key: "j", label: "j", title: "Scroll", body: "Press j to scroll down one step. k scrolls back up." },
  { key: "d", label: "d", title: "Half page", body: "Press d for half a page down. u goes half a page up." },
  { key: "f", label: "f", title: "Link hints", body: "Press f — every link gets a two-letter label. Type a label to jump straight to it." },
  { key: "Shift+F", label: "F", title: "Open in a new tab", body: "Press F to show hints that open in a new tab instead." },
  { key: "?", label: "?", title: "Cheat sheet", body: "Press ? any time to see every shortcut, searchable." },
  { key: ":", label: ":", title: "Command palette", body: "Press : to run any command by name — or type a URL." },
];

export class TutorialController extends Modal {
  private readonly settings: ExtensionSettings;
  private readonly onFinish: () => void;
  private readonly titleEl: HTMLElement;
  private readonly bodyEl: HTMLElement;
  private readonly progressEl: HTMLElement;
  private readonly keyEl: HTMLElement;
  private index = 0;
  private advanced = false;

  constructor(settings: ExtensionSettings, onFinish: () => void) {
    // D6: the tour must own the keyboard. Mounting it under the palette's id
    // meant `anyModalOpen()` never saw it, so pressing `f` during the tour also
    // fired the real command on the page underneath. `DOM_IDS.tutorial` is in
    // MODAL_IDS, so page shortcuts are blocked while the tour is open.
    super(
      { id: DOM_IDS.tutorial, ariaLabel: "Getting started tour", onDismiss: () => onFinish() },
      settings,
    );
    this.settings = settings;
    this.onFinish = onFinish;

    this.panel.style.width = "min(520px, 92vw)";
    this.panel.style.marginTop = "14vh";
    this.panel.style.padding = "24px";
    this.panel.style.textAlign = "center";

    const brand = document.createElement("div");
    brand.textContent = "Welcome to Kestrel";
    Object.assign(brand.style, { color: "var(--k-accent)", fontWeight: "700", fontSize: "13px", letterSpacing: "0.08em" });

    this.titleEl = document.createElement("h2");
    this.titleEl.style.margin = "12px 0 6px";

    this.bodyEl = document.createElement("p");
    this.bodyEl.className = "kestrel-muted";
    this.bodyEl.style.margin = "0 0 18px";

    this.keyEl = document.createElement("div");
    Object.assign(this.keyEl.style, {
      display: "inline-block",
      padding: "6px 16px",
      borderRadius: "8px",
      fontFamily: "monospace",
      fontSize: "20px",
      fontWeight: "700",
      background: "var(--k-panel-alt)",
      border: "1px solid var(--k-border)",
    });

    this.progressEl = document.createElement("div");
    this.progressEl.className = "kestrel-muted";
    this.progressEl.style.marginTop = "18px";
    this.progressEl.style.fontSize = "12px";

    this.panel.append(brand, this.titleEl, this.bodyEl, this.keyEl, this.progressEl);
    this.renderStep();

    this.root.addEventListener("keydown", (e) => this.handleKey(e));
  }

  private handleKey(e: KeyboardEvent): void {
    const token = tokenFromEvent(e);
    const step = STEPS[this.index];
    if (!step) {
      e.preventDefault();
      this.finish();
      return;
    }
    if (token === step.key) {
      e.preventDefault();
      e.stopPropagation();
      this.advanced = true;
      this.index += 1;
      if (this.index >= STEPS.length) this.finish();
      else this.renderStep();
    }
    void this.settings;
  }

  private renderStep(): void {
    const step = STEPS[this.index];
    if (!step) return;
    this.titleEl.textContent = step.title;
    this.bodyEl.textContent = step.body;
    this.keyEl.textContent = step.label;
    this.progressEl.textContent = `Step ${this.index + 1} of ${STEPS.length} · Esc to skip`;
  }

  private finish(): void {
    if (!this.advanced) {
      this.onFinish();
      this.close();
      return;
    }
    this.progressEl.textContent = "You're all set — press ? anytime for help.";
    this.keyEl.textContent = "✓";
    this.onFinish();
    window.setTimeout(() => this.close(), 900);
  }
}
