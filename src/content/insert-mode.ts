import type { SiteProfile } from "../types";

// Layered insert-mode detection: tag -> contenteditable -> ARIA role ->
// site-profile override -> confidence score -> decision.
//
// Returns a confidence in [0,1] plus whether we definitively consider the
// element "editable". This reduces both false negatives (typing while the
// extension hijacks keys) and false positives (blocking nav on non-editable
// custom components) versus Vimium's simpler tag check.
//
// §3.12: `forceInsertSelectors` now walks the ancestor chain (a `<textarea>`
// inside `.chat-composer` is the normal DOM shape, and matching only the exact
// event target made the feature near-useless). The dead `_host` parameter,
// `isSiteDisabled` and `isFullDisable` are gone — the one disabled-site answer
// lives in `settings/site-policy.ts`.

const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);
const EDITABLE_ROLES = new Set(["textbox", "combobox", "searchbox", "spinbutton"]);
const NON_TEXT_INPUT_TYPES = new Set([
  "checkbox",
  "radio",
  "button",
  "submit",
  "reset",
  "range",
  "color",
  "file",
  "image",
]);

export interface InsertCheckResult {
  isEditable: boolean;
  confidence: number;
  /** The profile whose `forceInsertSelectors` matched, when one did. */
  matchedProfile?: string;
}

/**
 * Decide whether a key event should pass through untouched because the user is
 * typing. `profiles` is the resolved, host-specific profile list.
 */
export function detectInsertMode(
  el: EventTarget | null,
  profiles: SiteProfile[],
): InsertCheckResult {
  if (!el || !(el instanceof Element)) {
    return { isEditable: false, confidence: 0 };
  }
  const target = el as Element;
  let confidence = 0;

  // 1. Tag check.
  if (EDITABLE_TAGS.has(target.tagName)) {
    const type = (target as HTMLInputElement).type?.toLowerCase();
    confidence = type && NON_TEXT_INPUT_TYPES.has(type) ? 0.2 : 1;
  }

  // 2. contenteditable.
  if ((target as HTMLElement).isContentEditable) confidence = Math.max(confidence, 0.95);

  // 3. ARIA role.
  const role = target.getAttribute?.("role")?.toLowerCase();
  if (role && EDITABLE_ROLES.has(role)) confidence = Math.max(confidence, 0.9);

  // 4. contenteditable attribute (covers hosts where `isContentEditable` is off).
  if (target.getAttribute?.("contenteditable") === "true") confidence = Math.max(confidence, 0.95);

  // 5. Site-profile override: force insert-mode when a selector matches this
  //    element *or any ancestor* — the normal shape for a composer wrapper.
  const matchedProfile = matchingForceInsertProfile(target, profiles);
  if (matchedProfile) confidence = 1;

  return { isEditable: confidence >= 0.8, confidence, matchedProfile };
}

function matchingForceInsertProfile(
  target: Element,
  profiles: SiteProfile[],
): string | undefined {
  for (const p of profiles) {
    const selectors = p.forceInsertSelectors;
    if (!selectors?.length) continue;
    let node: Element | null = target;
    while (node && node !== document.body && node !== document.documentElement) {
      if (selectors.some((sel) => safeMatches(node as Element, sel))) return p.name;
      node = node.parentElement;
    }
  }
  return undefined;
}

function safeMatches(el: Element, selector: string): boolean {
  try {
    return el.matches(selector);
  } catch {
    return false;
  }
}
