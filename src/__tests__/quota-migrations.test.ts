import { describe, expect, it } from "vitest";

import { runMigrations } from "../storage/migrations";
import { estimateBytes, quotaStatus } from "../storage/quota";

describe("storage quota calculations", () => {
  it("estimates byte size correctly", () => {
    const payload = { test: "hello", num: 123 };
    const bytes = estimateBytes(payload);
    expect(bytes).toBeGreaterThan(0);
    expect(bytes).toBe(new TextEncoder().encode(JSON.stringify(payload)).length);
  });

  it("classifies quota status correctly", () => {
    // 8192 is SYNC_ITEM_LIMIT_BYTES; 70% is ~5734
    expect(quotaStatus(1000).verdict).toBe("ok");
    expect(quotaStatus(6000).verdict).toBe("warn");
    expect(quotaStatus(8500).verdict).toBe("exceeded");
  });
});

describe("versioned settings migrations", () => {
  it("migrates unversioned v0 settings to target version", () => {
    const legacy = {
      scroll: { step: 60 },
      telemetryOptIn: true,
    };

    const migrated = runMigrations(legacy, 2);
    expect(migrated.version).toBe(2);
    expect(migrated.telemetryOptIn).toBeUndefined();
    expect(Array.isArray(migrated.searchEngines)).toBe(true);
    expect((migrated.debug as { enabled: boolean }).enabled).toBe(false);
  });

  it("does not re-run older migrations if already at version", () => {
    const alreadyV2 = {
      version: 2,
      customField: "keep-me",
    };

    const result = runMigrations(alreadyV2, 2);
    expect(result.version).toBe(2);
    expect(result.customField).toBe("keep-me");
  });
});
