/**
 * Raw browser signals collected on the client.
 *
 * Wire-compatible with the control plane's `signals.RawClientSignals`
 * (atol: internal/device/signals/browser.go). Field names and casing must
 * match the Go JSON tags exactly.
 */
export interface ClientSignals {
  canvas_data: string;
  webgl_renderer: string;
  webgl_vendor: string;
  webgl_extensions: string[];
  audio_data: string;
  fonts: string[];
  screen_width: number;
  screen_height: number;
  pixel_ratio: number;
  color_depth: number;
  hardware_concurrency: number;
  device_memory: number;
  languages: string[];
  platform: string;
  user_agent_data: string;
  max_touch_points: number;
  codecs: string[];
  media_device_count: number;
  css_preferences: Record<string, string>;
  api_availability: Record<string, boolean>;
  math_fingerprint: string;
  timezone: string;
  /** Native-only fields. Always empty strings from a browser context. */
  mobile_id: string;
  app_attest: string;
  play_integrity: string;
  sensor_data: string;
  build_props: string;
}

/** Configuration for the fingerprint client. */
export interface FingerprintConfig {
  /** Control plane endpoint, e.g. "https://api.atol.sh". */
  endpoint?: string;
  /**
   * Disable all signal collection and submission (consent opt-out).
   * When true, no browser signals are read and `identify()`/`getSignals()`
   * return a `CollectionDisabled` result instead of data.
   */
  disabled?: boolean;
  /**
   * Respect the Global Privacy Control signal (`navigator.globalPrivacyControl`).
   * Defaults to true: when the browser advertises GPC, collection is disabled
   * exactly as if `disabled: true` had been passed. Set to false only if you
   * have another legal basis for collection.
   */
  respectGPC?: boolean;
}

/** Exact request metadata presented to the operation-scoped credential owner. */
export interface IdentifyAuthorizationRequest {
  method: "POST";
  url: string;
}

/**
 * Authorization material for one identify request. DPoP credentials are an
 * inseparable token/proof pair; a Bearer token cannot accidentally be sent
 * under the DPoP scheme or vice versa.
 */
export type IdentifyAuthorization =
  | {
      scheme: "Bearer";
      accessToken: string;
    }
  | {
      scheme: "DPoP";
      accessToken: string;
      dpopProof: string;
    };

/**
 * Credentials are acquired for the exact request immediately before
 * dispatch. The callback and its result are never retained by the agent.
 */
export interface IdentifyOptions {
  authorize?: (
    request: Readonly<IdentifyAuthorizationRequest>
  ) => Promise<IdentifyAuthorization>;
}

/**
 * Smart signals computed server-side by the Device Intelligence Engine.
 *
 * Matches the JSON emitted by the control plane's `intelligence.SignalsToMap`
 * (atol: internal/device/intelligence/evaluator.go).
 */
export interface SmartSignals {
  bot: boolean;
  vpn: boolean;
  proxy: boolean;
  tor: boolean;
  incognito: boolean;
  tampered: boolean;
  emulator: boolean;
  rooted: boolean;
  geo_mismatch: boolean;
  device_mismatch: boolean;
  device_shared: boolean;
  shared_user_count: number;
  /** Composite anomaly score in [0, 1]. 0 = clean, 1 = highly suspicious. */
  anomaly_score: number;
}

/**
 * Result of `POST /api/v1/devices/identify`.
 *
 * Matches the JSON response built in the control plane's
 * `DeviceHandler.Identify` (atol: internal/api/device_handler.go).
 */
export interface IdentifyResult {
  /** Server-assigned device ID. Never generated client-side. */
  device_id: string;
  known: boolean;
  confidence: number;
  new_device: boolean;
  platform: string;
  browser: string;
  os_version: string;
  /** Exact smart-signal evaluation produced by the control plane. */
  signals: SmartSignals;
}

/**
 * Honest "no data" result returned when collection is disabled, either
 * explicitly via `FingerprintConfig.disabled` or implicitly via Global
 * Privacy Control. Never contains fabricated signal data.
 */
export interface CollectionDisabled {
  collection_disabled: true;
  /** Why collection is off: explicit config, or the browser's GPC signal. */
  reason: "config" | "gpc";
}

/** Type guard for `CollectionDisabled` results. */
export function isCollectionDisabled(value: unknown): value is CollectionDisabled {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<string, unknown>).collection_disabled === true
  );
}
