import { collectSignals } from "./collect";
import { submitSignals } from "./submit";
import type {
  ClientSignals,
  CollectionDisabled,
  FingerprintConfig,
  IdentifyResult,
} from "./types";

export type {
  ClientSignals,
  CollectionDisabled,
  FingerprintConfig,
  IdentifyResult,
  SmartSignals,
} from "./types";
export { isCollectionDisabled } from "./types";
export { collectSignals } from "./collect";
export { submitSignals } from "./submit";

/**
 * Main entry point for the Atol fingerprint SDK.
 *
 * Usage:
 * ```ts
 * const fp = await AtolFingerprint.load({ apiKey: "ak_..." });
 * const result = await fp.identify();
 * if (!isCollectionDisabled(result)) {
 *   console.log(result.device_id, result.signals?.bot);
 * }
 * ```
 */
export class AtolFingerprint {
  private readonly signals: ClientSignals | null;
  private readonly config: FingerprintConfig;
  private readonly disabledReason: CollectionDisabled["reason"] | null;

  private constructor(
    signals: ClientSignals | null,
    config: FingerprintConfig,
    disabledReason: CollectionDisabled["reason"] | null
  ) {
    this.signals = signals;
    this.config = config;
    this.disabledReason = disabledReason;
  }

  /**
   * Collect browser signals and return a ready-to-use fingerprint instance.
   * Signal collection runs once at load time; call `identify()` to submit.
   *
   * Collection is skipped entirely (no browser APIs are read) when
   * `config.disabled` is true, or when the browser advertises Global Privacy
   * Control and `config.respectGPC` is not explicitly set to false.
   */
  static async load(config: FingerprintConfig = {}): Promise<AtolFingerprint> {
    const reason = disabledReason(config);
    if (reason !== null) {
      return new AtolFingerprint(null, config, reason);
    }
    const signals = await collectSignals();
    return new AtolFingerprint(signals, config, null);
  }

  /** True when collection is disabled (explicit opt-out or GPC). */
  get disabled(): boolean {
    return this.disabledReason !== null;
  }

  /**
   * Submit collected signals to the Atol control plane and receive a device
   * identification result including the server-assigned device_id and smart
   * signals. Returns a `CollectionDisabled` result (and performs no network
   * request) when collection is disabled.
   *
   * @param options.token - Override the Bearer token (e.g., OIDC access token from the React SDK).
   */
  async identify(options?: { token?: string }): Promise<IdentifyResult | CollectionDisabled> {
    if (this.disabledReason !== null || this.signals === null) {
      return { collection_disabled: true, reason: this.disabledReason ?? "config" };
    }
    const config = options?.token
      ? { ...this.config, apiKey: options.token }
      : this.config;
    return submitSignals(this.signals, config);
  }

  /**
   * Return the raw collected signals without submitting to the server, or a
   * `CollectionDisabled` result when collection is disabled.
   */
  getSignals(): ClientSignals | CollectionDisabled {
    if (this.disabledReason !== null || this.signals === null) {
      return { collection_disabled: true, reason: this.disabledReason ?? "config" };
    }
    return this.signals;
  }
}

/** Determine whether collection must be disabled, and why. */
function disabledReason(config: FingerprintConfig): CollectionDisabled["reason"] | null {
  if (config.disabled) {
    return "config";
  }
  if (config.respectGPC !== false && typeof navigator !== "undefined") {
    const gpc = (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl;
    if (gpc === true) {
      return "gpc";
    }
  }
  return null;
}
