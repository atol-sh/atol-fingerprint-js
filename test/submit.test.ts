import { afterEach, describe, expect, it, vi } from "vitest";

import { submitSignals } from "../src/submit";
import type { ClientSignals, IdentifyResult } from "../src/types";

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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("submitSignals", () => {
  it("POSTs to /api/v1/devices/identify on the default endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(makeResult()));
    vi.stubGlobal("fetch", fetchMock);

    await submitSignals(makeSignals(), {});

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.atol.sh/api/v1/devices/identify");
    expect(init.method).toBe("POST");
  });

  it("uses a custom endpoint and strips trailing slashes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(makeResult()));
    vi.stubGlobal("fetch", fetchMock);

    await submitSignals(makeSignals(), { endpoint: "https://api.example.test///" });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example.test/api/v1/devices/identify");
  });

  it("sends client_signals and client_platform browser in the body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(makeResult()));
    vi.stubGlobal("fetch", fetchMock);

    const signals = makeSignals();
    await submitSignals(signals, {});

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.client_platform).toBe("browser");
    expect(body.client_signals).toEqual(signals);
  });

  it("sets Content-Type and Authorization headers when apiKey is present", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(makeResult()));
    vi.stubGlobal("fetch", fetchMock);

    await submitSignals(makeSignals(), { apiKey: "ak_test_123" });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.headers["Authorization"]).toBe("Bearer ak_test_123");
  });

  it("omits the Authorization header when no apiKey is configured", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(makeResult()));
    vi.stubGlobal("fetch", fetchMock);

    await submitSignals(makeSignals(), {});

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers["Authorization"]).toBeUndefined();
  });

  it("returns the parsed server response", async () => {
    const expected = makeResult();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse(expected)));

    const result = await submitSignals(makeSignals(), {});
    expect(result).toEqual(expected);
  });

  it("throws on non-2xx with the status and response body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("organization not found", { status: 404, statusText: "Not Found" })
      )
    );

    await expect(submitSignals(makeSignals(), {})).rejects.toThrow(
      /Atol identify request failed: 404.*organization not found/
    );
  });

  it("throws on 500 even when the error body is unreadable", async () => {
    const response = new Response(null, { status: 500, statusText: "Internal Server Error" });
    vi.spyOn(response, "text").mockRejectedValue(new Error("stream error"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

    await expect(submitSignals(makeSignals(), {})).rejects.toThrow(
      /Atol identify request failed: 500/
    );
  });

  it("propagates network errors from fetch", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(submitSignals(makeSignals(), {})).rejects.toThrow("Failed to fetch");
  });
});
