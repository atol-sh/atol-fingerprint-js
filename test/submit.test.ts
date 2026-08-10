import { afterEach, describe, expect, it, vi } from "vitest";

import { IdentifyRequestError, submitSignals } from "../src/submit";
import type {
  ClientSignals,
  IdentifyOptions,
  IdentifyResult,
} from "../src/types";

function makeSignals(): ClientSignals {
  return {
    canvas_data: "data:image/png;base64,abc",
    webgl_renderer: "Test GPU",
    webgl_vendor: "Test Vendor",
    webgl_extensions: ["EXT_test"],
    audio_data: "a1b2c3",
    fonts: ["Arial"],
    screen_width: 1920,
    screen_height: 1080,
    pixel_ratio: 2,
    color_depth: 24,
    hardware_concurrency: 8,
    device_memory: 8,
    languages: ["en-US"],
    platform: "MacIntel",
    user_agent_data: "{}",
    max_touch_points: 0,
    codecs: [],
    media_device_count: 3,
    css_preferences: { "prefers-color-scheme": "dark" },
    api_availability: { webdriver: false },
    math_fingerprint: "1,2,3",
    timezone: "Europe/Paris",
    mobile_id: "",
    app_attest: "",
    play_integrity: "",
    sensor_data: "",
    build_props: "",
  };
}

