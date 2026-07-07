import { describe, expect, it } from "vitest";

import { isCollectionDisabled } from "../src/types";
import type { CollectionDisabled, IdentifyResult } from "../src/types";

describe("isCollectionDisabled", () => {
  it("returns true for a CollectionDisabled result", () => {
    const disabled: CollectionDisabled = { collection_disabled: true, reason: "config" };
    expect(isCollectionDisabled(disabled)).toBe(true);
  });

  it("returns true for the gpc reason variant", () => {
    const disabled: CollectionDisabled = { collection_disabled: true, reason: "gpc" };
    expect(isCollectionDisabled(disabled)).toBe(true);
  });

  it("returns false for an IdentifyResult", () => {
    const result: IdentifyResult = {
      device_id: "dev_1",
      known: false,
      confidence: 0.5,
      new_device: true,
      platform: "browser",
      browser: "Firefox",
      os_version: "",
      signals: null,
    };
    expect(isCollectionDisabled(result)).toBe(false);
  });

  it("returns false for primitives and null", () => {
    expect(isCollectionDisabled(null)).toBe(false);
    expect(isCollectionDisabled(undefined)).toBe(false);
    expect(isCollectionDisabled("disabled")).toBe(false);
    expect(isCollectionDisabled(true)).toBe(false);
    expect(isCollectionDisabled({})).toBe(false);
  });

  it("requires collection_disabled to be exactly true", () => {
    expect(isCollectionDisabled({ collection_disabled: "true" })).toBe(false);
    expect(isCollectionDisabled({ collection_disabled: 1 })).toBe(false);
  });
});
