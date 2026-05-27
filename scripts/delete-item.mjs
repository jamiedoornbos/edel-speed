// Interactive script to find and delete a Lightspeed item by EAN.
// Run with: node delete-item.mjs

import { createInterface } from "readline";

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((res) => rl.question(q, res));

const API_BASE = "https://api.lightspeedapp.com/API/V3";

// 1. Get credentials from user
console.log(
  '\nOpen devtools in the EdelSpeed app and run:\n  JSON.parse(localStorage.getItem("edelspeed.lightspeedConfig"))\n'
);
const configRaw = await ask("Paste the output here: ");
const cleaned = configRaw
  .trim()
  .replace(/=\s*\$\d+\s*$/, "")
  .trim();
const { clientId, clientSecret, refreshToken, accountId } = JSON.parse(cleaned.replace(/([{,]\s*)(\w+):/g, '$1"$2":'));

// 2. Get access token
const tokenRes = await fetch("https://cloud.lightspeedapp.com/oauth/access_token.php", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  }).toString(),
});
if (!tokenRes.ok) throw new Error(`Token refresh failed: ${await tokenRes.text()}`);
const { access_token } = await tokenRes.json();

// 3. Ask for EAN
const ean = (await ask("EAN / custom SKU to look up: ")).trim();

// 4. Search
const searchRes = await fetch(`${API_BASE}/Account/${accountId}/Item.json?customSku=${ean}&load_relations=["Tags"]`, {
  headers: { Authorization: `Bearer ${access_token}` },
});
if (!searchRes.ok) throw new Error(`Search failed: ${await searchRes.text()}`);
const searchData = await searchRes.json();
const raw = searchData["Item"];
const items = raw ? (Array.isArray(raw) ? raw : [raw]) : [];

if (items.length === 0) {
  console.log(`\nNo items found for EAN ${ean}.`);
  rl.close();
  process.exit(0);
}

// 5. Print what was found
console.log(`\nFound ${items.length} item(s):\n`);
for (const item of items) {
  const rawTag = item.Tags?.tag;
  const tags = rawTag ? (Array.isArray(rawTag) ? rawTag : [rawTag]) : [];
  const tagNames = tags.map((t) => t.name ?? t).join(", ") || "—";
  console.log(`  itemID : ${item.itemID}`);
  console.log(`  title  : ${item.description}`);
  console.log(`  tags   : ${tagNames}`);
  console.log();
}

// 6. If multiple copies, auto-select the duplicate (highest itemID)
let toDelete;
if (items.length > 1) {
  toDelete = items.reduce((a, b) => (Number(a.itemID) > Number(b.itemID) ? a : b));
  console.log(`Multiple copies found — will delete the most recently created (itemID=${toDelete.itemID}).`);
} else {
  toDelete = items[0];
}

// 7. Confirm
const confirm = await ask(`\nDelete itemID=${toDelete.itemID} "${toDelete.description}"? (yes/no): `);
rl.close();

if (confirm.trim().toLowerCase() !== "yes") {
  console.log("Aborted.");
  process.exit(0);
}

// 8. Delete
const delRes = await fetch(`${API_BASE}/Account/${accountId}/Item/${toDelete.itemID}.json`, {
  method: "DELETE",
  headers: { Authorization: `Bearer ${access_token}` },
});
if (!delRes.ok) throw new Error(`Delete failed (${delRes.status}): ${await delRes.text()}`);
console.log("Deleted successfully.");
