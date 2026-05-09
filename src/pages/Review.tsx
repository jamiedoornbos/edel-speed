import { useState, useEffect } from "react";
import { Order, LightspeedConfig, LightspeedItem, EdelweissItem } from "../types";
import { getAccessToken, searchByCustomSku } from "../lightspeed";

interface Props {
  orders: Order[];
  lsConfig: LightspeedConfig;
}

type FetchState = "idle" | "loading" | "done" | "error";

const COLUMNS = (
  <tr>
    <th>Title</th>
    <th>Author</th>
    <th>EAN</th>
    <th>Vendor</th>
    <th>Brand</th>
    <th>List Price</th>
    <th>Cost</th>
  </tr>
);

function ItemRow({ item }: { item: EdelweissItem }) {
  return (
    <tr key={item.ean}>
      <td>{item.title}</td>
      <td>{item.author}</td>
      <td className="mono">{item.ean}</td>
      <td>{item.vendor}</td>
      <td>{item.brand}</td>
      <td>${item.listPrice.toFixed(2)}</td>
      <td>${item.cost.toFixed(2)}</td>
    </tr>
  );
}

export default function Review({ orders, lsConfig }: Props) {
  const [lsItems, setLsItems] = useState<Map<string, LightspeedItem>>(new Map());
  const [fetchState, setFetchState] = useState<FetchState>("idle");
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>(orders[0]?.id ?? null);

  const isConfigured = !!(lsConfig.refreshToken && lsConfig.clientId && lsConfig.clientSecret && lsConfig.accountId);

  useEffect(() => {
    if (orders.length === 0 || !isConfigured) return;

    const allSkus = [...new Set(orders.flatMap((o) => o.items.map((i) => i.ean)))];
    if (allSkus.length === 0) return;

    setFetchState("loading");
    setFetchError(null);

    (async () => {
      try {
        const accessToken = await getAccessToken(lsConfig.clientId, lsConfig.clientSecret, lsConfig.refreshToken);
        const results = await searchByCustomSku(accessToken, lsConfig.accountId, allSkus);
        setLsItems(results);
        setFetchState("done");
      } catch (e) {
        setFetchError(e instanceof Error ? e.message : String(e));
        setFetchState("error");
      }
    })();
  }, [orders, lsConfig, isConfigured]);

  if (orders.length === 0) {
    return (
      <div className="page">
        <h1>Review</h1>
        <p className="subtitle">No orders loaded. Go back to Import first.</p>
      </div>
    );
  }

  const activeOrder = orders.find((o) => o.id === activeTab) ?? orders[0];
  const updates = activeOrder.items.filter((item) => lsItems.has(item.ean));
  const additions = activeOrder.items.filter((item) => !lsItems.has(item.ean));

  return (
    <div className="page">
      <h1>Review</h1>

      <div className="orders-header">
        <div className="tab-bar">
          {orders.map((order) => (
            <button
              key={order.id}
              className={`tab ${order.id === activeTab ? "active" : ""}`}
              onClick={() => setActiveTab(order.id)}
            >
              {order.id}
              <span className="tab-count">{order.items.length}</span>
            </button>
          ))}
        </div>
        <div className="fetch-status">
          {fetchState === "loading" && <span className="status-loading">Fetching Lightspeed records…</span>}
          {fetchState === "done" && <span className="status-ok">✓ {lsItems.size} records found</span>}
          {fetchState === "error" && <span className="status-error">Lightspeed error</span>}
          {!isConfigured && <span className="status-warn">Lightspeed not configured — go to Settings</span>}
        </div>
      </div>

      {fetchState === "error" && fetchError && <p className="error">{fetchError}</p>}

      {(fetchState === "idle" || fetchState === "loading") && (
        <p className="subtitle">
          {isConfigured ? "Checking Lightspeed…" : "Configure Lightspeed in Settings to continue."}
        </p>
      )}

      {fetchState === "done" && (
        <>
          <section className="review-section">
            <h2>Updates <span className="section-count">{updates.length}</span></h2>
            {updates.length === 0 ? (
              <p className="subtitle">No existing items to update.</p>
            ) : (
              <table className="preview-table">
                <thead>{COLUMNS}</thead>
                <tbody>
                  {updates.map((item) => <ItemRow key={item.ean} item={item} />)}
                </tbody>
              </table>
            )}
          </section>

          <section className="review-section">
            <h2>Additions <span className="section-count">{additions.length}</span></h2>
            {additions.length === 0 ? (
              <p className="subtitle">No new items to add.</p>
            ) : (
              <table className="preview-table">
                <thead>{COLUMNS}</thead>
                <tbody>
                  {additions.map((item) => <ItemRow key={item.ean} item={item} />)}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  );
}
