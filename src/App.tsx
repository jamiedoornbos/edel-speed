import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import Import from "./pages/Import";
import Review from "./pages/Review";
import Settings from "./pages/Settings";
import { Order, VendorMapping, LightspeedConfig, LightspeedItem } from "./types";
import { getAccessToken, searchByCustomSku } from "./lightspeed";
import "./App.css";

type FetchState = "idle" | "loading" | "done" | "error";

const MAPPINGS_KEY = "edelspeed.vendorMappings";
const LS_CONFIG_KEY = "edelspeed.lightspeedConfig";
const VENDOR_MAP_KEY = "edelspeed.vendorMap";
const MANUFACTURER_MAP_KEY = "edelspeed.manufacturerMap";

const DEFAULT_MAPPINGS: VendorMapping[] = [
  { infix: "ABR", vendor: "Hachette",             brand: "Abrams"             },
  { infix: "BAR", vendor: "Barefoot Books",        brand: ""                   },
  { infix: "BTP", vendor: "Baker & Taylor",        brand: ""                   },
  { infix: "CAP", vendor: "Capstone",              brand: ""                   },
  { infix: "CD",  vendor: "Cottage Door",          brand: ""                   },
  { infix: "CHR", vendor: "Hachette",              brand: "Chronicle"          },
  { infix: "HBG", vendor: "Hachette",              brand: ""                   },
  { infix: "PHA", vendor: "Hachette",              brand: "Phaidon"            },
  { infix: "QUA", vendor: "Hachette",              brand: "Quarto"             },
  { infix: "SBG", vendor: "Hachette",              brand: "Stable Book Group"  },
  { infix: "HC",  vendor: "Harper Collins",        brand: ""                   },
  { infix: "CON", vendor: "Ingram",                brand: "Consortium"         },
  { infix: "IPS", vendor: "Ingram",                brand: ""                   },
  { infix: "IPG", vendor: "IPG",                   brand: ""                   },
  { infix: "LER", vendor: "Lerner",                brand: ""                   },
  { infix: "MAC", vendor: "Macmillan",             brand: ""                   },
  { infix: "NOR", vendor: "Norton",                brand: ""                   },
  { infix: "ORC", vendor: "Orca",                  brand: ""                   },
  { infix: "CAN", vendor: "Penguin Random House",  brand: "Candlewick"         },
  { infix: "PRH", vendor: "Penguin Random House",  brand: ""                   },
  { infix: "SCH", vendor: "Scholastic",            brand: ""                   },
  { infix: "SS",  vendor: "Simon & Schuster",      brand: ""                   },
  { infix: "SOU", vendor: "Sourcebooks",           brand: ""                   },
];

const DEFAULT_LS_CONFIG: LightspeedConfig = {
  clientId: "",
  clientSecret: "",
  accountId: "",
  refreshToken: "",
};

function loadMappings(): VendorMapping[] {
  try {
    const stored = localStorage.getItem(MAPPINGS_KEY);
    if (stored === null) return DEFAULT_MAPPINGS;
    return JSON.parse(stored);
  } catch {
    return DEFAULT_MAPPINGS;
  }
}

function loadLsConfig(): LightspeedConfig {
  try {
    const stored = localStorage.getItem(LS_CONFIG_KEY);
    if (stored === null) return DEFAULT_LS_CONFIG;
    return { ...DEFAULT_LS_CONFIG, ...JSON.parse(stored) };
  } catch {
    return DEFAULT_LS_CONFIG;
  }
}

function loadVendorMap(): Map<string, string> {
  try {
    const stored = localStorage.getItem(VENDOR_MAP_KEY);
    if (!stored) return new Map();
    return new Map(Object.entries(JSON.parse(stored)));
  } catch {
    return new Map();
  }
}

function loadManufacturerMap(): Map<string, string> {
  try {
    const stored = localStorage.getItem(MANUFACTURER_MAP_KEY);
    if (!stored) return new Map();
    return new Map(Object.entries(JSON.parse(stored)));
  } catch {
    return new Map();
  }
}

function App() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [lsItems, setLsItems] = useState<Map<string, LightspeedItem>>(new Map());
  const [fetchState, setFetchState] = useState<FetchState>("idle");
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [mappings, setMappings] = useState<VendorMapping[]>(loadMappings);
  const [lsConfig, setLsConfig] = useState<LightspeedConfig>(loadLsConfig);
  const [vendorMap, setVendorMap] = useState<Map<string, string>>(loadVendorMap);
  const [manufacturerMap, setManufacturerMap] = useState<Map<string, string>>(loadManufacturerMap);

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
        const items = await searchByCustomSku(accessToken, lsConfig.accountId, allSkus);
        setLsItems(items);
        setFetchState("done");
      } catch (e) {
        setFetchError(e instanceof Error ? e.message : String(e));
        setFetchState("error");
      }
    })();
  }, [orders, lsConfig, isConfigured]);

  const saveMappings = (next: VendorMapping[]) => {
    setMappings(next);
    localStorage.setItem(MAPPINGS_KEY, JSON.stringify(next));
  };

  const saveLsConfig = (next: LightspeedConfig) => {
    setLsConfig(next);
    localStorage.setItem(LS_CONFIG_KEY, JSON.stringify(next));
  };

  const saveVendorMap = (next: Map<string, string>) => {
    setVendorMap(next);
    localStorage.setItem(VENDOR_MAP_KEY, JSON.stringify(Object.fromEntries(next)));
  };

  const saveManufacturerMap = (next: Map<string, string>) => {
    setManufacturerMap(next);
    localStorage.setItem(MANUFACTURER_MAP_KEY, JSON.stringify(Object.fromEntries(next)));
  };

  return (
    <BrowserRouter>
      <div className="layout">
        <nav className="sidebar">
          <div className="app-name">EdelSpeed</div>
          <NavLink to="/" end>Import</NavLink>
          <NavLink to="/review">Review</NavLink>
          <NavLink to="/settings">Settings</NavLink>
        </nav>
        <main className="content">
          <Routes>
            <Route path="/" element={<Import orders={orders} onImport={setOrders} mappings={mappings} activeTab={activeTab} onTabChange={setActiveTab} />} />
            <Route path="/review" element={<Review orders={orders} lsConfig={lsConfig} vendorMap={vendorMap} manufacturerMap={manufacturerMap} activeTab={activeTab} onTabChange={setActiveTab} lsItems={lsItems} fetchState={fetchState} fetchError={fetchError} />} />
            <Route path="/settings" element={
              <Settings
                mappings={mappings}
                onMappingsChange={saveMappings}
                lsConfig={lsConfig}
                onLsConfigChange={saveLsConfig}
                vendorMap={vendorMap}
                onVendorMapChange={saveVendorMap}
                manufacturerMap={manufacturerMap}
                onManufacturerMapChange={saveManufacturerMap}
              />
            } />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
