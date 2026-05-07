import { useState, useEffect } from "react";
import { Order, LightspeedConfig, LightspeedItem } from "../types";
import { getAccessToken, searchByCustomSku } from "../lightspeed";

interface Props {
  orders: Order[];
  lsConfig: LightspeedConfig;
}

type FetchState = "idle" | "loading" | "done" | "error";

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

      <table className="preview-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Author</th>
            <th>EAN</th>
            <th>Vendor</th>
            <th>Publisher</th>
            <th>List Price</th>
            <th>Cost</th>
            <th>In Lightspeed</th>
          </tr>
        </thead>
        <tbody>
          {activeOrder.items.map((item) => {
            const lsItem = lsItems.get(item.ean);
            return (
              <tr key={item.ean}>
                <td>{item.title}</td>
                <td>{item.author}</td>
                <td className="mono">{item.ean}</td>
                <td>{item.vendor}</td>
                <td>{item.publisher}</td>
                <td>${item.listPrice.toFixed(2)}</td>
                <td>${item.cost.toFixed(2)}</td>
                <td className={lsItem ? "ls-found" : fetchState === "done" ? "ls-missing" : ""}>
                  {fetchState === "done" ? (lsItem ? `✓ #${lsItem.itemID}` : "Not found") : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
