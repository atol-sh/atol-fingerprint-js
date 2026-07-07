import type { ClientSignals } from "./types";

// ---------------------------------------------------------------------------
// Canvas fingerprint
// ---------------------------------------------------------------------------

function collectCanvas(): string {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 280;
    canvas.height = 60;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    // Text rendering — varies across GPU, OS font rasterizer, sub-pixel AA
    ctx.textBaseline = "alphabetic";
    ctx.font = "14px 'Arial'";
    ctx.fillStyle = "#f60";
    ctx.fillRect(100, 1, 62, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("Atol fp \ud83c\udf10", 2, 15);
    ctx.fillStyle = "rgba(102,204,0,0.7)";
    ctx.fillText("Atol fp \ud83c\udf10", 4, 45);

    // Gradient — exercises compositing path
    const gradient = ctx.createLinearGradient(0, 0, 280, 0);
    gradient.addColorStop(0, "#f00");
    gradient.addColorStop(0.5, "#0f0");
    gradient.addColorStop(1, "#00f");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 50, 280, 10);

    // Arc + bezier — GPU path rasterization
    ctx.beginPath();
    ctx.arc(50, 30, 20, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(170, 10);
    ctx.bezierCurveTo(180, 50, 210, 50, 220, 10);
    ctx.stroke();

    return canvas.toDataURL();
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// WebGL fingerprint
// ---------------------------------------------------------------------------

interface WebGLInfo {
  renderer: string;
  vendor: string;
  extensions: string[];
}

function collectWebGL(): WebGLInfo {
  const empty: WebGLInfo = { renderer: "", vendor: "", extensions: [] };
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");
    if (!gl || !(gl instanceof WebGLRenderingContext || gl instanceof WebGL2RenderingContext)) {
      return empty;
    }

    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = dbg ? (gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) as string) : "";
    const vendor = dbg ? (gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) as string) : "";
    const extensions = gl.getSupportedExtensions() ?? [];

    return { renderer, vendor, extensions };
  } catch {
    return empty;
  }
}

// ---------------------------------------------------------------------------
// AudioContext fingerprint
// ---------------------------------------------------------------------------

