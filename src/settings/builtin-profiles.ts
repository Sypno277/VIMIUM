import type { SiteProfile } from "../types";

import { matchesSitePattern } from "./site-match";

// Curated per-site overrides so the extension avoids fighting the site's own
// shortcuts out of the box. These are automatically applied when
// `useBuiltinProfiles` is enabled and a site's domain matches.
//
// We avoid disabling the keys that the *site* actually uses (e.g. Gmail's "j/k"
// for moving between conversations) so we don't double-trigger; instead we only
// disable navigation keys that would conflict. Matching goes through the single
// `matchesSitePattern` implementation (see site-match.ts).
export const BUILTIN_PROFILES: SiteProfile[] = [
  {
    name: "Gmail",
    match: "mail.google.com",
    builtin: true,
    disabledCommands: ["scrollDown", "scrollUp", "historyBack", "historyForward"],
  },
  {
    name: "Google Docs / Sheets",
    match: "docs.google.com",
    builtin: true,
    disabledCommands: [
      "scrollDown",
      "scrollUp",
      "scrollLeft",
      "scrollRight",
      "scrollHalfDown",
      "scrollHalfUp",
      "openOmnibar",
    ],
  },
  {
    name: "YouTube",
    match: "youtube.com",
    builtin: true,
    disabledCommands: ["scrollHalfDown", "scrollHalfUp", "tabSearch"],
  },
  {
    name: "Slack",
    match: "*.slack.com",
    builtin: true,
    disabledCommands: ["scrollDown", "scrollUp", "scrollToTop", "scrollToBottom"],
  },
  {
    name: "Notion",
    match: "*.notion.so",
    builtin: true,
    disabledCommands: ["scrollHalfDown", "scrollHalfUp", "enterVisualMode"],
  },
  {
    name: "GitHub",
    match: "github.com",
    builtin: true,
    disabledCommands: [],
    keymapOverrides: { tabSearch: ["t"] },
  },
];

/** Returns the first built-in profile whose match pattern fits the URL. */
export function matchBuiltinProfile(url: string): SiteProfile | undefined {
  return BUILTIN_PROFILES.find((p) => matchesSitePattern(p.match, url));
}
