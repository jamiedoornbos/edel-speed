import { fetch } from "@tauri-apps/plugin-http";
import { LightspeedItem } from "./types";

const TOKEN_URL = "https://cloud.lightspeedapp.com/oauth/access_token.php";
const API_BASE = "https://api.lightspeedapp.com/API/V3";
const BATCH_SIZE = 50;

// Step 1 of OAuth: build the URL to open in the browser.
export function buildAuthorizeUrl(clientId: string): string {
  return `https://cloud.lightspeedapp.com/oauth/authorize.php?response_type=code&client_id=${encodeURIComponent(clientId)}&scope=employee:all`;
}

// Step 2: exchange the authorization code for tokens, then auto-discover the account ID.
export async function exchangeCode(
  clientId: string,
  clientSecret: string,
  code: string
): Promise<{ accessToken: string; refreshToken: string; accountId: string }> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: code.trim(),
      grant_type: "authorization_code",
    }).toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }
  const data = await res.json() as Record<string, string>;
  const accessToken = data.access_token;
  const refreshToken = data.refresh_token;
  const accountId = await fetchAccountId(accessToken);
  return { accessToken, refreshToken, accountId };
}

// Discover the account ID from the API — no manual entry needed.
async function fetchAccountId(accessToken: string): Promise<string> {
  const res = await fetch(`${API_BASE}/Account.json`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Account lookup failed (${res.status}): ${text}`);
  }
  const data = await res.json() as Record<string, unknown>;
  console.log("[Lightspeed] raw Account response:", data);
  const account = data["Account"] as Record<string, string>;
  return account["accountID"];
}

// Use the refresh token to get a short-lived access token.
export async function getAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${text}`);
  }
  const data = await res.json() as Record<string, string>;
  return data.access_token;
}

// Fetch one batch of items by customSku.
async function fetchBatch(
  accessToken: string,
  accountId: string,
  skus: string[]
): Promise<LightspeedItem[]> {
  const url = `${API_BASE}/Account/${accountId}/Item.json?customSku=IN,[${skus.join(",")}]&load_relations=["Tags"]`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Lightspeed API error (${res.status}): ${text}`);
  }
  const data = await res.json() as Record<string, unknown>;

  // Log the raw response once so field names can be verified.
  console.log("[Lightspeed] raw Item response:", data);

  const raw = data["Item"];
  if (!raw) return [];
  // Lightspeed returns an object (not array) when count === 1.
  return (Array.isArray(raw) ? raw : [raw]) as LightspeedItem[];
}

// Search Lightspeed for all provided EANs, batching as needed.
export async function searchByCustomSku(
  accessToken: string,
  accountId: string,
  skus: string[]
): Promise<Map<string, LightspeedItem>> {
  const results = new Map<string, LightspeedItem>();
  for (let i = 0; i < skus.length; i += BATCH_SIZE) {
    const batch = skus.slice(i, i + BATCH_SIZE);
    const items = await fetchBatch(accessToken, accountId, batch);
    for (const item of items) {
      results.set(item.customSku, item);
    }
  }
  return results;
}
