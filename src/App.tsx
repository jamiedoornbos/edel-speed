import { useState } from "react";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import Import from "./pages/Import";
import Review from "./pages/Review";
import Settings from "./pages/Settings";
import { Order, VendorMapping } from "./types";
import "./App.css";

const MAPPINGS_KEY = "edelspeed.vendorMappings";

const DEFAULT_MAPPINGS: VendorMapping[] = [
  { infix: "ABR", vendor: "Hachette",             publisher: "Abrams"             },
  { infix: "BAR", vendor: "Barefoot Books",        publisher: ""                   },
  { infix: "BTP", vendor: "Baker & Taylor",        publisher: ""                   },
  { infix: "CAP", vendor: "Capstone",              publisher: ""                   },
  { infix: "CD",  vendor: "Cottage Door",          publisher: ""                   },
  { infix: "CHR", vendor: "Hachette",              publisher: "Chronicle"          },
  { infix: "HBG", vendor: "Hachette",              publisher: ""                   },
  { infix: "PHA", vendor: "Hachette",              publisher: "Phaidon"            },
  { infix: "QUA", vendor: "Hachette",              publisher: "Quarto"             },
  { infix: "SBG", vendor: "Hachette",              publisher: "Stable Book Group"  },
  { infix: "HC",  vendor: "Harper Collins",        publisher: ""                   },
  { infix: "CON", vendor: "Ingram",                publisher: "Consortium"         },
  { infix: "IPS", vendor: "Ingram",                publisher: ""                   },
  { infix: "IPG", vendor: "IPG",                   publisher: ""                   },
  { infix: "LER", vendor: "Lerner",                publisher: ""                   },
  { infix: "MAC", vendor: "Macmillan",             publisher: ""                   },
  { infix: "NOR", vendor: "Norton",                publisher: ""                   },
  { infix: "ORC", vendor: "Orca",                  publisher: ""                   },
  { infix: "CAN", vendor: "Penguin Random House",  publisher: "Candlewick"         },
  { infix: "PRH", vendor: "Penguin Random House",  publisher: ""                   },
  { infix: "SCH", vendor: "Scholastic",            publisher: ""                   },
  { infix: "SS",  vendor: "Simon & Schuster",      publisher: ""                   },
  { infix: "SOU", vendor: "Sourcebooks",           publisher: ""                   },
];

function loadMappings(): VendorMapping[] {
  try {
    const stored = localStorage.getItem(MAPPINGS_KEY);
    if (stored === null) return DEFAULT_MAPPINGS;
    return JSON.parse(stored);
  } catch {
    return DEFAULT_MAPPINGS;
  }
}

function App() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [mappings, setMappings] = useState<VendorMapping[]>(loadMappings);

  const saveMappings = (next: VendorMapping[]) => {
    setMappings(next);
    localStorage.setItem(MAPPINGS_KEY, JSON.stringify(next));
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
            <Route path="/review" element={<Review orders={orders} />} />
            <Route path="/settings" element={<Settings mappings={mappings} onMappingsChange={saveMappings} />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
