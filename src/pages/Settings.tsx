import { useState } from "react";
import { VendorMapping } from "../types";

interface Props {
  mappings: VendorMapping[];
  onMappingsChange: (mappings: VendorMapping[]) => void;
}

export default function Settings({ mappings, onMappingsChange }: Props) {
  const [infix, setInfix] = useState("");
  const [vendor, setVendor] = useState("");
  const [publisher, setPublisher] = useState("");

  const add = () => {
    const key = infix.trim().toUpperCase();
    if (!key || !vendor.trim()) return;
    const entry: VendorMapping = { infix: key, vendor: vendor.trim(), publisher: publisher.trim() };
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
    setPublisher("");
  };

  const remove = (key: string) => {
    onMappingsChange(mappings.filter((m) => m.infix !== key));
  };

  return (
    <div className="page">
      <h1>Settings</h1>
      <p className="subtitle">Map order ID infixes to Lightspeed vendor and publisher.</p>

      <table className="preview-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Vendor</th>
            <th>Publisher</th>
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
              <td>{m.publisher}</td>
              <td>
                <button className="btn-remove" onClick={() => remove(m.infix)}>Remove</button>
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
          placeholder="Publisher"
          value={publisher}
          onChange={(e) => setPublisher(e.target.value)}
        />
        <button className="primary" onClick={add}>Add</button>
      </div>
    </div>
  );
}
