import { describe, expect, it } from "vitest";

import { matchesSitePattern, parseSitePattern } from "../settings/site-match";

describe("site-match parser and matcher", () => {
  it("parses valid patterns correctly", () => {
    expect(parseSitePattern("example.com")).toEqual({
      host: "example.com",
      subdomainWildcard: false,
      pathPrefix: "",
      valid: true,
    });

    expect(parseSitePattern("*.slack.com")).toEqual({
      host: "slack.com",
      subdomainWildcard: true,
      pathPrefix: "",
      valid: true,
    });

    expect(parseSitePattern("https://github.com/settings")).toEqual({
      host: "github.com",
      subdomainWildcard: false,
      pathPrefix: "/settings",
      valid: true,
    });
  });

  it("handles malformed patterns", () => {
    expect(parseSitePattern("").valid).toBe(false);
    expect(parseSitePattern("   ").valid).toBe(false);
    expect(parseSitePattern("foo * bar").valid).toBe(false);
    expect(parseSitePattern("foo*bar.com").valid).toBe(false);
  });

  it("matches exact domain", () => {
    expect(matchesSitePattern("google.com", "google.com")).toBe(true);
    expect(matchesSitePattern("google.com", "https://google.com/search?q=test")).toBe(true);
    expect(matchesSitePattern("google.com", "mail.google.com")).toBe(false);
  });

  it("matches subdomain wildcard", () => {
    expect(matchesSitePattern("*.slack.com", "slack.com")).toBe(true);
    expect(matchesSitePattern("*.slack.com", "app.slack.com")).toBe(true);
    expect(matchesSitePattern("*.slack.com", "team.internal.slack.com")).toBe(true);
    expect(matchesSitePattern("*.slack.com", "not-slack.com")).toBe(false);
  });

  it("matches path prefix only when specified", () => {
    expect(matchesSitePattern("example.com/admin", "https://example.com/admin")).toBe(true);
    expect(matchesSitePattern("example.com/admin", "https://example.com/admin/users")).toBe(true);
    expect(matchesSitePattern("example.com/admin", "https://example.com/")).toBe(false);
    expect(matchesSitePattern("example.com/admin", "https://example.com/login")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(matchesSitePattern("GitHub.com", "https://GITHUB.com/repo")).toBe(true);
  });
});
