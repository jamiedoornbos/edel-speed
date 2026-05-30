import { fetch } from "@tauri-apps/plugin-http";
import { EdelweissItem, LightspeedAddition, LightspeedItem, LightspeedUpdate } from "./types";

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
  const data = (await res.json()) as Record<string, string>;
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
  const data = (await res.json()) as Record<string, unknown>;
  console.log("[Lightspeed] raw Account response:", data);
  const account = data["Account"] as Record<string, string>;
  return account["accountID"];
}

// Use the refresh token to get a short-lived access token.
export async function getAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
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
  const data = (await res.json()) as Record<string, string>;
  return data.access_token;
}

// Fetch one batch of items by customSku.
async function fetchBatch(accessToken: string, accountId: string, skus: string[]): Promise<LightspeedItem[]> {
  const url = `${API_BASE}/Account/${accountId}/Item.json?customSku=IN,[${skus.join(",")}]&load_relations=["Tags"]`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Lightspeed API error (${res.status}): ${text}`);
  }
  const data = (await res.json()) as Record<string, unknown>;
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
export async function fetchManufacturers(accessToken: string, accountId: string): Promise<Map<string, string>> {
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
    const data = (await res.json()) as Record<string, unknown>;
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
export async function fetchVendors(accessToken: string, accountId: string): Promise<Map<string, string>> {
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
    const data = (await res.json()) as Record<string, unknown>;
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

const BOOK_SHOP_CATEGORY = "Book Shop";

// Fetch all categories and return a name → categoryID map for subcategories of
// BOOK_SHOP_CATEGORY only. The parent lookup and filtering happen internally.
export async function fetchCategories(accessToken: string, accountId: string): Promise<Map<string, string>> {
  const all: Array<{ categoryID: string; name: string; parentID: string }> = [];
  let url: string | null = `${API_BASE}/Account/${accountId}/Category.json`;

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Category fetch failed (${res.status}): ${text}`);
    }
    const data = (await res.json()) as Record<string, unknown>;
    const raw = data["Category"];
    if (!raw) break;
    const page = (Array.isArray(raw) ? raw : [raw]) as typeof all;
    all.push(...page);
    const attrs = data["@attributes"] as Record<string, string> | undefined;
    url = attrs?.next || null;
  }

  const parentID = all.find((c) => c.name === BOOK_SHOP_CATEGORY)?.categoryID;
  const results = new Map<string, string>();
  if (parentID) {
    for (const c of all) {
      if (c.parentID === parentID) results.set(c.name, c.categoryID);
    }
  }
  return results;
}

// ── Tag / author utilities ──────────────────────────────────────────────────

export function isCuratedTag(tag: string): boolean {
  return tag.startsWith("bestseller");
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[øØ]/g, "o") // ø/Ø → o (doesn't decompose under NFD)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining diacritics
    .replace(/[^\w\s-]/g, "") // remove punctuation (preserve hyphens)
    .trim()
    .replace(/\s+/g, ""); // drop spaces
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

// ── Upload ─────────────────────────────────────────────────────────────────

// Look up global tag IDs by name, one request per name.
// Used so tag PUTs can reference tags by ID rather than name — sending {name: "..."}
// causes LS to create a new global tag even if one with that name already exists,
// resulting in duplicate item-tag associations.
async function fetchTagIdsByName(
  accessToken: string,
  accountId: string,
  names: string[]
): Promise<Map<string, string>> {
  if (names.length === 0) return new Map();
  const result = new Map<string, string>();
  for (const name of names) {
    const url = `${API_BASE}/Account/${accountId}/Tag.json?name=${encodeURIComponent(name)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Tag lookup for "${name}" failed (${res.status}): ${text}`);
    }
    const data = (await res.json()) as Record<string, unknown>;
    const raw = data["Tag"];
    if (!raw) continue; // tag doesn't exist globally yet
    const tags = (Array.isArray(raw) ? raw : [raw]) as Array<Record<string, string>>;
    for (const t of tags) {
      const tagName = (t.name ?? t.tag) as string | undefined;
      if (tagName === name) result.set(name, t.tagID);
    }
  }
  return result;
}

export interface ItemUploadResult {
  fieldsChanged: string[];
  tagsAdded: string[];
  tagsRemoved: string[];
  error?: string;
}

