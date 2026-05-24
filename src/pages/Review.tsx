import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Order, LightspeedConfig, LightspeedItem, EdelweissItem, LightspeedUpdate } from "../types";
import { buildLightspeedUpdate } from "../lightspeed";

type FetchState = "idle" | "loading" | "done" | "error";

interface Props {
  orders: Order[];
  lsConfig: LightspeedConfig;
  vendorMap: Map<string, string>;
  manufacturerMap: Map<string, string>;
  activeTab: string | null;
  onTabChange: (id: string | null) => void;
  lsItems: Map<string, LightspeedItem>;
  fetchState: FetchState;
  fetchError: string | null;
  categoryMap: Map<string, string>;
}

const UPDATE_COLUMNS = (
  <tr>
    <th>Title</th>
    <th>EAN</th>
    <th>Cost</th>
    <th>Vendor</th>
    <th>Brand</th>
    <th>Tags</th>
  </tr>
);

const ADDITION_COLUMNS = (
  <tr>
    <th>Title</th>
    <th>Category</th>
    <th>Author</th>
    <th>EAN</th>
    <th>Vendor</th>
    <th>Brand</th>
    <th>List Price</th>
    <th>Cost</th>
  </tr>
);

function DiffCell({ differs, old: oldVal, next }: { differs: boolean; old: string; next: string }) {
  if (!differs) return <td>{next}</td>;
  return <td className="cell-diff">{oldVal} → {next}</td>;
}

function UpdateRow({ u }: { u: LightspeedUpdate }) {
  return (
    <tr>
      <td>{u.edelweiss.title}</td>
      <td className="mono">{u.edelweiss.ean}</td>
      <DiffCell differs={u.costDiffers} old={`$${u.lsCost.toFixed(2)}`} next={`$${u.edelweiss.cost.toFixed(2)}`} />
      <DiffCell differs={u.vendorDiffers} old={u.lsVendorName} next={u.edelweiss.vendor} />
      <DiffCell differs={u.brandDiffers} old={u.lsManufacturerName} next={u.edelweiss.brand} />
      <DiffCell differs={u.tagsDiffer} old={u.lsTags.join(", ")} next={u.authorTags.join(", ")} />
    </tr>
  );
}

function AdditionRow({ item, categoryMap }: { item: EdelweissItem; categoryMap: Map<string, string> }) {
  const categoryKnown = categoryMap.size === 0 || categoryMap.has(item.storeCategory);
  return (
    <tr>
      <td>{item.title}</td>
      <td className={categoryKnown ? undefined : "ls-missing"}>{item.storeCategory || "—"}</td>
      <td>{item.author}</td>
      <td className="mono">{item.ean}</td>
      <td>{item.vendor}</td>
      <td>{item.brand}</td>
      <td>${item.listPrice.toFixed(2)}</td>
      <td>${item.cost.toFixed(2)}</td>
    </tr>
  );
}

export default function Review({ orders, lsConfig, vendorMap, manufacturerMap, activeTab, onTabChange, lsItems, fetchState, fetchError, categoryMap }: Props) {
  const navigate = useNavigate();
  const [showUnchanged, setShowUnchanged] = useState(false);

  const isConfigured = !!(lsConfig.refreshToken && lsConfig.clientId && lsConfig.clientSecret && lsConfig.accountId);

  if (orders.length === 0) {
    return (
      <div className="page">
        <h1>Review Updates</h1>
        <p className="subtitle">No orders loaded. Go back to Import first.</p>
      </div>
    );
  }

  if (fetchState !== "done") {
    return (
      <div className="page">
        <h1>Review Updates</h1>
        {fetchState === "error"
          ? <p className="error">{fetchError ?? "Lightspeed error"}</p>
          : <p className="subtitle">{isConfigured ? "Checking Lightspeed…" : "Lightspeed not configured — go to Settings."}</p>}
      </div>
    );
  }

  const activeOrder = orders.find((o) => o.id === activeTab) ?? orders[0];

  const updatesByOrder = new Map(orders.map((order) => [
    order.id,
    order.items
      .filter((item) => lsItems.has(item.ean))
      .map((item) => buildLightspeedUpdate(item, lsItems.get(item.ean)!, vendorMap, manufacturerMap)),
  ]));

  const additionsByOrder = new Map(orders.map((order) => [
    order.id,
    order.items.filter((item) => !lsItems.has(item.ean)),
  ]));

  return (
    <div className="page">
      <h1>Review Updates</h1>

      <div className="orders-header">
        <div className="tab-bar">
          {orders.map((order) => (
            <button
              key={order.id}
              className={`tab ${order.id === activeTab ? "active" : ""}`}
              onClick={() => onTabChange(order.id)}
            >
              {order.id}
              <span className="tab-count">
                {(updatesByOrder.get(order.id) ?? []).filter((u) => u.changed).length +
                  (additionsByOrder.get(order.id) ?? []).length} / {order.items.length}
              </span>
            </button>
          ))}
        </div>
        <div className="fetch-status">
          <span className="status-ok">✓ {lsItems.size} records found</span>
        </div>
      </div>

      <section className="review-section">
        {(updatesByOrder.get(activeOrder.id) ?? []).length === 0 ? (
          <p className="subtitle">No existing items to update.</p>
        ) : (
          <>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={showUnchanged}
                onChange={(e) => setShowUnchanged(e.target.checked)}
              />
              Show unchanged rows
            </label>
            <table className="preview-table">
              <thead>{UPDATE_COLUMNS}</thead>
              <tbody>
                {(updatesByOrder.get(activeOrder.id) ?? [])
                  .filter((u) => showUnchanged || u.changed)
                  .map((u) => <UpdateRow key={u.edelweiss.ean} u={u} />)}
              </tbody>
            </table>
          </>
        )}
      </section>

      <section className="review-section">
        <h2>Additions <span className="section-count">{(additionsByOrder.get(activeOrder.id) ?? []).length}</span></h2>
        {(additionsByOrder.get(activeOrder.id) ?? []).length === 0 ? (
          <p className="subtitle">No new items to add.</p>
        ) : (
          <table className="preview-table">
            <thead>{ADDITION_COLUMNS}</thead>
            <tbody>
              {(additionsByOrder.get(activeOrder.id) ?? []).map((item) => <AdditionRow key={item.ean} item={item} categoryMap={categoryMap} />)}
            </tbody>
          </table>
        )}
      </section>

      <div className="review-footer">
        <button
          className="primary"
          onClick={() => {
            const updates = orders.flatMap(order =>
              order.items
                .filter(item => lsItems.has(item.ean))
                .map(item => buildLightspeedUpdate(item, lsItems.get(item.ean)!, vendorMap, manufacturerMap))
                .filter(u => u.changed)
            );
            navigate("/results", { state: { updates } });
          }}
        >
          Upload to Lightspeed
          <span className="tab-count">
            {orders.reduce((sum, order) =>
              sum +
              (updatesByOrder.get(order.id) ?? []).filter((u) => u.changed).length +
              (additionsByOrder.get(order.id) ?? []).length, 0)}
          </span>
        </button>
      </div>
    </div>
  );
}
