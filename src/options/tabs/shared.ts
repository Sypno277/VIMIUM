import { settingsStore } from "../../storage/storage";
import type { ExtensionSettings } from "../../types";

// Shared, presentation-only helpers for every options tab. Values always go
// through `settingsStore.update()` (read-modify-write) so two open windows can
// never clobber each other with a whole-object write (§3.16).

let counter = 0;

/** The latest settings snapshot; refreshed by the options shell on change. */
let current: ExtensionSettings | null = null;

export function setCurrentSettings(settings: ExtensionSettings): void {
  current = settings;
}

export function getSettings(): ExtensionSettings {
  if (!current) {
    throw new Error("options UI used before settings were loaded");
  }
  return current;
}

/** Create an element with props and children, text-safe by construction. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<Omit<HTMLElementTagNameMap[K], "style">> & { class?: string; style?: string } = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  const { style, class: className, ...rest } = props;
  if (className) node.className = className;
  if (style) node.setAttribute("style", style);
  Object.assign(node, rest);
  for (const child of children) {
    node.append(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

/** A titled card container. */
export function card(title: string, children: Node[] = []): HTMLElement {
  const c = el("div", { class: "card" });
  c.append(el("h2", {}, [title]));
  for (const child of children) c.append(child);
  return c;
}

export function paragraph(text: string): HTMLElement {
  return el("p", { class: "hint-spam" }, [text]);
}

/** Pair a label with its control using `for`/`id` so screen readers work. */
function labelled(labelText: string, control: HTMLElement): HTMLElement {
  const id = `opt-${++counter}`;
  control.id = id;
  const label = el("label", { htmlFor: id }, [labelText]);
  return el("div", { class: "row" }, [label, control]);
}

export function toggleRow(
  labelText: string,
  value: boolean,
  apply: (s: ExtensionSettings, v: boolean) => void,
): HTMLElement {
  const input = el("input", { type: "checkbox" });
  input.checked = value;
  input.addEventListener("change", () => {
    void settingsStore.update((s) => apply(s, input.checked));
  });
  return labelled(labelText, input);
}

export function numberRow(
  labelText: string,
  value: number,
  apply: (s: ExtensionSettings, v: number) => void,
  step = 1,
): HTMLElement {
  const input = el("input", { type: "number", value: String(value), step: String(step) });
  input.addEventListener("change", () => {
    const v = parseFloat(input.value);
    if (!Number.isNaN(v)) void settingsStore.update((s) => apply(s, v));
  });
  return labelled(labelText, input);
}

export function textRow(
  labelText: string,
  value: string,
  apply: (s: ExtensionSettings, v: string) => void,
): HTMLElement {
  const input = el("input", { type: "text", value });
  input.addEventListener("change", () => {
    void settingsStore.update((s) => apply(s, input.value));
  });
  return labelled(labelText, input);
}

export function selectRow<T extends string = string>(
  labelText: string,
  options: readonly T[] | T[],
  value: T,
  apply: (s: ExtensionSettings, v: T) => void,
): HTMLElement {
  const select = el("select");
  for (const option of options) {
    const opt = el("option", { value: option, textContent: option });
    if (option === value) opt.selected = true;
    select.append(opt);
  }
  select.addEventListener("change", () => {
    void settingsStore.update((s) => apply(s, select.value as T));
  });
  return labelled(labelText, select);
}

export function button(label: string, variant: "primary" | "ghost", onClick: () => void): HTMLButtonElement {
  const b = el("button", { class: variant, textContent: label });
  b.addEventListener("click", onClick);
  return b;
}