// Upload one changed item to Lightspeed via a single Item PUT.
// All four fields (cost, vendor, brand, tags) go in the same request.
// Tags are sent as the full desired set — LS replaces the existing list on PUT.
// reverseVendorMap: lowercase vendor name → vendorID
// reverseManufacturerMap: lowercase manufacturer name → manufacturerID
export async function uploadSingleItem(
  accessToken: string,
  accountId: string,
  update: LightspeedUpdate,
  reverseVendorMap: Map<string, string>,
  reverseManufacturerMap: Map<string, string>
): Promise<ItemUploadResult> {
  const { lsItem, edelweiss, costDiffers, vendorDiffers, brandDiffers, tagsDiffer, authorTags, lsTags } = update;
  const itemID = lsItem.itemID;
  const fieldsChanged: string[] = [];
  const tagsAdded: string[] = [];
  const tagsRemoved: string[] = [];

  // ── Scalar fields PUT ──────────────────────────────────────────────────────
  const scalarPayload: Record<string, string> = {};

  if (costDiffers) {
    scalarPayload.defaultCost = edelweiss.cost.toFixed(2);
    fieldsChanged.push("cost");
  }
  if (vendorDiffers) {
    const vendorID = reverseVendorMap.get(edelweiss.vendor.toLowerCase());
    if (vendorID) {
      scalarPayload.defaultVendorID = vendorID;
      fieldsChanged.push("vendor");
    }
  }
  if (brandDiffers) {
    const mfrID = reverseManufacturerMap.get(edelweiss.brand.toLowerCase());
    if (mfrID) {
      scalarPayload.manufacturerID = mfrID;
      fieldsChanged.push("brand");
    }
  }

  if (Object.keys(scalarPayload).length > 0) {
    const res = await fetch(`${API_BASE}/Account/${accountId}/Item/${itemID}.json`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(scalarPayload),
    });
    if (!res.ok) {
      const text = await res.text();
      return { fieldsChanged: [], tagsAdded: [], tagsRemoved: [], error: `PUT failed (${res.status}): ${text}` };
    }
  }

  // ── Tags PUT (separate call) ────────────────────────────────────────────────
  // Look up each tag's global ID first and send {tagID: ...} in the payload.
  // Sending {name: ...} causes LS to mint a new global tag even if one already
  // exists with that name, producing duplicate item-tag associations.
  if (tagsDiffer) {
    // Desired tag set: author tags + curated LS tags. Non-curated, non-author tags are removed.
    const fullTagSet = [...new Set([...authorTags, ...lsTags.filter(isCuratedTag)])];

    let tagIdMap: Map<string, string>;
    try {
      tagIdMap = await fetchTagIdsByName(accessToken, accountId, fullTagSet);
    } catch (e) {
      return { fieldsChanged, tagsAdded: [], tagsRemoved: [], error: e instanceof Error ? e.message : String(e) };
    }

    const tagItems = fullTagSet.map((t) => {
      const id = tagIdMap.get(t);
      return id ? { tagID: id, name: t } : { name: t };
    });
    const tagPayload = {
      Tags: {
        tag: tagItems.length === 1 ? tagItems[0] : tagItems,
      },
    };
    const res = await fetch(`${API_BASE}/Account/${accountId}/Item/${itemID}.json`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(tagPayload),
    });
    if (!res.ok) {
      const text = await res.text();
      // Scalar fields were already applied above — report them and the tag error separately.
      return { fieldsChanged, tagsAdded: [], tagsRemoved: [], error: `Tags PUT failed (${res.status}): ${text}` };
    }
    tagsAdded.push(...authorTags.filter((t) => !lsTags.includes(t)));
    tagsRemoved.push(...lsTags.filter((t) => !authorTags.includes(t) && !isCuratedTag(t)));
    fieldsChanged.push("tags");
  }

  return { fieldsChanged, tagsAdded, tagsRemoved };
}

export async function uploadSingleAddition(
  accessToken: string,
  accountId: string,
  addition: LightspeedAddition,
  reverseVendorMap: Map<string, string>,
  reverseManufacturerMap: Map<string, string>
): Promise<{ itemID?: string; error?: string }> {
  const payload: Record<string, unknown> = {
    description: addition.title,
    customSku: addition.ean,
    defaultCost: addition.cost.toFixed(2),
    Prices: {
      ItemPrice: { amount: addition.listPrice.toFixed(2), useType: "Default" },
    },
  };

  if (addition.categoryID) payload.categoryID = addition.categoryID;

  const vendorID = reverseVendorMap.get(addition.vendor.toLowerCase());
  if (vendorID) payload.defaultVendorID = vendorID;

  const mfrID = reverseManufacturerMap.get(addition.brand.toLowerCase());
  if (mfrID) payload.manufacturerID = mfrID;

  const res = await fetch(`${API_BASE}/Account/${accountId}/Item.json`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    return { error: `POST failed (${res.status}): ${text}` };
  }

  const data = (await res.json()) as Record<string, unknown>;
  const newItem = data["Item"] as Record<string, string> | undefined;
  if (!newItem) return { error: "No item returned from Lightspeed" };

  const itemID = newItem.itemID;
  const authorTags = authorToTags(addition.author);
  if (authorTags.length > 0) {
    let tagIdMap: Map<string, string>;
    try {
      tagIdMap = await fetchTagIdsByName(accessToken, accountId, authorTags);
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
    const tagItems = authorTags.map((t) => {
      const id = tagIdMap.get(t);
      return id ? { tagID: id, name: t } : { name: t };
    });
    const tagRes = await fetch(`${API_BASE}/Account/${accountId}/Item/${itemID}.json`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ Tags: { tag: tagItems.length === 1 ? tagItems[0] : tagItems } }),
    });
    if (!tagRes.ok) {
      const text = await tagRes.text();
      return { itemID, error: `Tags PUT failed (${tagRes.status}): ${text}` };
    }
  }

  return { itemID };
}

// ── Build update record ─────────────────────────────────────────────────────

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
    tagsDiffer:
      !authorTags.every((tag) => lsTags.includes(tag)) ||
      lsTags.some((tag) => !authorTags.includes(tag) && !isCuratedTag(tag)),
    get changed() {
      return this.costDiffers || this.vendorDiffers || this.brandDiffers || this.tagsDiffer;
    },
  };
}

export function itemLink(itemID: string): string {
  return `https://us.merchantos.com/?name=item.views.item&form_name=view&id=${itemID}&tab=details`;
}
