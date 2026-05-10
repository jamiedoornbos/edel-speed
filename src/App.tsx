import { useState } from "react";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import Import from "./pages/Import";
import Review from "./pages/Review";
import Settings from "./pages/Settings";
import { Order, VendorMapping, LightspeedConfig } from "./types";
import "./App.css";

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
  const [mappings, setMappings] = useState<VendorMapping[]>(loadMappings);
  const [lsConfig, setLsConfig] = useState<LightspeedConfig>(loadLsConfig);
  const [vendorMap, setVendorMap] = useState<Map<string, string>>(loadVendorMap);
  const [manufacturerMap, setManufacturerMap] = useState<Map<string, string>>(loadManufacturerMap);

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
            <Route path="/" element={<Import onImport={setOrders} mappings={mappings} />} />
            <Route path="/review" element={<Review orders={orders} lsConfig={lsConfig} vendorMap={vendorMap} manufacturerMap={manufacturerMap} />} />
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