function makeResult(): IdentifyResult {
  return {
    device_id: "dev_01ABC",
    known: true,
    confidence: 0.92,
    new_device: false,
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
}

function okResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function bearerAuthorization(
  accessToken = "tenant_access_token"
): IdentifyOptions {
  return {
    authorize: async () => ({ scheme: "Bearer", accessToken }),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("submitSignals", () => {
  it("POSTs to /api/v1/devices/identify on the default endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(makeResult()));
    vi.stubGlobal("fetch", fetchMock);

    await submitSignals(makeSignals(), {}, bearerAuthorization());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.atol.sh/api/v1/devices/identify");
    expect(init.method).toBe("POST");
    expect(init.cache).toBe("no-store");
    expect(init.credentials).toBe("omit");
    expect(init.redirect).toBe("error");
    expect(init.referrerPolicy).toBe("no-referrer");
  });

  it("uses a custom endpoint and strips trailing slashes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(makeResult()));
    vi.stubGlobal("fetch", fetchMock);

    await submitSignals(
      makeSignals(),
      { endpoint: "https://api.example.test///" },
      bearerAuthorization()
    );

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example.test/api/v1/devices/identify");
  });

  it("sends client_signals and client_platform browser in the body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(makeResult()));
    vi.stubGlobal("fetch", fetchMock);

    const signals = makeSignals();
    await submitSignals(signals, {}, bearerAuthorization());

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(Object.keys(body).sort()).toEqual([
      "client_platform",
      "client_signals",
    ]);
    expect(body.client_platform).toBe("browser");
    expect(body.client_signals).toEqual(signals);
  });

  it("acquires Bearer authorization for the exact request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(makeResult()));
    vi.stubGlobal("fetch", fetchMock);
    const authorize = vi.fn().mockResolvedValue({
      scheme: "Bearer",
      accessToken: "tenant_access_token",
    });

    await submitSignals(makeSignals(), {}, { authorize });

    const [, init] = fetchMock.mock.calls[0];
    expect(authorize).toHaveBeenCalledWith({
      method: "POST",
      url: "https://api.atol.sh/api/v1/devices/identify",
    });
    expect(Object.isFrozen(authorize.mock.calls[0][0])).toBe(true);
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.headers["Authorization"]).toBe("Bearer tenant_access_token");
    expect(init.headers).not.toHaveProperty("DPoP");
  });

  it("sends an inseparable DPoP token and proof pair", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(makeResult()));
    vi.stubGlobal("fetch", fetchMock);

    await submitSignals(makeSignals(), {}, {
      authorize: async () => ({
        scheme: "DPoP",
        accessToken: "tenant_dpop_token",
        dpopProof: "request_bound_proof",
      }),
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers["Authorization"]).toBe("DPoP tenant_dpop_token");
    expect(init.headers.DPoP).toBe("request_bound_proof");
  });

  it("rejects a missing authorization owner before dispatch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const error = await submitSignals(makeSignals(), {}).catch(
      (caught: unknown) => caught
    );

    expect(error).toMatchObject({
      name: "IdentifyRequestError",
      code: "identify_authorization_required",
      status: null,
      message: "Atol identify requires an operation-scoped authorization owner.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("projects authorization failures without retaining caught values", async () => {
    const fetchMock = vi.fn();
    const sentinel = "sentinel-secret-authorization-error";
    vi.stubGlobal("fetch", fetchMock);

    const error = await submitSignals(makeSignals(), {}, {
      authorize: async () => {
        throw new Error(sentinel);
      },
    }).catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      name: "IdentifyRequestError",
      code: "identify_authorization_failed",
      status: null,
      message: "Atol identify authorization could not be acquired.",
    });
    expect(JSON.stringify(error)).not.toContain(sentinel);
    expect(String(error)).not.toContain(sentinel);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects mixed or invented authorization shapes before dispatch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const error = await submitSignals(makeSignals(), {}, {
      authorize: async () =>
        ({
          scheme: "Bearer",
          accessToken: "sentinel-secret-token",
          dpopProof: "invented-proof",
        }) as never,
    }).catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      code: "identify_authorization_failed",
      status: null,
    });
    expect(JSON.stringify(error)).not.toContain("sentinel-secret-token");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns the parsed server response", async () => {
    const expected = makeResult();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse(expected)));

    const result = await submitSignals(
      makeSignals(),
      {},
      bearerAuthorization()
    );
    expect(result).toEqual(expected);
  });

  it("projects non-2xx responses without consuming or retaining their body", async () => {
    const sentinel = "sentinel-secret-server-response";
    const response = new Response(sentinel, {
      status: 404,
      statusText: "Sentinel Secret Status",
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

    const error = await submitSignals(makeSignals(), {}, bearerAuthorization()).catch(
      (caught: unknown) => caught
    );

    expect(error).toBeInstanceOf(IdentifyRequestError);
    expect(error).toMatchObject({
      name: "IdentifyRequestError",
      code: "identify_http_rejected",
      status: 404,
      message: "Atol identify request was rejected with HTTP 404.",
    });
    expect(response.bodyUsed).toBe(false);
    expect(JSON.stringify(error)).not.toContain(sentinel);
    expect(String(error)).not.toContain(sentinel);
  });

  it("projects network failures without retaining the caught value", async () => {
    const sentinel = "sentinel-secret-network-value";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error(sentinel)));

    const error = await submitSignals(makeSignals(), {}, bearerAuthorization()).catch(
      (caught: unknown) => caught
    );

    expect(error).toMatchObject({
      name: "IdentifyRequestError",
      code: "identify_transport_failed",
      status: null,
      message: "Atol identify request could not reach the control plane.",
    });
    expect(JSON.stringify(error)).not.toContain(sentinel);
    expect(String(error)).not.toContain(sentinel);
  });

  it("projects invalid success bodies without retaining parser diagnostics", async () => {
    const sentinel = "sentinel-secret-invalid-json";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(sentinel, {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    const error = await submitSignals(makeSignals(), {}, bearerAuthorization()).catch(
      (caught: unknown) => caught
    );

    expect(error).toMatchObject({
      name: "IdentifyRequestError",
      code: "identify_response_invalid",
      status: 200,
      message: "Atol identify response did not match the response contract.",
    });
    expect(JSON.stringify(error)).not.toContain(sentinel);
    expect(String(error)).not.toContain(sentinel);
  });

  it("rejects a JSON response with missing or invented members", async () => {
    const malformed: Record<string, unknown> = {
      ...makeResult(),
      diagnostic: "sentinel-secret-success-diagnostic",
    };
    malformed.signals = {
      ...(malformed.signals as Record<string, unknown>),
    };
    delete (malformed.signals as Record<string, unknown>).device_shared;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse(malformed)));

    const error = await submitSignals(
      makeSignals(),
      {},
      bearerAuthorization()
    ).catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      name: "IdentifyRequestError",
      code: "identify_response_invalid",
      status: 200,
      message: "Atol identify response did not match the response contract.",
    });
    expect(JSON.stringify(error)).not.toContain(malformed.diagnostic);
    expect(String(error)).not.toContain(malformed.diagnostic);
  });

  it("rejects a success response with null smart signals", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        okResponse({
          ...makeResult(),
          signals: null,
        })
      )
    );

    const error = await submitSignals(
      makeSignals(),
      {},
      bearerAuthorization()
    ).catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      code: "identify_response_invalid",
      status: 200,
    });
  });
});
