import type { SearchEngine } from "../types";

// Keyword search-engine routing for the omnibar: `g foo` -> Google, `gh repo`
// -> GitHub, and so on. The engines are user-editable in Settings.

export interface EngineMatch {
  engine: SearchEngine;
  query: string;
}

/**
 * Match the leading keyword of `input` against a configured engine.
 * Returns null when no engine keyword matches or when the keyword is typed
 * without a trailing query (a bare `g` is far more likely to be a URL).
 */
export function matchEngine(input: string, engines: SearchEngine[]): EngineMatch | null {
  const trimmed = input.trimStart();
  if (!trimmed) return null;
  const space = trimmed.indexOf(" ");
  if (space === -1) return null;
  const keyword = trimmed.slice(0, space).toLowerCase();
  const query = trimmed.slice(space + 1).trim();
  if (!query) return null;

  // Longest keyword wins so `gh` is not shadowed by a hypothetical `g`.
  const candidates = [...engines].sort((a, b) => b.keyword.length - a.keyword.length);
  for (const engine of candidates) {
    if (engine.keyword.toLowerCase() === keyword) return { engine, query };
  }
  return null;
}

/** Resolve an engine template with a percent-encoded query. */
export function engineUrl(engine: SearchEngine, query: string): string {
  if (engine.urlTemplate.includes("%s")) {
    return engine.urlTemplate.replace("%s", encodeURIComponent(query));
  }
  return engine.urlTemplate + encodeURIComponent(query);
}

/** The engine used for a query that matches no keyword (default = first). */
export function defaultEngine(engines: SearchEngine[]): SearchEngine | undefined {
  return engines.find((e) => e.keyword === "g") ?? engines[0];
}

/** A short hint line describing the active engine, for the omnibar header. */
export function engineHint(engines: SearchEngine[]): string {
  return engines.map((e) => `${e.keyword} → ${e.name}`).join("  ·  ");
}
