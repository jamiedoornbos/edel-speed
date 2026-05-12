import { fetch } from "@tauri-apps/plugin-http";
import { EdelweissItem, LightspeedItem, LightspeedUpdate } from "./types";

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
  console.log(`Raw lightspeed response for ${url}`, data);
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

// Fetch all manufacturers and return a manufacturerID → name map, following next-page cursors.
export async function fetchManufacturers(
  accessToken: string,
  accountId: string
): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  let url: string | null = `${API_BASE}/Account/${accountId}/Manufacturer.json`;

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Manufacturer fetch failed (${res.status}): ${text}`);
    }
    const data = await res.json() as Record<string, unknown>;
    const raw = data["Manufacturer"];
    if (!raw) break;
    const page = (Array.isArray(raw) ? raw : [raw]) as Array<{ manufacturerID: string; name: string }>;
    for (const m of page) {
      results.set(m.manufacturerID, m.name);
    }
    const attrs = data["@attributes"] as Record<string, string> | undefined;
    url = attrs?.next || null;
  }

  return results;
}

// Fetch all vendors and return a vendorID → name map, following next-page cursors.
export async function fetchVendors(
  accessToken: string,
  accountId: string
): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  let url: string | null = `${API_BASE}/Account/${accountId}/Vendor.json`;

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Vendor fetch failed (${res.status}): ${text}`);
    }
    const data = await res.json() as Record<string, unknown>;
    const raw = data["Vendor"];
    if (!raw) break;
    const page = (Array.isArray(raw) ? raw : [raw]) as Array<{ vendorID: string; name: string }>;
    for (const v of page) {
      results.set(v.vendorID, v.name);
    }
    const attrs = data["@attributes"] as Record<string, string> | undefined;
    url = attrs?.next || null;
  }

  return results;
}

// ── Tag / author utilities ──────────────────────────────────────────────────

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[øØ]/g, "o")            // ø/Ø → o (doesn't decompose under NFD)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")  // strip combining diacritics
    .replace(/[^\w\s-]/g, "")         // remove punctuation (preserve hyphens)
    .trim()
    .replace(/\s+/g, "");             // drop spaces
}

// "Surname, Forenames" → ["surname", "forenames"] (each slugified as one tag)
// "Multi Word Surname, Forenames" → ["surname", "forenames"] (each slugified as one tag)
// "Non Name Author" → ["nonnameauthor"] (slugified as one tag)
export function authorToTags(author: string): string[] {
  const commaIdx = author.indexOf(",");
  if (commaIdx === -1) return [slugify(author)].filter(Boolean);
  const surnameRaw = author.slice(0, commaIdx).trim();
  const lastWord = surnameRaw.split(/\s+/).pop() ?? surnameRaw;
  const surname = slugify(lastWord);
  const forenames = slugify(author.slice(commaIdx + 1).trim());
  return [surname, forenames].filter(Boolean);
}

// Build a LightspeedUpdate by comparing an Edelweiss item against its LS counterpart.
export function buildLightspeedUpdate(
  item: EdelweissItem,
  lsItem: LightspeedItem,
  vendorMap: Map<string, string>,
  manufacturerMap: Map<string, string>
): LightspeedUpdate {
  const authorTags = authorToTags(item.author);
  const rawTag = lsItem.Tags?.tag;
  const lsTags = rawTag ? (Array.isArray(rawTag) ? rawTag : [rawTag]) : [];

  const lsCost = parseFloat(lsItem.defaultCost ?? "0");
  const lsVendorName = vendorMap.get(lsItem.defaultVendorID ?? "") ?? "";
  const lsManufacturerName = manufacturerMap.get(lsItem.manufacturerID ?? "") ?? "";

  return {
    edelweiss: item,
    lsItem,
    authorTags,
    lsTags,
    lsCost,
    lsVendorName,
    lsManufacturerName,
    costDiffers: Math.abs(item.cost - lsCost) > 0.001,
    vendorDiffers: item.vendor.toLowerCase() !== lsVendorName.toLowerCase(),
    brandDiffers: item.brand !== "" && item.brand.toLowerCase() !== lsManufacturerName.toLowerCase(),
    tagsDiffer: !authorTags.every((tag) => lsTags.includes(tag)),
    get changed() { return this.costDiffers || this.vendorDiffers || this.brandDiffers || this.tagsDiffer; },
  };
}
