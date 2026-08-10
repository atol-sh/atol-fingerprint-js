import type {
  ClientSignals,
  FingerprintConfig,
  IdentifyAuthorization,
  IdentifyOptions,
  IdentifyResult,
} from "./types";

const DEFAULT_ENDPOINT = "https://api.atol.sh";

const IDENTIFY_RESULT_KEYS = [
  "browser",
  "confidence",
  "device_id",
  "known",
  "new_device",
  "os_version",
  "platform",
  "signals",
] as const;

const SMART_SIGNAL_KEYS = [
  "anomaly_score",
  "bot",
  "device_mismatch",
  "device_shared",
  "emulator",
  "geo_mismatch",
  "incognito",
  "proxy",
  "rooted",
  "shared_user_count",
  "tampered",
  "tor",
  "vpn",
] as const;

export type IdentifyRequestErrorCode =
  | "identify_authorization_required"
  | "identify_authorization_failed"
  | "identify_transport_failed"
  | "identify_http_rejected"
  | "identify_response_invalid";

/**
 * Closed diagnostic for an identify operation. It deliberately retains no
 * response body, status text, URL, or caught browser value.
 */
export class IdentifyRequestError extends Error {
  readonly code: IdentifyRequestErrorCode;
  readonly status: number | null;

  constructor(
    code: IdentifyRequestErrorCode,
    message: string,
    status: number | null = null
  ) {
    super(message);
    this.name = "IdentifyRequestError";
    this.code = code;
    this.status = status;
  }
}

function isExactRecord(
  value: unknown,
  expectedKeys: readonly string[]
): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const actualKeys = Object.keys(value).sort();
  return (
    actualKeys.length === expectedKeys.length &&
    actualKeys.every((key, index) => key === expectedKeys[index])
  );
}

function isProbability(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
  );
}

function isSmartSignals(value: unknown): boolean {
  if (!isExactRecord(value, SMART_SIGNAL_KEYS)) {
    return false;
  }
  return (
    typeof value.bot === "boolean" &&
    typeof value.vpn === "boolean" &&
    typeof value.proxy === "boolean" &&
    typeof value.tor === "boolean" &&
    typeof value.incognito === "boolean" &&
    typeof value.tampered === "boolean" &&
    typeof value.emulator === "boolean" &&
    typeof value.rooted === "boolean" &&
    typeof value.geo_mismatch === "boolean" &&
    typeof value.device_mismatch === "boolean" &&
    typeof value.device_shared === "boolean" &&
    typeof value.shared_user_count === "number" &&
    Number.isSafeInteger(value.shared_user_count) &&
    value.shared_user_count >= 0 &&
    isProbability(value.anomaly_score)
  );
}

function isIdentifyResult(value: unknown): value is IdentifyResult {
  if (!isExactRecord(value, IDENTIFY_RESULT_KEYS)) {
    return false;
  }
  return (
    typeof value.device_id === "string" &&
    value.device_id.length > 0 &&
    typeof value.known === "boolean" &&
    typeof value.new_device === "boolean" &&
    value.known !== value.new_device &&
    isProbability(value.confidence) &&
    typeof value.platform === "string" &&
    typeof value.browser === "string" &&
    typeof value.os_version === "string" &&
    isSmartSignals(value.signals)
  );
}

function parseIdentifyAuthorization(
  value: unknown
): IdentifyAuthorization | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const authorization = value as Record<string, unknown>;
  const scheme = authorization.scheme;
  if (
    scheme === "Bearer" &&
    isExactRecord(authorization, ["accessToken", "scheme"])
  ) {
    const accessToken = authorization.accessToken;
    return typeof accessToken === "string" && accessToken.length > 0
      ? { scheme, accessToken }
      : null;
  }
  if (
    scheme === "DPoP" &&
    isExactRecord(authorization, ["accessToken", "dpopProof", "scheme"])
  ) {
    const accessToken = authorization.accessToken;
    const dpopProof = authorization.dpopProof;
    return typeof accessToken === "string" &&
      accessToken.length > 0 &&
      typeof dpopProof === "string" &&
      dpopProof.length > 0
      ? { scheme, accessToken, dpopProof }
      : null;
  }
  return null;
}

export async function submitSignals(
  signals: ClientSignals,
  config: FingerprintConfig,
  options: IdentifyOptions = {}
): Promise<IdentifyResult> {
  if (!options.authorize) {
    throw new IdentifyRequestError(
      "identify_authorization_required",
      "Atol identify requires an operation-scoped authorization owner."
    );
  }
  const endpoint = (config.endpoint || DEFAULT_ENDPOINT).replace(/\/+$/, "");
  const url = `${endpoint}/api/v1/devices/identify`;

  let authorization: IdentifyAuthorization;
  try {
    const acquired: unknown = await options.authorize(
      Object.freeze({ method: "POST", url })
    );
    const parsed = parseIdentifyAuthorization(acquired);
    if (!parsed) {
      throw new Error("invalid authorization contract");
    }
    authorization = parsed;
  } catch {
    throw new IdentifyRequestError(
      "identify_authorization_failed",
      "Atol identify authorization could not be acquired."
    );
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `${authorization.scheme} ${authorization.accessToken}`,
  };
  if (authorization.scheme === "DPoP") {
    headers.DPoP = authorization.dpopProof;
  }

  const body: Record<string, unknown> = {
    client_signals: signals,
    client_platform: "browser",
  };

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
    });
  } catch {
    throw new IdentifyRequestError(
      "identify_transport_failed",
      "Atol identify request could not reach the control plane."
    );
  }

  if (!response.ok) {
    throw new IdentifyRequestError(
      "identify_http_rejected",
      `Atol identify request was rejected with HTTP ${response.status}.`,
      response.status
    );
  }

  try {
    const parsed: unknown = await response.json();
    if (isIdentifyResult(parsed)) {
      return parsed;
    }
  } catch {
    // Project parser failures to the same closed response-contract error.
  }
  throw new IdentifyRequestError(
    "identify_response_invalid",
    "Atol identify response did not match the response contract.",
    response.status
  );
}
