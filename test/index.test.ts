import { afterEach, describe, expect, it, vi } from "vitest";

import { AtolFingerprint, isCollectionDisabled } from "../src/index";
import type { IdentifyResult } from "../src/index";

const SERVER_RESULT: IdentifyResult = {
  device_id: "dev_01XYZ",
  known: false,
  confidence: 0.81,
  new_device: true,
  platform: "browser",
  browser: "Chrome",
  os_version: "14.5",
  signals: {
    bot: false,
    vpn: false,
    proxy: false,
    tor: false,
    incognito: false,
    tampered: false,
    emulator: false,
    rooted: false,
    geo_mismatch: false,
    anomaly_score: 0,
  },
};

function stubFetch() {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(SERVER_RESULT), { status: 200 })
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function setGPC(value: boolean | undefined) {
  Object.defineProperty(navigator, "globalPrivacyControl", {
    configurable: true,
    value,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  setGPC(undefined);
});

describe("AtolFingerprint", () => {
  it("load() collects signals once and getSignals() returns them", async () => {
    const fp = await AtolFingerprint.load();
    const signals = fp.getSignals();

    expect(isCollectionDisabled(signals)).toBe(false);
    if (!isCollectionDisabled(signals)) {
      expect(typeof signals.math_fingerprint).toBe("string");
      expect(signals.mobile_id).toBe("");
    }
    expect(fp.disabled).toBe(false);
  });

  it("identify() submits the collected signals and returns the server result", async () => {
    const fetchMock = stubFetch();
    const fp = await AtolFingerprint.load({ apiKey: "ak_live_1" });

    const result = await fp.identify();

    expect(isCollectionDisabled(result)).toBe(false);
    expect(result).toEqual(SERVER_RESULT);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers["Authorization"]).toBe("Bearer ak_live_1");
    const body = JSON.parse(init.body);
    expect(body.client_platform).toBe("browser");
    expect(body.client_signals).toEqual(fp.getSignals());
  });

  it("identify({ token }) overrides the configured apiKey", async () => {
    const fetchMock = stubFetch();
    const fp = await AtolFingerprint.load({ apiKey: "ak_live_1" });

    await fp.identify({ token: "oidc_access_token" });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers["Authorization"]).toBe("Bearer oidc_access_token");
  });

  it("identify() propagates server errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("authentication required", { status: 400 }))
    );
    const fp = await AtolFingerprint.load();

    await expect(fp.identify()).rejects.toThrow(/Atol identify request failed: 400/);
  });

  describe("disabled option", () => {
    it("skips collection and reports disabled state", async () => {
      const fp = await AtolFingerprint.load({ disabled: true });
      expect(fp.disabled).toBe(true);

      const signals = fp.getSignals();
      expect(isCollectionDisabled(signals)).toBe(true);
      if (isCollectionDisabled(signals)) {
        expect(signals.reason).toBe("config");
      }
    });

    it("identify() is a network no-op returning CollectionDisabled", async () => {
      const fetchMock = stubFetch();
      const fp = await AtolFingerprint.load({ disabled: true });

      const result = await fp.identify();

      expect(isCollectionDisabled(result)).toBe(true);
      if (isCollectionDisabled(result)) {
        expect(result.reason).toBe("config");
      }
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("never fabricates signal data when disabled", async () => {
      const fp = await AtolFingerprint.load({ disabled: true });
      const result = await fp.identify();

      expect(result).not.toHaveProperty("device_id");
      expect(result).not.toHaveProperty("signals");
      expect(fp.getSignals()).not.toHaveProperty("canvas_data");
    });
  });

  describe("Global Privacy Control", () => {
    it("disables collection by default when GPC is set", async () => {
      setGPC(true);
      const fetchMock = stubFetch();

      const fp = await AtolFingerprint.load();
      expect(fp.disabled).toBe(true);

      const result = await fp.identify();
      expect(isCollectionDisabled(result)).toBe(true);
      if (isCollectionDisabled(result)) {
        expect(result.reason).toBe("gpc");
      }
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("collects normally when GPC is absent or false", async () => {
      setGPC(false);
      const fp = await AtolFingerprint.load();
      expect(fp.disabled).toBe(false);
      expect(isCollectionDisabled(fp.getSignals())).toBe(false);
    });

    it("respectGPC: false overrides the GPC signal", async () => {
      setGPC(true);
      stubFetch();

      const fp = await AtolFingerprint.load({ respectGPC: false });
      expect(fp.disabled).toBe(false);

      const result = await fp.identify();
      expect(isCollectionDisabled(result)).toBe(false);
    });

    it("explicit disabled wins over respectGPC: false", async () => {
      setGPC(true);
      const fp = await AtolFingerprint.load({ disabled: true, respectGPC: false });
      expect(fp.disabled).toBe(true);

      const result = await fp.identify();
      expect(isCollectionDisabled(result)).toBe(true);
      if (isCollectionDisabled(result)) {
        expect(result.reason).toBe("config");
      }
    });
  });
});
