import type { ExtensionSettings } from "../../types";

import { card, getSettings, numberRow, selectRow, textRow, toggleRow } from "./shared";

const STYLES: readonly ("letters" | "numbers" | "filtered")[] = ["letters", "numbers", "filtered"];

export function renderHints(root: HTMLElement): void {
  const settings = getSettings();
  root.replaceChildren();

  const wrap = card("Link hints", [
    textRow(
      "Hint characters",
      settings.hints.chars,
      (s: ExtensionSettings, v: string) => { s.hints.chars = v; },
    ),
    selectRow<"letters" | "numbers" | "filtered">(
      "Style",
      STYLES,
      settings.hints.style,
      (s: ExtensionSettings, v: "letters" | "numbers" | "filtered") => { s.hints.style = v; },
    ),
    toggleRow(
      "Home-row priority",
      settings.hints.homeRowPriority,
      (s: ExtensionSettings, v: boolean) => { s.hints.homeRowPriority = v; },
    ),
    toggleRow(
      "Smart filtering (hide decorative)",
      settings.hints.smartFiltering,
      (s: ExtensionSettings, v: boolean) => { s.hints.smartFiltering = v; },
    ),
    numberRow(
      "Font scale",
      settings.hints.fontSizeScale,
      (s: ExtensionSettings, v: number) => { s.hints.fontSizeScale = v; },
      0.1,
    ),
  ]);

  root.append(wrap);
}
