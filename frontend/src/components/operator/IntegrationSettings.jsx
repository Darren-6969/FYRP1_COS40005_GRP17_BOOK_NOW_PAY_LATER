import { useEffect, useState } from "react";
import { KeyRound, RefreshCw, Trash2, Copy, Save } from "lucide-react";
import {
  getIntegration,
  rotateApiKey,
  revokeApiKey,
  updateOrigins,
} from "../../services/integration_service";

export default function IntegrationSettings() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newKey, setNewKey] = useState("");
  const [origins, setOrigins] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function load() {
    setLoading(true);
    try {
      const { data } = await getIntegration();
      setData(data);
      setOrigins((data.allowedOrigins || []).join("\n"));
    } catch (e) {
      setErr(e.response?.data?.message || "Failed to load integration settings.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function onRotate() {
    if (!window.confirm("Rotate the API key? The current key stops working immediately and you must update your host config.")) return;
    setErr(""); setMsg("");
    try {
      const { data } = await rotateApiKey();
      setNewKey(data.apiKey);
      setMsg(data.message);
      load();
    } catch (e) { setErr(e.response?.data?.message || "Rotate failed."); }
  }

  async function onRevoke() {
    if (!window.confirm("Revoke the API key? Host bookings will fail until you rotate a new one.")) return;
    setErr(""); setMsg(""); setNewKey("");
    try {
      const { data } = await revokeApiKey();
      setMsg(data.message);
      load();
    } catch (e) { setErr(e.response?.data?.message || "Revoke failed."); }
  }

  async function onSaveOrigins() {
    setErr(""); setMsg("");
    const list = origins.split("\n").map((s) => s.trim()).filter(Boolean);
    try {
      const { data } = await updateOrigins(list);
      setMsg("Allowed origins saved.");
      setOrigins((data.allowedOrigins || []).join("\n"));
    } catch (e) { setErr(e.response?.data?.message || "Save failed."); }
  }

  function copy(text) { navigator.clipboard?.writeText(text); }

  return (
    <section id="integration-settings" className="operator-card operator-settings-section">
      <div className="operator-settings-section-head">
        <div className="operator-settings-section-icon"><KeyRound size={20} /></div>
        <div>
          <h2>Integration / API Keys</h2>
          <p>Manage your host API key, embed origins, and integration snippet.</p>
        </div>
      </div>

      {loading ? (
        <p style={{ opacity: 0.6 }}>Loading integration settings…</p>
      ) : (
        <>
          {err && <div className="operator-alert danger">{err}</div>}
          {msg && <div className="operator-alert success">{msg}</div>}

          <p>Operator code: <strong>{data?.operatorCode}</strong></p>

          <h3 style={{ marginTop: "1rem" }}>Host API key</h3>
          {data?.hasApiKey ? (
            <p>
              Active key: <code>{data.apiKeyPrefix}</code>
              {data.apiKeyRotatedAt && <> · issued {new Date(data.apiKeyRotatedAt).toLocaleString()}</>}
            </p>
          ) : (
            <p className="operator-alert warning">No active key. Generate one below.</p>
          )}

          {newKey && (
            <div className="operator-alert warning" style={{ display: "block" }}>
              <strong>Copy now — shown only once:</strong>
              <div className="operator-api-key-row" style={{ marginTop: "0.5rem" }}>
                <code>{newKey}</code>
                <button type="button" className="operator-secondary-btn" onClick={() => copy(newKey)}>
                  <Copy size={15} /> Copy
                </button>
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
            <button type="button" className="operator-primary-btn" onClick={onRotate}>
              <RefreshCw size={16} /> {data?.hasApiKey ? "Rotate key" : "Generate key"}
            </button>
            {data?.hasApiKey && (
              <button type="button" className="operator-secondary-btn" onClick={onRevoke}
                      style={{ color: "#b91c1c", borderColor: "#b91c1c" }}>
                <Trash2 size={16} /> Revoke
              </button>
            )}
          </div>

          <h3 style={{ marginTop: "1.5rem" }}>Allowed embed origins</h3>
          <label className="operator-settings-field">
            <span>One origin per line (scheme + host only, e.g. https://example.com)</span>
            <textarea rows={4} value={origins} onChange={(e) => setOrigins(e.target.value)}
                      style={{ fontFamily: "monospace" }} />
            <small>Sites allowed to embed the BNPL modal.</small>
          </label>
          <button type="button" className="operator-primary-btn" onClick={onSaveOrigins} style={{ marginTop: "0.5rem" }}>
            <Save size={16} /> Save origins
          </button>

          <h3 style={{ marginTop: "1.5rem" }}>Embed snippet</h3>
          <pre style={{ background: "#f3f4f6", padding: "0.75rem", borderRadius: "0.5rem",
                        overflowX: "auto", fontSize: "0.8rem", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
            {data?.embedSnippet}
          </pre>
          <button type="button" className="operator-secondary-btn" onClick={() => copy(data?.embedSnippet || "")}>
            <Copy size={15} /> Copy snippet
          </button>
        </>
      )}
    </section>
  );
}

