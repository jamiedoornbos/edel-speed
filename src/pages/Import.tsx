import { useState, useCallback, useEffect } from "react";
import Papa from "papaparse";
import { useNavigate } from "react-router-dom";
import { listen } from "@tauri-apps/api/event";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { EdelweissItem } from "../types";

interface Props {
  onImport: (items: EdelweissItem[]) => void;
}

interface DragDropPayload {
  paths: string[];
  position: { x: number; y: number };
}

export default function Import({ onImport }: Props) {
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<EdelweissItem[]>([]);
  const navigate = useNavigate();

  const parseText = useCallback((text: string, name: string) => {
    setError(null);
    setFileName(name);

    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim(),
      complete: (results) => {
        const items: EdelweissItem[] = (results.data as Record<string, string>[])
          .map((row) => ({
            title: row["Title"]?.trim() ?? "",
            ean: row["EAN"]?.trim() ?? "",
            vendor: row["Vendor"]?.trim() ?? "",
            listPrice: parseFloat(row["List Price"]) || 0,
            storeCategory: row["Store Category"]?.trim() ?? "",
            author: row["Author"]?.trim() ?? "",
            cost: parseFloat(row["Cost"]) || 0,
          }))
          .filter((item) => item.ean !== "");

        setPreview(items);
      },
      error: () => {
        setError("Failed to parse CSV. Please check the file format.");
      },
    });
  }, []);

  // Tauri native drag-drop (works on Linux/WebKitGTK)
  useEffect(() => {
    const unlistenDrop = listen<DragDropPayload>("tauri://drag-drop", async (event) => {
      setDragging(false);
      const path = event.payload.paths[0];
      if (!path?.endsWith(".csv")) {
        setError("Please drop a CSV file.");
        return;
      }
      try {
        const text = await readTextFile(path);
        const name = path.split("/").pop() ?? path;
        parseText(text, name);
      } catch {
        setError("Could not read the file.");
      }
    });

    const unlistenEnter = listen("tauri://drag-enter", () => setDragging(true));
    const unlistenLeave = listen("tauri://drag-leave", () => setDragging(false));

    return () => {
      unlistenDrop.then((f) => f());
      unlistenEnter.then((f) => f());
      unlistenLeave.then((f) => f());
    };
  }, [parseText]);

  // Fallback: click to browse
  const onFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => parseText(ev.target?.result as string, file.name);
      reader.readAsText(file);
    },
    [parseText]
  );

  const handleProceed = () => {
    onImport(preview);
    navigate("/review");
  };

  return (
    <div className="page">
      <h1>Import Edelweiss Order</h1>
      <p className="subtitle">
        Log into Edelweiss, download your order export, then drop it below.
      </p>

      <div
        className={`drop-zone ${dragging ? "dragging" : ""} ${fileName ? "has-file" : ""}`}
        onClick={() => document.getElementById("file-input")?.click()}
      >
        <input
          id="file-input"
          type="file"
          accept=".csv"
          style={{ display: "none" }}
          onChange={onFileInput}
        />
        {fileName ? (
          <>
            <div className="drop-icon">✓</div>
            <div className="drop-filename">{fileName}</div>
            <div className="drop-hint">Drop another file to replace</div>
          </>
        ) : (
          <>
            <div className="drop-icon">↓</div>
            <div className="drop-label">Drop CSV here</div>
            <div className="drop-hint">or click to browse</div>
          </>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      {preview.length > 0 && (
        <>
          <div className="preview-header">
            <span>{preview.length} titles found</span>
            <button className="primary" onClick={handleProceed}>
              Proceed to Review →
            </button>
          </div>
          <table className="preview-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>EAN</th>
                <th>Author</th>
                <th>List Price</th>
                <th>Cost</th>
                <th>Category</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((item) => (
                <tr key={item.ean}>
                  <td>{item.title}</td>
                  <td className="mono">{item.ean}</td>
                  <td>{item.author}</td>
                  <td>${item.listPrice.toFixed(2)}</td>
                  <td>${item.cost.toFixed(2)}</td>
                  <td>{item.storeCategory}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