async function collectAudio(): Promise<string> {
  try {
    const OfflineCtx =
      window.OfflineAudioContext ||
      (window as unknown as Record<string, unknown>).webkitOfflineAudioContext;
    if (!OfflineCtx) return "";

    const ctx = new (OfflineCtx as typeof OfflineAudioContext)(1, 44100, 44100);
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(10000, ctx.currentTime);

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.setValueAtTime(-50, ctx.currentTime);
    comp.knee.setValueAtTime(40, ctx.currentTime);
    comp.ratio.setValueAtTime(12, ctx.currentTime);
    comp.attack.setValueAtTime(0, ctx.currentTime);
    comp.release.setValueAtTime(0.25, ctx.currentTime);

    osc.connect(comp);
    comp.connect(ctx.destination);
    osc.start(0);

    const rendered = await ctx.startRendering();
    const data = rendered.getChannelData(0);

    // Simple hash of the first 500 samples
    let hash = 0;
    for (let i = 0; i < Math.min(data.length, 500); i++) {
      hash = ((hash << 5) - hash + Math.round(data[i] * 1000000)) | 0;
    }
    return hash.toString(36);
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Font detection
// ---------------------------------------------------------------------------

const TEST_FONTS = [
  "Arial",
  "Arial Black",
  "Calibri",
  "Cambria",
  "Comic Sans MS",
  "Consolas",
  "Courier New",
  "Georgia",
  "Helvetica",
  "Impact",
  "Lucida Console",
  "Lucida Sans Unicode",
  "Microsoft Sans Serif",
  "Palatino Linotype",
  "Segoe UI",
  "Tahoma",
  "Times New Roman",
  "Trebuchet MS",
  "Verdana",
  "Menlo",
  "Monaco",
  "SF Pro",
  "SF Mono",
  "Roboto",
  "Noto Sans",
  "Ubuntu",
  "Cantarell",
  "DejaVu Sans",
  "Fira Code",
  "Source Code Pro",
];

function collectFonts(): string[] {
  try {
    const baseFonts = ["monospace", "sans-serif", "serif"] as const;
    const testString = "mmmmmmmmmmlli";
    const testSize = "72px";

    const span = document.createElement("span");
    span.style.position = "absolute";
    span.style.left = "-9999px";
    span.style.top = "-9999px";
    span.style.fontSize = testSize;
    span.style.lineHeight = "normal";
    span.textContent = testString;
    document.body.appendChild(span);

    // Measure baseline widths
    const baseWidths: Record<string, number> = {};
    for (const base of baseFonts) {
      span.style.fontFamily = base;
      baseWidths[base] = span.offsetWidth;
    }

    const detected: string[] = [];
    for (const font of TEST_FONTS) {
      let found = false;
      for (const base of baseFonts) {
        span.style.fontFamily = `'${font}', ${base}`;
        if (span.offsetWidth !== baseWidths[base]) {
          found = true;
          break;
        }
      }
      if (found) detected.push(font);
    }

    document.body.removeChild(span);
    return detected;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Media / codecs
// ---------------------------------------------------------------------------

const CODEC_TESTS = [
  'video/mp4; codecs="avc1.42E01E"',
  'video/mp4; codecs="avc1.64001F"',
  'video/mp4; codecs="hev1.1.6.L93.B0"',
  'video/webm; codecs="vp8"',
  'video/webm; codecs="vp9"',
  'video/webm; codecs="av01.0.01M.08"',
  'audio/mp4; codecs="mp4a.40.2"',
  'audio/webm; codecs="opus"',
  'audio/webm; codecs="vorbis"',
  'audio/ogg; codecs="flac"',
];

function collectCodecs(): string[] {
  try {
    if (typeof MediaSource === "undefined") return [];
    return CODEC_TESTS.filter((c) => MediaSource.isTypeSupported(c));
  } catch {
    return [];
  }
}

async function collectMediaDeviceCount(): Promise<number> {
  try {
    if (!navigator.mediaDevices?.enumerateDevices) return 0;
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.length;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// CSS preferences
// ---------------------------------------------------------------------------

function collectCSSPreferences(): Record<string, string> {
  const prefs: Record<string, string> = {};
  const queries: Record<string, string[]> = {
    "prefers-color-scheme": ["light", "dark"],
    "prefers-reduced-motion": ["no-preference", "reduce"],
    "prefers-contrast": ["no-preference", "more", "less"],
    pointer: ["none", "coarse", "fine"],
    hover: ["none", "hover"],
    "prefers-reduced-transparency": ["no-preference", "reduce"],
    "forced-colors": ["none", "active"],
  };

  for (const [feature, values] of Object.entries(queries)) {
    for (const v of values) {
      try {
        if (window.matchMedia(`(${feature}: ${v})`).matches) {
          prefs[feature] = v;
          break;
        }
      } catch {
        // matchMedia not supported for this query
      }
    }
  }
  return prefs;
}

// ---------------------------------------------------------------------------
// Math fingerprint
// ---------------------------------------------------------------------------

function collectMathFingerprint(): string {
  const values = [
    Math.tan(1),
    Math.sin(1),
    Math.cos(1),
    Math.atan(1),
    Math.asin(0.5),
    Math.acos(0.5),
    Math.exp(1),
    Math.log(2),
    Math.sqrt(2),
    Math.tan(-1e300),
    Math.pow(Math.PI, -100),
    Math.sinh(1),
    Math.cosh(1),
    Math.tanh(1),
    Math.asinh(1),
    Math.acosh(2),
    Math.atanh(0.5),
    Math.expm1(1),
    Math.log1p(1),
    Math.cbrt(2),
    Math.hypot(3, 4),
    Math.fround(1.337),
  ];
  return values.map((v) => v.toString()).join(",");
}

// ---------------------------------------------------------------------------
// API availability / bot signals
// ---------------------------------------------------------------------------

async function collectAPIAvailability(): Promise<Record<string, boolean>> {
  const w = window as unknown as Record<string, unknown>;
  const n = navigator as unknown as Record<string, unknown>;

  // Incognito detection via StorageManager quota.
  // Normal mode: quota is typically several GB. Incognito: ≤300MB.
  let incognito = false;
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const est = await navigator.storage.estimate();
      if (est.quota && est.quota < 500_000_000) {
        incognito = true;
      }
    }
  } catch {
    // StorageManager not available — can't detect.
  }

  // Notification permission inconsistency (BotD technique):
  // Headless Chrome reports Notification.permission === "denied" but
  // navigator.permissions.query({name:"notifications"}) returns "prompt".
  let notificationInconsistency = false;
  try {
    if (w["Notification"] && n["permissions"]) {
      const perm = await (navigator.permissions as any).query({ name: "notifications" });
      if ((w["Notification"] as any).permission === "denied" && perm.state === "prompt") {
        notificationInconsistency = true;
      }
    }
  } catch {
    // Not supported — skip.
  }

  // Playwright-specific injected globals (Castle.io technique).
  const playwright = !!(w["__playwright__binding__"] || w["__pwInitScripts"]);

  return {
    // API availability
    bluetooth: "bluetooth" in navigator,
    usb: "usb" in navigator,
    webgpu: "gpu" in navigator,
    speech_synthesis: "speechSynthesis" in window,
    webxr: "xr" in navigator,
    serial: "serial" in navigator,
    hid: "hid" in navigator,
    credentials: "credentials" in navigator,
    payment_request: "PaymentRequest" in window,
    incognito,

    // Bot / automation signals (FingerprintJS BotD + Castle.io prior art)
    webdriver: !!n["webdriver"],
    phantom: !!(w["_phantom"] || w["callPhantom"]),
    nightmare: !!w["__nightmare"],
    selenium: !!w["_selenium"] || !!w["__selenium_unwrapped"],
    playwright,

    // CDP / Puppeteer markers
    puppeteer_cdc: !!(w["__puppeteer_evaluation_script__"] || w["$cdc_asdjflasutopfhvcZLmcfl_"]),
    dom_automation: !!(w["domAutomation"] || w["domAutomationController"]),

    // Headless indicators (BotD-proven: each alone is weak, combined is strong)
    zero_plugins: !!((n as any).plugins && (n as any).plugins.length === 0),
    zero_window_size: window.outerWidth === 0 && window.outerHeight === 0,
    connection_rtt_zero: !!((n as any).connection && (n as any).connection.rtt === 0),
    notification_inconsistency: notificationInconsistency,
    missing_accept_language: !(n as any).languages || (n as any).languages.length === 0,
  };
}

// ---------------------------------------------------------------------------
// UserAgent data
// ---------------------------------------------------------------------------

async function collectUserAgentData(): Promise<string> {
  try {
    const nav = navigator as unknown as Record<string, unknown>;
    const uaData = nav["userAgentData"] as
      | {
          getHighEntropyValues?: (hints: string[]) => Promise<Record<string, unknown>>;
          brands?: Array<{ brand: string; version: string }>;
          mobile?: boolean;
          platform?: string;
        }
      | undefined;

    if (uaData?.getHighEntropyValues) {
      const data = await uaData.getHighEntropyValues([
        "architecture",
        "bitness",
        "fullVersionList",
        "model",
        "platformVersion",
        "uaFullVersion",
        "wow64",
      ]);
      return JSON.stringify(data);
    }

    if (uaData) {
      return JSON.stringify({
        brands: uaData.brands,
        mobile: uaData.mobile,
        platform: uaData.platform,
      });
    }

    return navigator.userAgent;
  } catch {
    return navigator.userAgent;
  }
}

// ---------------------------------------------------------------------------
// Main collection
// ---------------------------------------------------------------------------

export async function collectSignals(): Promise<ClientSignals> {
  const webgl = collectWebGL();

  // Run async collectors in parallel
  const [audio, mediaDeviceCount, userAgentData, apiAvailability] = await Promise.all([
    collectAudio(),
    collectMediaDeviceCount(),
    collectUserAgentData(),
    collectAPIAvailability(),
  ]);

  const nav = navigator as unknown as Record<string, unknown>;

  return {
    canvas_data: collectCanvas(),
    webgl_renderer: webgl.renderer,
    webgl_vendor: webgl.vendor,
    webgl_extensions: webgl.extensions,
    audio_data: audio,
    fonts: collectFonts(),
    screen_width: screen.width,
    screen_height: screen.height,
    pixel_ratio: window.devicePixelRatio || 1,
    color_depth: screen.colorDepth,
    hardware_concurrency: navigator.hardwareConcurrency || 0,
    device_memory: (nav["deviceMemory"] as number) || 0,
    languages: Array.from(navigator.languages || []),
    platform: navigator.platform || "",
    user_agent_data: userAgentData,
    max_touch_points: navigator.maxTouchPoints || 0,
    codecs: collectCodecs(),
    media_device_count: mediaDeviceCount,
    css_preferences: collectCSSPreferences(),
    api_availability: apiAvailability,
    math_fingerprint: collectMathFingerprint(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    // Native-only fields — empty from browser context
    mobile_id: "",
    app_attest: "",
    play_integrity: "",
    sensor_data: "",
    build_props: "",
  };
}
