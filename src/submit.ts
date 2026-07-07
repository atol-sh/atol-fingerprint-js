import type { ClientSignals, FingerprintConfig, IdentifyResult } from "./types";

const DEFAULT_ENDPOINT = "https://api.atol.sh";

export async function submitSignals(
  signals: ClientSignals,
  config: FingerprintConfig
): Promise<IdentifyResult> {
  const endpoint = (config.endpoint || DEFAULT_ENDPOINT).replace(/\/+$/, "");
  const url = `${endpoint}/api/v1/devices/identify`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }

  const body: Record<string, unknown> = {
    client_signals: signals,
    client_platform: "browser",
  };
  // Bind to an explicit session when provided; otherwise the control plane
  // derives the session from the authenticating token's jti.
  if (config.sessionToken) {
    body.session_token = config.sessionToken;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Atol identify request failed: ${response.status} ${response.statusText}${body ? ` — ${body}` : ""}`
    );
  }

  const data = (await response.json()) as IdentifyResult;
  return data;
}
