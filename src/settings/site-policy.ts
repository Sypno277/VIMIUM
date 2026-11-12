// The ONE place that answers "what applies on this host?". Every consumer
// (keymap resolution, insert-mode detection, command disabling) reads this
// result, so the two-answer bug in §3.4 is impossible by construction.

import type { CommandName, ExtensionSettings, KeyChord, SitePolicy, SiteProfile } from "../types";

import { BUILTIN_PROFILES } from "./builtin-profiles";
import { matchesSitePattern } from "./site-match";

type Keymap = Partial<Record<CommandName, KeyChord[]>>;

/** Minimal page descriptor so the policy is testable without a real `location`. */
export interface PageContext {
  /** Full URL, e.g. `https://example.com/admin?x=1`. */
  url: string;
}

/**
 * Resolve the active profiles for a page:
 *  - the built-in profile (when `useBuiltinProfiles`), then
 *  - every matching user profile, in declared order (later wins on overrides).
 * Disabled-site matching also reports *which* pattern matched, for the UI.
 */
export function resolveSitePolicy(settings: ExtensionSettings, page: PageContext): SitePolicy {
  const { url } = page;

  let disabledBy: SitePolicy["disabledBy"];
  for (const pattern of settings.disabledSites) {
    if (matchesSitePattern(pattern, url)) {
      disabledBy = { pattern, kind: "disabledSites" };
      break;
    }
  }

  const profiles: SiteProfile[] = [];
  if (settings.useBuiltinProfiles) {
    const builtin = BUILTIN_PROFILES.find((p) => matchesSitePattern(p.match, url));
    if (builtin) profiles.push(builtin);
  }
  for (const p of settings.siteProfiles) {
    if (matchesSitePattern(p.match, url)) profiles.push(p);
  }

  const keymap = foldKeymap(settings.keymap, profiles);
  const disabledCommands = new Set<CommandName>();
  for (const p of profiles) {
    for (const c of p.disabledCommands ?? []) disabledCommands.add(c);
  }

  return {
    profiles,
    isDisabled: disabledBy !== undefined,
    disabledBy,
    keymap,
    isCommandDisabled(command: CommandName): boolean {
      return disabledCommands.has(command);
    },
  };
}

/** Fold profile keymap overrides over the base keymap, later profiles winning. */
function foldKeymap(base: Keymap, profiles: SiteProfile[]): Keymap {
  let out = base;
  let cloned = false;
  for (const p of profiles) {
    if (!p.keymapOverrides) continue;
    if (!cloned) {
      out = { ...base };
      cloned = true;
    }
    for (const [name, chords] of Object.entries(p.keymapOverrides)) {
      if (chords) out[name as CommandName] = chords;
    }
  }
  return out;
}

/** Convenience: a policy for a page that matches nothing (used in tests). */
export function emptyPolicy(settings: ExtensionSettings): SitePolicy {
  return resolveSitePolicy(settings, { url: "https://example.invalid/" });
}
