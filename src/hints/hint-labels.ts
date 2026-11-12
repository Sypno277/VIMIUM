import type { HintTargetLike } from "../types";

// Generates unique, human-typeable hint labels.
//
//  - "letters": base-K over the configured charset, shorter labels first, with
//    home-row priority handing the cheapest labels to primary CTAs.
//  - "numbers": decimal labels (1, 2, ... 10, 11) — genuinely useful on
//    non-QWERTY / AZERTY / Dvorak layouts, where the letter home-row is wrong.
//  - "filtered": same labels as "letters"; the controller additionally narrows
//    by visible text, which is the "type a fragment of the link" workflow.

const HOME_ROW = "asdfghjkl";

export type HintStyle = "letters" | "numbers" | "filtered";

export interface HintLabelOptions {
  chars: string;
  style: HintStyle;
  homeRowPriority: boolean;
}

/** Index of `n` expressed in base-K using `chars` (n=0 -> chars[0]). */
function baseKLabel(n: number, chars: string): string {
  const k = chars.length;
  if (n === 0) return chars[0];
  let s = "";
  let x = n;
  while (x > 0) {
    s = chars[x % k] + s;
    x = Math.floor(x / k);
  }
  return s;
}

/** Lower score = better (shorter, more home-row aligned). */
function labelScore(label: string, chars: string, homeRowPriority: boolean): number {
  let score = label.length * 1000;
  if (homeRowPriority) {
    for (const ch of label) {
      const homeIdx = HOME_ROW.indexOf(ch);
      const baseIdx = chars.indexOf(ch);
      score += homeIdx >= 0 ? homeIdx : 100 + baseIdx;
    }
  } else {
    score += [...label].reduce((acc, ch) => acc + (chars.indexOf(ch) + 1), 0);
  }
  return score;
}

/**
 * Assign a hint label to every target. Returns an array parallel to `targets`
 * such that `result[i]` is the label for `targets[i]`.
 */
export function assignHintLabels(targets: HintTargetLike[], opts: HintLabelOptions): string[] {
  const count = targets.length;
  if (count === 0) return [];

  if (opts.style === "numbers") {
    return targets.map((_t, i) => String(i + 1));
  }

  const chars = opts.chars && opts.chars.length >= 2 ? opts.chars : "asdfghjkl";
  const poolSize = Math.max(count, chars.length + 1);
  const pool: string[] = [];
  for (let i = 0; i < poolSize; i++) pool.push(baseKLabel(i, chars));
  pool.sort((a, b) => labelScore(a, chars, opts.homeRowPriority) - labelScore(b, chars, opts.homeRowPriority));

  const order = targets.map((_t, i) => i);
  if (opts.homeRowPriority) {
    order.sort((a, b) => {
      const pa = targets[a].isPrimary ? 0 : 1;
      const pb = targets[b].isPrimary ? 0 : 1;
      return pa - pb;
    });
  }

  const result = new Array<string>(count);
  for (let rank = 0; rank < count; rank++) {
    result[order[rank]] = pool[rank];
  }
  return result;
}
