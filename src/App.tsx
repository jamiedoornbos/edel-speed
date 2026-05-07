import { useState } from "react";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import Import from "./pages/Import";
import Review from "./pages/Review";
import Settings from "./pages/Settings";
import { EdelweissItem } from "./types";
import "./App.css";

function App() {
  const [importedItems, setImportedItems] = useState<EdelweissItem[]>([]);

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
            <Route path="/" element={<Import onImport={setImportedItems} />} />
            <Route path="/review" element={<Review items={importedItems} />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
