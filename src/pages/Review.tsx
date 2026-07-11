import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Order, LightspeedConfig, LightspeedItem, EdelweissItem, LightspeedUpdate, LightspeedAddition } from "../types";
import { buildLightspeedUpdate, isCuratedTag } from "../lightspeed";

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
  titleOverrides: Map<string, string>;
  onTitleOverride: (ean: string, val: string) => void;
  categoryOverrides: Map<string, string>;
  onCategoryOverride: (ean: string, val: string) => void;
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
    <th>SubCategory</th>
    <th>Author</th>
    <th>EAN</th>
    <th>Vendor</th>
    <th>Brand</th>
    <th>List Price</th>
    <th>Cost</th>
  </tr>
);

function DiffCell({
  differs,
  old: oldVal,
  next,
  children,
}: {
  differs: boolean;
  old: string;
  next: string;
  children?: React.ReactNode;
}) {
  if (!differs)
    return (
      <td>
        {next}
        {children}
      </td>
    );
  return (
    <td className="cell-diff">
      {oldVal} → {next}
      {children}
    </td>
  );
}

function UpdateRow({ u, onSwap }: { u: LightspeedUpdate; onSwap: () => void }) {
  const nextTags = [...new Set([...u.authorTags, ...u.lsTags.filter(isCuratedTag)])].join(", ");
  return (
    <tr>
      <td>
        <a
          href={`https://us.merchantos.com/?name=item.views.item&form_name=view&id=${u.lsItem.itemID}&tab=details`}
          target="_blank"
          rel="noreferrer"
        >
          {u.edelweiss.title}
        </a>
      </td>
      <td className="mono">{u.edelweiss.ean}</td>
      <DiffCell differs={u.costDiffers} old={`$${u.lsCost.toFixed(2)}`} next={`$${u.edelweiss.cost.toFixed(2)}`} />
      <DiffCell differs={u.vendorDiffers} old={u.lsVendorName} next={u.edelweiss.vendor} />
      <DiffCell differs={u.brandDiffers} old={u.lsManufacturerName} next={u.edelweiss.brand} />
      <DiffCell differs={u.tagsDiffer} old={u.lsTags.join(", ")} next={nextTags}>
        {u.edelweiss.author2 !== "" && (
          <button className="swap-author-btn" onClick={onSwap} title="Swap author">
            ⇆
          </button>
        )}
      </DiffCell>
    </tr>
  );
}

type DropdownPos = { top: number; left: number; width: number } | { bottom: number; left: number; width: number };

function CategoryInput({
  value,
  categoryMap,
  onChange,
}: {
  value: string;
  categoryMap: Map<string, string>;
  onChange: (val: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dropdownPos, setDropdownPos] = useState<DropdownPos | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const valueOnFocus = useRef<string>(value);
  const matches =
    value.length >= 2
      ? [...categoryMap.keys()].filter((k) => k.toLowerCase().startsWith(value.toLowerCase())).sort()
      : [];

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", close, { capture: true });
  }, [open]);

  const handleChange = (val: string) => {
    onChange(val);
    setSelectedIndex(0);
    setOpen(true);
  };

  const select = (name: string) => {
    onChange(name);
    setOpen(false);
  };

  const handleFocus = () => {
    valueOnFocus.current = value;
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      if (window.innerHeight - rect.bottom < 220) {
        setDropdownPos({ bottom: window.innerHeight - rect.top + 2, left: rect.left, width: rect.width });
      } else {
        setDropdownPos({ top: rect.bottom + 2, left: rect.left, width: rect.width });
      }
    }
    setOpen(true);
  };

  const handleBlur = () => {
    setOpen(false);
    if (!categoryMap.has(value)) {
      onChange(valueOnFocus.current);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || matches.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      select(matches[selectedIndex]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      inputRef.current?.blur();
    }
  };

  return (
    <div className="category-combobox">
      <input
        ref={inputRef}
        className="mapping-input"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
      {open &&
        matches.length > 0 &&
        dropdownPos &&
        createPortal(
          <ul
            className="category-suggestions"
            style={{ position: "fixed", ...dropdownPos, minWidth: dropdownPos.width }}
          >
            {matches.map((name, i) => (
              <li
                key={name}
                className={i === selectedIndex ? "active" : undefined}
                onMouseDown={() => select(name)}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                {name}
              </li>
            ))}
          </ul>,
          document.body
        )}
    </div>
  );
}

function AdditionRow({
  item,
  title,
  storeCategory,
  categoryMap,
  swapped,
  onTitleChange,
  onCategoryChange,
  onSwap,
}: {
  item: EdelweissItem;
  title: string;
  storeCategory: string;
  categoryMap: Map<string, string>;
  swapped: boolean;
  onTitleChange: (val: string) => void;
  onCategoryChange: (val: string) => void;
  onSwap: () => void;
}) {
  const categoryKnown = categoryMap.size === 0 || categoryMap.has(storeCategory);
  const effectiveAuthor = swapped ? item.author2 : item.author;
  return (
    <tr>
      <td>
        <input className="mapping-input" value={title} onChange={(e) => onTitleChange(e.target.value)} />
      </td>
      <td>
        {categoryMap.size === 0 ? (
          <span className={categoryKnown ? undefined : "ls-missing"}>{storeCategory || "—"}</span>
        ) : (
          <CategoryInput value={storeCategory} categoryMap={categoryMap} onChange={onCategoryChange} />
        )}
      </td>
      <td>
        {effectiveAuthor}
        {item.author2 !== "" && (
          <button className="swap-author-btn" onClick={onSwap} title="Swap author">
            ⇆
          </button>
        )}
      </td>
      <td className="mono">{item.ean}</td>
      <td>{item.vendor}</td>
      <td>{item.brand}</td>
      <td>${item.listPrice.toFixed(2)}</td>
      <td>${item.cost.toFixed(2)}</td>
    </tr>
  );
}

