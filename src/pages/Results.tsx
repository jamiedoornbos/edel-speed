import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { LightspeedUpdate, LightspeedAddition, LightspeedConfig, UploadResult, AdditionUploadResult } from "../types";
import { getAccessToken, uploadSingleItem, uploadSingleAddition } from "../lightspeed";

interface Props {
  lsConfig: LightspeedConfig;
  vendorMap: Map<string, string>;
  manufacturerMap: Map<string, string>;
}

function UploadResultRow({ result }: { result: UploadResult }) {
  const changes = [
    ...result.fieldsChanged.filter((f) => f !== "tags"),
    ...result.tagsAdded.map((t) => `+${t}`),
    ...result.tagsRemoved.map((t) => `-${t}`),
  ].join(", ");

  return (
    <>
      <tr>
        <td className="mono">{result.ean}</td>
        <td>{result.title}</td>
        <td>{changes || "—"}</td>
        <td>
          {result.status === "pending" && <span className="status-loading">Pending</span>}
          {result.status === "uploading" && <span className="status-loading">Uploading…</span>}
          {result.status === "done" && <span className="status-ok">✓ Done</span>}
          {result.status === "error" && <span className="status-error">✗ Error</span>}
        </td>
      </tr>
      {result.status === "error" && result.error && (
        <tr>
          <td />
          <td colSpan={3} className="upload-error-detail">
            {result.error}
          </td>
        </tr>
      )}
    </>
  );
}

function AdditionResultRow({ result }: { result: AdditionUploadResult }) {
  return (
    <>
      <tr>
        <td className="mono">{result.ean}</td>
        <td>{result.title}</td>
        <td>
          {result.status === "pending" && <span className="status-loading">Pending</span>}
          {result.status === "uploading" && <span className="status-loading">Uploading…</span>}
          {result.status === "done" && <span className="status-ok">✓ Created</span>}
          {result.status === "error" && <span className="status-error">✗ Error</span>}
        </td>
      </tr>
      {result.status === "error" && result.error && (
        <tr>
          <td />
          <td colSpan={2} className="upload-error-detail">
            {result.error}
          </td>
        </tr>
      )}
    </>
  );
}

export default function Results({ lsConfig, vendorMap, manufacturerMap }: Props) {
  const { state } = useLocation();
  const updates: LightspeedUpdate[] =
    (state as { updates?: LightspeedUpdate[]; additions?: LightspeedAddition[] } | null)?.updates ?? [];
  const additions: LightspeedAddition[] =
    (state as { updates?: LightspeedUpdate[]; additions?: LightspeedAddition[] } | null)?.additions ?? [];

  const [phase, setPhase] = useState<"running" | "done">("running");
  const [results, setResults] = useState<UploadResult[]>(() =>
    updates.map((u) => ({
      ean: u.edelweiss.ean,
      title: u.edelweiss.title,
      itemID: u.lsItem.itemID,
      status: "pending",
      fieldsChanged: [],
      tagsAdded: [],
      tagsRemoved: [],
    }))
  );
  const [additionResults, setAdditionResults] = useState<AdditionUploadResult[]>(() =>
    additions.map((a) => ({ ean: a.ean, title: a.title, status: "pending" }))
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (updates.length === 0 && additions.length === 0) {
      setPhase("done");
      return;
    }

    const run = async () => {
      let accessToken: string;
      try {
        accessToken = await getAccessToken(lsConfig.clientId, lsConfig.clientSecret, lsConfig.refreshToken);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setPhase("done");
        return;
      }

      const reverseVendorMap = new Map([...vendorMap.entries()].map(([id, name]) => [name.toLowerCase(), id]));
      const reverseManufacturerMap = new Map(
        [...manufacturerMap.entries()].map(([id, name]) => [name.toLowerCase(), id])
      );

      for (let i = 0; i < updates.length; i++) {
        setResults((prev) => prev.map((r, idx) => (idx === i ? { ...r, status: "uploading" } : r)));

        const result = await uploadSingleItem(
          accessToken,
          lsConfig.accountId,
          updates[i],
          reverseVendorMap,
          reverseManufacturerMap
        );

        setResults((prev) =>
          prev.map((r, idx) =>
            idx === i
              ? {
                  ...r,
                  status: result.error ? "error" : "done",
                  fieldsChanged: result.fieldsChanged,
                  tagsAdded: result.tagsAdded,
                  tagsRemoved: result.tagsRemoved,
                  error: result.error,
                }
              : r
          )
        );
      }

      for (let i = 0; i < additions.length; i++) {
        setAdditionResults((prev) => prev.map((r, idx) => (idx === i ? { ...r, status: "uploading" } : r)));

        const result = await uploadSingleAddition(
          accessToken,
          lsConfig.accountId,
          additions[i],
          reverseVendorMap,
          reverseManufacturerMap
        );

        setAdditionResults((prev) =>
          prev.map((r, idx) => (idx === i ? { ...r, status: result.error ? "error" : "done", error: result.error } : r))
        );
      }

      setPhase("done");
    };

    run();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- run once on mount

  const updateDone = results.filter((r) => r.status === "done").length;
  const updateErrors = results.filter((r) => r.status === "error").length;
  const additionDone = additionResults.filter((r) => r.status === "done").length;
  const additionErrors = additionResults.filter((r) => r.status === "error").length;
  const totalDone = updateDone + additionDone;
  const totalErrors = updateErrors + additionErrors;
  const total = results.length + additionResults.length;

  return (
    <div className="page">
      <h1>Upload Results</h1>
      {error ? (
        <p className="error">{error}</p>
      ) : phase === "running" ? (
        <p className="subtitle">
          Uploading… ({totalDone + totalErrors} / {total})
        </p>
      ) : (
        <p className="subtitle">
          {totalErrors === 0
            ? `All ${total} item${total !== 1 ? "s" : ""} uploaded.`
            : `${totalDone} uploaded, ${totalErrors} error${totalErrors !== 1 ? "s" : ""}.`}
        </p>
      )}
      {results.length > 0 && (
        <section className="review-section">
          <h2>
            Updates <span className="section-count">{results.length}</span>
          </h2>
          <table className="preview-table">
            <thead>
              <tr>
                <th>EAN</th>
                <th>Title</th>
                <th>Changes</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <UploadResultRow key={r.ean} result={r} />
              ))}
            </tbody>
          </table>
        </section>
      )}
      {additionResults.length > 0 && (
        <section className="review-section" style={{ marginTop: 32 }}>
          <h2>
            Additions <span className="section-count">{additionResults.length}</span>
          </h2>
          <table className="preview-table">
            <thead>
              <tr>
                <th>EAN</th>
                <th>Title</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {additionResults.map((r) => (
                <AdditionResultRow key={r.ean} result={r} />
              ))}
            </tbody>
          </table>
        </section>
      )}
      {total === 0 && <p className="subtitle">Nothing to upload.</p>}
    </div>
  );
}
