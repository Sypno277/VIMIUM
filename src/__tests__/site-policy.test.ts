import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS } from "../settings/settings";
import { resolveSitePolicy } from "../settings/site-policy";
import type { ExtensionSettings } from "../types";

describe("site-policy resolution", () => {
  it("folds user profile keymapOverrides over base keymap (satisfying §3.4)", () => {
    const settings: ExtensionSettings = {
      ...DEFAULT_SETTINGS,
      keymap: { scrollDown: ["j"], scrollUp: ["k"] },
      siteProfiles: [
        {
          name: "Test Site",
          match: "example.com",
          keymapOverrides: { scrollDown: ["n"] },
        },
      ],
    };

    const policy = resolveSitePolicy(settings, { url: "https://example.com/page" });
    expect(policy.isDisabled).toBe(false);
    expect(policy.keymap.scrollDown).toEqual(["n"]);
    expect(policy.keymap.scrollUp).toEqual(["k"]);
  });

  it("disables commands specified in active profiles", () => {
    const settings: ExtensionSettings = {
      ...DEFAULT_SETTINGS,
      siteProfiles: [
        {
          name: "Test Exclude",
          match: "example.com",
          disabledCommands: ["scrollDown", "hintOpen"],
        },
      ],
    };

    const policy = resolveSitePolicy(settings, { url: "https://example.com" });
    expect(policy.isCommandDisabled("scrollDown")).toBe(true);
    expect(policy.isCommandDisabled("hintOpen")).toBe(true);
    expect(policy.isCommandDisabled("scrollUp")).toBe(false);
  });

  it("identifies fully disabled sites and tracks the matching pattern", () => {
    const settings: ExtensionSettings = {
      ...DEFAULT_SETTINGS,
      disabledSites: ["*.bank.com", "example.com/admin"],
    };

    const bankPolicy = resolveSitePolicy(settings, { url: "https://secure.bank.com/login" });
    expect(bankPolicy.isDisabled).toBe(true);
    expect(bankPolicy.disabledBy).toEqual({ pattern: "*.bank.com", kind: "disabledSites" });

    const adminPolicy = resolveSitePolicy(settings, { url: "https://example.com/admin/dashboard" });
    expect(adminPolicy.isDisabled).toBe(true);
    expect(adminPolicy.disabledBy).toEqual({ pattern: "example.com/admin", kind: "disabledSites" });

    const normalPolicy = resolveSitePolicy(settings, { url: "https://example.com/public" });
    expect(normalPolicy.isDisabled).toBe(false);
  });
});