export default function Review({
  orders,
  lsConfig,
  vendorMap,
  manufacturerMap,
  activeTab,
  onTabChange,
  lsItems,
  fetchState,
  fetchError,
  categoryMap,
  titleOverrides,
  onTitleOverride,
  categoryOverrides,
  onCategoryOverride,
}: Props) {
  const navigate = useNavigate();
  const [showUnchanged, setShowUnchanged] = useState(false);
  const [toggledEans, setToggledEans] = useState<Set<string>>(new Set());

  function toggleSwap(ean: string) {
    setToggledEans((prev) => {
      const next = new Set(prev);
      if (next.has(ean)) next.delete(ean);
      else next.add(ean);
      return next;
    });
  }

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
        {fetchState === "error" ? (
          <p className="error">{fetchError ?? "Lightspeed error"}</p>
        ) : (
          <p className="subtitle">
            {isConfigured ? "Checking Lightspeed…" : "Lightspeed not configured — go to Settings."}
          </p>
        )}
      </div>
    );
  }

  const activeOrder = orders.find((o) => o.id === activeTab) ?? orders[0];

  const updatesByOrder = new Map(
    orders.map((order) => [
      order.id,
      order.items
        .filter((item) => lsItems.has(item.ean))
        .map((item) => {
          const u = buildLightspeedUpdate(item, lsItems.get(item.ean)!, vendorMap, manufacturerMap);
          if (toggledEans.has(item.ean)) u.useAuthor2 = !u.useAuthor2;
          return u;
        }),
    ])
  );

  const additionsByOrder = new Map(
    orders.map((order) => [order.id, order.items.filter((item) => !lsItems.has(item.ean))])
  );

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
                  (additionsByOrder.get(order.id) ?? []).length}{" "}
                / {order.items.length}
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
              <input type="checkbox" checked={showUnchanged} onChange={(e) => setShowUnchanged(e.target.checked)} />
              Show unchanged rows
            </label>
            <table className="preview-table">
              <thead>{UPDATE_COLUMNS}</thead>
              <tbody>
                {(updatesByOrder.get(activeOrder.id) ?? [])
                  .filter((u) => showUnchanged || u.changed)
                  .map((u) => (
                    <UpdateRow key={u.edelweiss.ean} u={u} onSwap={() => toggleSwap(u.edelweiss.ean)} />
                  ))}
              </tbody>
            </table>
          </>
        )}
      </section>

      <section className="review-section">
        <h2>
          Additions <span className="section-count">{(additionsByOrder.get(activeOrder.id) ?? []).length}</span>
        </h2>
        {(additionsByOrder.get(activeOrder.id) ?? []).length === 0 ? (
          <p className="subtitle">No new items to add.</p>
        ) : (
          <div className="table-scroll">
            <table className="preview-table">
              <thead>{ADDITION_COLUMNS}</thead>
              <tbody>
                {(additionsByOrder.get(activeOrder.id) ?? []).map((item) => (
                  <AdditionRow
                    key={item.ean}
                    item={item}
                    title={titleOverrides.get(item.ean) ?? item.title}
                    storeCategory={categoryOverrides.get(item.ean) ?? item.storeCategory}
                    categoryMap={categoryMap}
                    swapped={toggledEans.has(item.ean)}
                    onTitleChange={(val) => onTitleOverride(item.ean, val)}
                    onCategoryChange={(val) => onCategoryOverride(item.ean, val)}
                    onSwap={() => toggleSwap(item.ean)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="review-footer">
        <button
          className="primary"
          onClick={() => {
            const updates = orders.flatMap((order) => (updatesByOrder.get(order.id) ?? []).filter((u) => u.changed));
            const additions: LightspeedAddition[] = orders.flatMap((order) =>
              order.items
                .filter((item) => !lsItems.has(item.ean))
                .map((item) => {
                  const title = titleOverrides.get(item.ean) ?? item.title;
                  const storeCategory = categoryOverrides.get(item.ean) ?? item.storeCategory;
                  const author = toggledEans.has(item.ean) ? item.author2 : item.author;
                  return {
                    title,
                    ean: item.ean,
                    author,
                    vendor: item.vendor,
                    brand: item.brand,
                    listPrice: item.listPrice,
                    cost: item.cost,
                    storeCategory,
                    categoryID: categoryMap.get(storeCategory) ?? "",
                  };
                })
            );
            navigate("/results", { state: { updates, additions } });
          }}
        >
          Upload to Lightspeed
          <span className="tab-count">
            {orders.reduce(
              (sum, order) =>
                sum +
                (updatesByOrder.get(order.id) ?? []).filter((u) => u.changed).length +
                (additionsByOrder.get(order.id) ?? []).length,
              0
            )}
          </span>
        </button>
      </div>
    </div>
  );
}
