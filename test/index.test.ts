import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AtolFingerprint,
  IdentifyRequestError,
  isCollectionDisabled,
} from "../src/index";
import type { FingerprintConfig, IdentifyResult } from "../src/index";

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
    device_mismatch: false,
    device_shared: false,
    shared_user_count: 1,
    anomaly_score: 0,
  },
};

function stubFetch() {
  const fetchMock = vi.fn().mockImplementation(
    () => Promise.resolve(
      new Response(JSON.stringify(SERVER_RESULT), { status: 200 })
    )
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

  it("retains only allowlisted configuration fields", async () => {
    const sentinel = "sentinel-secret-legacy-config";
    const fp = await AtolFingerprint.load({
      endpoint: "https://api.example.test",
      apiKey: sentinel,
      sessionToken: sentinel,
    } as FingerprintConfig & {
      apiKey: string;
      sessionToken: string;
    });

    expect(JSON.stringify(fp)).not.toContain(sentinel);
    expect(fp).not.toHaveProperty("config");
    expect(fp).toHaveProperty("endpoint", "https://api.example.test");
  });

  it("identify() submits the collected signals and returns the server result", async () => {
    const fetchMock = stubFetch();
    const fp = await AtolFingerprint.load();

    const result = await fp.identify({
      authorize: async () => ({
        scheme: "Bearer",
        accessToken: "tenant_access_token_one",
      }),
    });

    expect(isCollectionDisabled(result)).toBe(false);
    expect(result).toEqual(SERVER_RESULT);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers["Authorization"]).toBe(
      "Bearer tenant_access_token_one"
    );
    const body = JSON.parse(init.body);
    expect(body.client_platform).toBe("browser");
    expect(body.client_signals).toEqual(fp.getSignals());
  });

  it("scopes an authorization owner to one identify operation", async () => {
    const fetchMock = stubFetch();
    const fp = await AtolFingerprint.load();

    await fp.identify({
      authorize: async () => ({
        scheme: "Bearer",
        accessToken: "tenant_access_token_one",
      }),
    });
    const missing = await fp.identify().catch((caught: unknown) => caught);

    const [, firstInit] = fetchMock.mock.calls[0];
    expect(firstInit.headers["Authorization"]).toBe(
      "Bearer tenant_access_token_one"
    );
    expect(missing).toMatchObject({
      code: "identify_authorization_required",
      status: null,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("identify() exposes only the closed server-rejection diagnostic", async () => {
    const sentinel = "sentinel-secret-server-response";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(sentinel, { status: 400 }))
    );
    const fp = await AtolFingerprint.load();

    const error = await fp.identify({
      authorize: async () => ({
        scheme: "Bearer",
        accessToken: "tenant_access_token",
      }),
    }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(IdentifyRequestError);
    expect(error).toMatchObject({
      code: "identify_http_rejected",
      status: 400,
      message: "Atol identify request was rejected with HTTP 400.",
    });
    expect(JSON.stringify(error)).not.toContain(sentinel);
    expect(String(error)).not.toContain(sentinel);
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

      const result = await fp.identify({
        authorize: async () => ({
          scheme: "Bearer",
          accessToken: "tenant_access_token",
        }),
      });
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
