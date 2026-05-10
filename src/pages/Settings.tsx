import { useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { VendorMapping, LightspeedConfig } from "../types";
import { buildAuthorizeUrl, exchangeCode, getAccessToken, fetchVendors, fetchManufacturers } from "../lightspeed";

interface Props {
  mappings: VendorMapping[];
  onMappingsChange: (mappings: VendorMapping[]) => void;
  lsConfig: LightspeedConfig;
  onLsConfigChange: (config: LightspeedConfig) => void;
  vendorMap: Map<string, string>;
  onVendorMapChange: (map: Map<string, string>) => void;
  manufacturerMap: Map<string, string>;
  onManufacturerMapChange: (map: Map<string, string>) => void;
}

type SettingsTab = "lightspeed" | "mappings";

export default function Settings({ mappings, onMappingsChange, lsConfig, onLsConfigChange, vendorMap, onVendorMapChange, manufacturerMap, onManufacturerMapChange }: Props) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("lightspeed");

  // Vendor mapping form
  const [infix, setInfix] = useState("");
  const [vendor, setVendor] = useState("");
  const [brand, setBrand] = useState("");

  // Lightspeed OAuth form
  const [clientId, setClientId] = useState(lsConfig.clientId);
  const [clientSecret, setClientSecret] = useState(lsConfig.clientSecret);
  const [authCode, setAuthCode] = useState("");
  const [lsError, setLsError] = useState<string | null>(null);
  const [lsLoading, setLsLoading] = useState(false);

  // Vendor sync modal
  const [syncOpen, setSyncOpen] = useState(false);
  const [syncState, setSyncState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncCount, setSyncCount] = useState(0);

  const handleSyncVendors = async () => {
    setSyncOpen(true);
    setSyncState("loading");
    setSyncError(null);
    try {
      const accessToken = await getAccessToken(lsConfig.clientId, lsConfig.clientSecret, lsConfig.refreshToken);
      const map = await fetchVendors(accessToken, lsConfig.accountId);
      onVendorMapChange(map);
      setSyncCount(map.size);
      setSyncState("done");
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : String(e));
      setSyncState("error");
    }
  };

  const closeSyncModal = () => {
    setSyncOpen(false);
    setSyncState("idle");
  };

  // Brand (manufacturer) sync modal
  const [brandSyncOpen, setBrandSyncOpen] = useState(false);
  const [brandSyncState, setBrandSyncState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [brandSyncError, setBrandSyncError] = useState<string | null>(null);
  const [brandSyncCount, setBrandSyncCount] = useState(0);

  const handleSyncBrands = async () => {
    setBrandSyncOpen(true);
    setBrandSyncState("loading");
    setBrandSyncError(null);
    try {
      const accessToken = await getAccessToken(lsConfig.clientId, lsConfig.clientSecret, lsConfig.refreshToken);
      const map = await fetchManufacturers(accessToken, lsConfig.accountId);
      onManufacturerMapChange(map);
      setBrandSyncCount(map.size);
      setBrandSyncState("done");
    } catch (e) {
      setBrandSyncError(e instanceof Error ? e.message : String(e));
      setBrandSyncState("error");
    }
  };

  const closeBrandSyncModal = () => {
    setBrandSyncOpen(false);
    setBrandSyncState("idle");
  };

  const isConnected = !!lsConfig.refreshToken;
  const canConnect = clientId.trim() && clientSecret.trim();

  // --- Vendor mapping handlers ---
  const addMapping = () => {
    const key = infix.trim().toUpperCase();
    if (!key || !vendor.trim()) return;
    const entry: VendorMapping = { infix: key, vendor: vendor.trim(), brand: brand.trim() };
    const existing = mappings.findIndex((m) => m.infix === key);
    if (existing >= 0) {
      const updated = [...mappings];
      updated[existing] = entry;
      onMappingsChange(updated);
    } else {
      onMappingsChange([...mappings, entry]);
    }
    setInfix("");
    setVendor("");
    setBrand("");
  };

  const removeMapping = (key: string) => {
    onMappingsChange(mappings.filter((m) => m.infix !== key));
  };

  // --- Lightspeed OAuth handlers ---
  const openAuthPage = async () => {
    onLsConfigChange({ ...lsConfig, clientId: clientId.trim(), clientSecret: clientSecret.trim() });
    await openUrl(buildAuthorizeUrl(clientId.trim()));
  };

  const handleExchange = async () => {
    setLsError(null);
    setLsLoading(true);
    try {
      const { refreshToken, accountId } = await exchangeCode(clientId.trim(), clientSecret.trim(), authCode.trim());
      onLsConfigChange({ clientId: clientId.trim(), clientSecret: clientSecret.trim(), accountId, refreshToken });
      setAuthCode("");
    } catch (e) {
      setLsError(e instanceof Error ? e.message : String(e));
    } finally {
      setLsLoading(false);
    }
  };

  const disconnect = () => {
    onLsConfigChange({ ...lsConfig, refreshToken: "" });
  };

  return (
    <div className="page">
      <h1>Settings</h1>

      <div className="orders-header" style={{ marginBottom: 24 }}>
        <div className="tab-bar">
          <button className={`tab ${activeTab === "lightspeed" ? "active" : ""}`} onClick={() => setActiveTab("lightspeed")}>
            Lightspeed API
          </button>
          <button className={`tab ${activeTab === "mappings" ? "active" : ""}`} onClick={() => setActiveTab("mappings")}>
            Vendor Mappings
          </button>
        </div>
      </div>

      {/* ── Lightspeed API ── */}
      {activeTab === "lightspeed" && (
        <section className="settings-section">
          <div className="settings-fields">
            <label>Client ID
              <input className="mapping-input" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="Client ID" />
            </label>
            <label>Client Secret
              <input className="mapping-input" type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} placeholder="Client Secret" />
            </label>
            {lsConfig.accountId && (
              <label>Account ID (auto-detected)
                <input className="mapping-input" value={lsConfig.accountId} readOnly />
              </label>
            )}
          </div>

          {isConnected ? (
            <div className="ls-status connected">
              <div className="ls-status-row">
                <span>✓ Connected</span>
                <button className="btn-disconnect" onClick={disconnect}>Disconnect</button>
              </div>
              <div className="ls-status-row">
                <span className="vendor-cache-count">{vendorMap.size} vendors cached</span>
                <button className="primary" onClick={handleSyncVendors}>Sync Vendor List</button>
              </div>
              <div className="ls-status-row">
                <span className="vendor-cache-count">{manufacturerMap.size} brands cached</span>
                <button className="primary" onClick={handleSyncBrands}>Sync Brand List</button>
              </div>
            </div>
          ) : (
            <div className="ls-connect">
              <ol className="connect-steps">
                <li>If you do not already have the original EdelSpeed Client ID and Secret, go to <span className="mono">cloud.lightspeedapp.com/oauth/register.php</span> and register an app with redirect URI <span className="mono">http://localhost</span>. Copy the Client ID and Client Secret into the fields above.</li>
                <li>Click the button below. Your browser will open the Lightspeed authorization page — log in and click Authorize.</li>
                <li>Lightspeed will redirect to a page that won't load — that's expected. Copy the <span className="mono">code=</span> value from the URL bar.</li>
                <li>Paste the code below and click Exchange.</li>
              </ol>
              <button className="primary" onClick={openAuthPage} disabled={!canConnect} style={{ alignSelf: "flex-start" }}>
                Open Lightspeed Authorization Page
              </button>
              <div className="mapping-form">
                <input
                  className="mapping-input"
                  placeholder="Paste authorization code"
                  value={authCode}
                  onChange={(e) => setAuthCode(e.target.value)}
                />
                <button className="primary" onClick={handleExchange} disabled={!authCode.trim() || lsLoading}>
                  {lsLoading ? "Connecting…" : "Exchange"}
                </button>
              </div>
              {lsError && <p className="error">{lsError}</p>}
            </div>
          )}
        </section>
      )}

      {/* ── Vendor Mappings ── */}
      {activeTab === "mappings" && (
        <section className="settings-section">
          <p className="subtitle">Map order ID codes to Lightspeed vendor and brand.</p>

          <table className="preview-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Vendor</th>
                <th>Brand</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {mappings.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty-row">No mappings yet</td>
                </tr>
              )}
              {mappings.map((m) => (
                <tr key={m.infix}>
                  <td className="mono">{m.infix}</td>
                  <td>{m.vendor}</td>
                  <td>{m.brand}</td>
                  <td>
                    <button className="btn-remove" onClick={() => removeMapping(m.infix)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mapping-form">
            <input
              className="mapping-input infix"
              placeholder="Code"
              value={infix}
              maxLength={3}
              onChange={(e) => setInfix(e.target.value)}
            />
            <input
              className="mapping-input"
              placeholder="Vendor"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
            />
            <input
              className="mapping-input"
              placeholder="Brand"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
            />
            <button className="primary" onClick={addMapping}>Add</button>
          </div>
        </section>
      )}
      {syncOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Sync Vendor List</h2>
            {syncState === "loading" && <p>Downloading vendors…</p>}
            {syncState === "done" && <p className="status-ok">✓ {syncCount} vendors synced.</p>}
            {syncState === "error" && <p className="error">{syncError}</p>}
            {syncState !== "loading" && (
              <button className="primary" onClick={closeSyncModal}>Close</button>
            )}
          </div>
        </div>
      )}
      {brandSyncOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Sync Brand List</h2>
            {brandSyncState === "loading" && <p>Downloading brands…</p>}
            {brandSyncState === "done" && <p className="status-ok">✓ {brandSyncCount} brands synced.</p>}
            {brandSyncState === "error" && <p className="error">{brandSyncError}</p>}
            {brandSyncState !== "loading" && (
              <button className="primary" onClick={closeBrandSyncModal}>Close</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
