import { afterEach, describe, expect, it, vi } from "vitest";

import { collectSignals } from "../src/collect";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  // Remove navigator overrides installed via Object.defineProperty.
  for (const prop of ["userAgentData", "mediaDevices", "storage"]) {
    delete (navigator as unknown as Record<string, unknown>)[prop];
  }
});

describe("collectSignals", () => {
  it("returns every ClientSignals field with the correct type", async () => {
    const s = await collectSignals();

    expect(typeof s.canvas_data).toBe("string");
    expect(typeof s.webgl_renderer).toBe("string");
    expect(typeof s.webgl_vendor).toBe("string");
    expect(Array.isArray(s.webgl_extensions)).toBe(true);
    expect(typeof s.audio_data).toBe("string");
    expect(Array.isArray(s.fonts)).toBe(true);
    expect(typeof s.screen_width).toBe("number");
    expect(typeof s.screen_height).toBe("number");
    expect(typeof s.pixel_ratio).toBe("number");
    expect(typeof s.color_depth).toBe("number");
    expect(typeof s.hardware_concurrency).toBe("number");
    expect(typeof s.device_memory).toBe("number");
    expect(Array.isArray(s.languages)).toBe(true);
    expect(typeof s.platform).toBe("string");
    expect(typeof s.user_agent_data).toBe("string");
    expect(typeof s.max_touch_points).toBe("number");
    expect(Array.isArray(s.codecs)).toBe(true);
    expect(typeof s.media_device_count).toBe("number");
    expect(typeof s.css_preferences).toBe("object");
    expect(typeof s.api_availability).toBe("object");
    expect(typeof s.math_fingerprint).toBe("string");
    expect(typeof s.timezone).toBe("string");
  });

  it("sends empty strings for native-only fields from a browser context", async () => {
    const s = await collectSignals();
    expect(s.mobile_id).toBe("");
    expect(s.app_attest).toBe("");
    expect(s.play_integrity).toBe("");
    expect(s.sensor_data).toBe("");
    expect(s.build_props).toBe("");
  });

  it("computes a deterministic 22-value math fingerprint", async () => {
    const a = await collectSignals();
    const b = await collectSignals();

    expect(a.math_fingerprint).toBe(b.math_fingerprint);
    const values = a.math_fingerprint.split(",");
    expect(values).toHaveLength(22);
    expect(values[0]).toBe(Math.tan(1).toString());
    expect(values[8]).toBe(Math.sqrt(2).toString());
    expect(values[20]).toBe(Math.hypot(3, 4).toString());
  });

  it("falls back to an empty canvas hash when getContext throws", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => {
      throw new Error("canvas blocked");
    });

    const s = await collectSignals();
    expect(s.canvas_data).toBe("");
    expect(s.webgl_renderer).toBe("");
    expect(s.webgl_vendor).toBe("");
    expect(s.webgl_extensions).toEqual([]);
  });

  it("falls back to empty WebGL info when no WebGL context is available", async () => {
    // happy-dom has no real WebGL; getContext returns null for webgl modes.
    const s = await collectSignals();
    expect(s.webgl_renderer).toBe("");
    expect(s.webgl_vendor).toBe("");
    expect(s.webgl_extensions).toEqual([]);
  });

  it("falls back to an empty audio hash when OfflineAudioContext is missing", async () => {
    const s = await collectSignals();
    expect(s.audio_data).toBe("");
  });

  it("falls back to an empty audio hash when OfflineAudioContext throws", async () => {
    vi.stubGlobal(
      "OfflineAudioContext",
      class {
        constructor() {
          throw new Error("audio blocked");
        }
      }
    );

    const s = await collectSignals();
    expect(s.audio_data).toBe("");
  });

  it("filters codecs through MediaSource.isTypeSupported", async () => {
    vi.stubGlobal("MediaSource", {
      isTypeSupported: (codec: string) => codec.includes("vp9") || codec.includes("opus"),
    });

    const s = await collectSignals();
    expect(s.codecs).toEqual(['video/webm; codecs="vp9"', 'audio/webm; codecs="opus"']);
  });

  it("returns an empty codec list when MediaSource is unavailable", async () => {
    const s = await collectSignals();
    expect(s.codecs).toEqual([]);
  });

  it("reports only the media device COUNT, never labels", async () => {
    const devices = [
      { kind: "audioinput", label: "Internal Microphone", deviceId: "a" },
      { kind: "videoinput", label: "FaceTime HD Camera", deviceId: "b" },
      { kind: "audiooutput", label: "Speakers", deviceId: "c" },
    ];
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { enumerateDevices: async () => devices },
    });

    const s = await collectSignals();
    expect(s.media_device_count).toBe(3);
    expect(JSON.stringify(s)).not.toContain("FaceTime");
    expect(JSON.stringify(s)).not.toContain("Internal Microphone");
  });

  it("reports zero media devices when enumeration fails", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        enumerateDevices: async () => {
          throw new Error("denied");
        },
      },
    });

    const s = await collectSignals();
    expect(s.media_device_count).toBe(0);
  });

  it("serializes UA-CH high-entropy values when available", async () => {
    Object.defineProperty(navigator, "userAgentData", {
      configurable: true,
      value: {
        getHighEntropyValues: async (hints: string[]) => ({
          architecture: "arm",
          model: "",
          platformVersion: "14.5.0",
          hints,
        }),
      },
    });

    const s = await collectSignals();
    const parsed = JSON.parse(s.user_agent_data);
    expect(parsed.architecture).toBe("arm");
    expect(parsed.platformVersion).toBe("14.5.0");
    expect(parsed.hints).toContain("architecture");
    expect(parsed.hints).toContain("model");
    expect(parsed.hints).toContain("platformVersion");
  });

  it("falls back to navigator.userAgent when UA-CH is unavailable", async () => {
    const s = await collectSignals();
    expect(s.user_agent_data).toBe(navigator.userAgent);
  });

  it("collects automation markers in api_availability", async () => {
    const s = await collectSignals();
    for (const key of [
      "webdriver",
      "phantom",
      "nightmare",
      "selenium",
      "playwright",
      "puppeteer_cdc",
      "dom_automation",
      "zero_plugins",
      "zero_window_size",
      "connection_rtt_zero",
      "notification_inconsistency",
      "missing_accept_language",
      "incognito",
    ]) {
      expect(typeof s.api_availability[key], `api_availability.${key}`).toBe("boolean");
    }
  });

  it("flags injected automation globals", async () => {
    (window as unknown as Record<string, unknown>)["_phantom"] = true;
    (window as unknown as Record<string, unknown>)["__pwInitScripts"] = {};

    const s = await collectSignals();
    expect(s.api_availability.phantom).toBe(true);
    expect(s.api_availability.playwright).toBe(true);

    delete (window as unknown as Record<string, unknown>)["_phantom"];
    delete (window as unknown as Record<string, unknown>)["__pwInitScripts"];
  });

  it("flags incognito when the storage quota is small", async () => {
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: { estimate: async () => ({ quota: 100_000_000, usage: 0 }) },
    });

    const s = await collectSignals();
    expect(s.api_availability.incognito).toBe(true);
  });

  it("does not flag incognito with a normal storage quota", async () => {
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: { estimate: async () => ({ quota: 50_000_000_000, usage: 0 }) },
    });

    const s = await collectSignals();
    expect(s.api_availability.incognito).toBe(false);
  });

  it("collects screen metrics and hardware info from the environment", async () => {
    const s = await collectSignals();
    expect(s.screen_width).toBe(screen.width);
    expect(s.screen_height).toBe(screen.height);
    expect(s.color_depth).toBe(screen.colorDepth);
    expect(s.pixel_ratio).toBeGreaterThan(0);
    expect(s.languages).toEqual(Array.from(navigator.languages || []));
    expect(s.timezone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone || "");
  });
});
