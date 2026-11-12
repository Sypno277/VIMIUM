// The ONE site-pattern matcher. Both user profiles and `disabledSites` route
// through here so a pattern can never mean two different things depending on
// which code path asked (the root cause of the §3.13 divergence).
//
// Documented semantics:
//  - Matching is case-insensitive.
//  - A leading `*.` matches the bare domain and any subdomain
//    (`*.slack.com` matches `slack.com` and `app.slack.com`).
//  - A pattern with **no path** matches the whole host (any path/query/hash).
//  - A pattern **with a path** matches `host + pathname` by prefix, so
//    `example.com/admin` matches `example.com/admin/users` but NOT
//    `example.com/` — the user asked for a narrower scope and gets exactly it.
//  - Malformed patterns (empty, spaces, invalid wildcard use) never match.

export interface ParsedPattern {
  /** Host portion, lowercased. May be empty for a malformed pattern. */
  host: string;
  /** True when the pattern started with `*.`. */
  subdomainWildcard: boolean;
  /** Path prefix including the leading slash, or "" when no path was given. */
  pathPrefix: string;
  /** False when the pattern could not be parsed; never match in that case. */
  valid: boolean;
}

/** Parse a pattern into its host / path parts. Pure and total. */
export function parseSitePattern(pattern: string): ParsedPattern {
  const raw = (pattern ?? "").trim();
  if (!raw || /\s/.test(raw)) {
    return { host: "", subdomainWildcard: false, pathPrefix: "", valid: false };
  }

  // Strip an optional scheme so `https://example.com/x` also works.
  let rest = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  // Drop any userinfo and port is kept in host matching below.
  const slash = rest.indexOf("/");
  const hostPart = slash === -1 ? rest : rest.slice(0, slash);
  const pathPart = slash === -1 ? "" : rest.slice(slash);

  // Drop a query/hash from the path portion.
  rest = "";
  const cleanPath = pathPart.replace(/[?#].*$/, "");

  let host = hostPart.toLowerCase();
  let subdomainWildcard = false;
  if (host.startsWith("*.")) {
    subdomainWildcard = true;
    host = host.slice(2);
  }
  // A remaining `*` anywhere is not a pattern we support -> invalid.
  if (host.includes("*")) {
    return { host: "", subdomainWildcard: false, pathPrefix: "", valid: false };
  }
  if (!host) {
    return { host: "", subdomainWildcard: false, pathPrefix: "", valid: false };
  }
  return { host, subdomainWildcard, pathPrefix: cleanPath, valid: true };
}

/**
 * Does `pattern` match the page described by `url` (a full URL) and/or `host`?
 * Accepts either a full URL string or a bare host.
 */
export function matchesSitePattern(pattern: string, urlOrHost: string): boolean {
  const p = parseSitePattern(pattern);
  if (!p.valid) return false;
  if (typeof urlOrHost !== "string" || !urlOrHost) return false;

  const target = toHostAndPath(urlOrHost);
  if (!target) return false;

  // Host check.
  const hostOk = p.subdomainWildcard
    ? target.host === p.host || target.host.endsWith("." + p.host)
    : target.host === p.host;
  if (!hostOk) return false;

  // Path check (only when the pattern specified one).
  if (p.pathPrefix) {
    return target.path.startsWith(p.pathPrefix);
  }
  return true;
}

function toHostAndPath(urlOrHost: string): { host: string; path: string } | null {
  let raw = urlOrHost.trim();
  if (!raw) return null;
  // Bare host (no scheme): treat the whole thing as host unless it has a `/`.
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    if (raw.includes("/")) raw = "http://" + raw;
    else return { host: raw.toLowerCase(), path: "/" };
  }
  try {
    const u = new URL(raw);
    return { host: u.hostname.toLowerCase(), path: u.pathname || "/" };
  } catch {
    return null;
  }
}
