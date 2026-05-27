import { useState, useCallback, useEffect } from "react";
import Papa from "papaparse";
import { useNavigate } from "react-router-dom";
import { listen } from "@tauri-apps/api/event";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { EdelweissItem, Order, VendorMapping } from "../types";

interface Props {
  orders: Order[];
  onImport: (orders: Order[]) => void;
  mappings: VendorMapping[];
  activeTab: string | null;
  onTabChange: (id: string | null) => void;
}

interface DragDropPayload {
  paths: string[];
  position: { x: number; y: number };
}

function extractOrderId(filename: string): string {
  const match = filename.match(/OrderExport_(\w+)\.csv/i);
  return match ? match[1] : filename.replace(/\.csv$/i, "");
}

// BLCHR526     → CHR  (skip 2-char prefix, take 2–3 letters before the digits)
// SPCXXXPRH526 → PRH  (skip "SPC" + 3 unrelated letters, then take 2–3 letters before the digits)
// FLPRHFA25    → PRH  (skip "FL", take 2–3 letters before the 2-letter season + 2-digit year)
function extractInfix(orderId: string): string {
  const upper = orderId.toUpperCase();
  if (upper.startsWith("FL")) {
    const match = upper.slice(2).match(/^([A-Z]{2,3})[A-Z]{2}\d{2}/);
    return match ? match[1] : "";
  }
  const pattern = /^([A-Z]{2,3})\d/;
  const vendorAndNumber = upper.slice(upper.startsWith("SPC") ? 6 : 2);
  const match = vendorAndNumber.match(pattern);
  return match ? match[1] : "";
}

export default function Import({ orders, onImport, mappings, activeTab, onTabChange }: Props) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const parseFile = useCallback(
    (text: string, filename: string): Order | null => {
      const id = extractOrderId(filename);
      const infix = extractInfix(id);
      const mapping = mappings.find((m) => m.infix === infix);

      let result: Order | null = null;
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h: string) => h.trim(),
        complete: (results) => {
          const items: EdelweissItem[] = (results.data as Record<string, string>[])
            .map((row) => ({
              title: row["Title"]?.trim() ?? "",
              ean: row["EAN"]?.trim() ?? "",
              vendor: mapping?.vendor ?? row["Vendor"]?.trim() ?? "",
              brand: mapping?.brand ?? "",
              listPrice: parseFloat(row["List Price"]) || 0,
              storeCategory: row["Store Category"]?.trim() ?? "",
              author: row["Author"]?.trim() ?? "",
              cost: parseFloat(row["Cost"]) || 0,
            }))
            .filter((item) => item.ean !== "");
          result = { id, infix, filename, items };
        },
        error: () => {
          setError(`Failed to parse ${filename}.`);
        },
      });
      return result;
    },
    [mappings]
  );

  const mergeOrders = useCallback((base: Order[], incoming: Order[]): Order[] => {
    const merged = [...base];
    for (const order of incoming) {
      const idx = merged.findIndex((o) => o.id === order.id);
      if (idx >= 0) merged[idx] = order;
      else merged.push(order);
    }
    return merged;
  }, []);

  useEffect(() => {
    const unlistenDrop = listen<DragDropPayload>("tauri://drag-drop", async (event) => {
      setDragging(false);
      setError(null);
      const csvPaths = event.payload.paths.filter((p) => p.endsWith(".csv"));
      if (csvPaths.length === 0) {
        setError("Please drop CSV files.");
        return;
      }
      const incoming: Order[] = [];
      for (const path of csvPaths) {
        try {
          const text = await readTextFile(path);
          const name = path.split("/").pop() ?? path;
          const order = parseFile(text, name);
          if (order) incoming.push(order);
        } catch {
          setError("Could not read one or more files.");
        }
      }
      if (incoming.length > 0) {
        const next = mergeOrders(orders, incoming);
        onImport(next);
        onTabChange(incoming[incoming.length - 1].id);
      }
    });

    const unlistenEnter = listen("tauri://drag-enter", () => setDragging(true));
    const unlistenLeave = listen("tauri://drag-leave", () => setDragging(false));

    return () => {
      unlistenDrop.then((f) => f());
      unlistenEnter.then((f) => f());
      unlistenLeave.then((f) => f());
    };
  }, [parseFile, mergeOrders, orders, onImport, onTabChange]);

  const onFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const incoming: Order[] = [];
      Array.from(e.target.files ?? []).forEach((file) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const order = parseFile(ev.target?.result as string, file.name);
          if (order) incoming.push(order);
          if (incoming.length === e.target.files!.length) {
            const next = mergeOrders(orders, incoming);
            onImport(next);
            onTabChange(incoming[incoming.length - 1].id);
          }
        };
        reader.readAsText(file);
      });
      e.target.value = "";
    },
    [parseFile, mergeOrders, orders, onImport, onTabChange]
  );

  const handleProceed = () => {
    navigate("/review");
  };

  const handleClear = () => {
    onImport([]);
    onTabChange(null);
  };

  const activeOrder = orders.find((o) => o.id === activeTab);

  return (
    <div className="page">
      <h1>Import Edelweiss Orders</h1>
      <p className="subtitle">Drop one or more Edelweiss order exports below.</p>

      <div
        className={`drop-zone ${dragging ? "dragging" : ""} ${orders.length > 0 ? "has-file compact" : ""}`}
        onClick={() => document.getElementById("file-input")?.click()}
      >
        <input id="file-input" type="file" accept=".csv" multiple style={{ display: "none" }} onChange={onFileInput} />
        {orders.length > 0 ? (
          <>
            <div className="drop-icon">+</div>
            <div className="drop-hint">Drop more files or click to add</div>
          </>
        ) : (
          <>
            <div className="drop-icon">↓</div>
            <div className="drop-label">Drop CSV files here</div>
            <div className="drop-hint">or click to browse · multiple files supported</div>
          </>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      {orders.length > 0 && (
        <>
          <div className="orders-header">
            <div className="tab-bar">
              {orders.map((order) => (
                <button
                  key={order.id}
                  className={`tab ${order.id === activeTab ? "active" : ""}`}
                  onClick={() => onTabChange(order.id)}
                >
                  {order.id}
                  <span className="tab-count">{order.items.length}</span>
                </button>
              ))}
            </div>
            <div className="button-group">
              <button className="secondary" onClick={handleClear}>
                Clear
              </button>
              <button className="primary" onClick={handleProceed}>
                Review →
              </button>
            </div>
          </div>

          {activeOrder && (
            <table className="preview-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Author</th>
                  <th>EAN</th>
                  <th>Vendor</th>
                  <th>Brand</th>
                  <th>List Price</th>
                  <th>Cost</th>
                </tr>
              </thead>
              <tbody>
                {activeOrder.items.map((item) => (
                  <tr key={item.ean}>
                    <td>{item.title}</td>
                    <td>{item.author}</td>
                    <td className="mono">{item.ean}</td>
                    <td>{item.vendor}</td>
                    <td>{item.brand}</td>
                    <td>${item.listPrice.toFixed(2)}</td>
                    <td>${item.cost.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
