import { useEffect, useState } from "react";
import jsQR from "jsqr";
import { operatorService } from "../../services/operator_service";
import DuitNowQr from "../payment/DuitNowQr";

const MAX_IMAGE_SIDE = 1400;

// Reads the text out of a QR code image in the browser. The image is not sent anywhere.
function decodeQrImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const found = jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: "attemptBoth" });
      if (found?.data) resolve(found.data);
      else reject(new Error("No QR code could be read from this image. Use a sharp screenshot of your DuitNow QR, or paste its text below."));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This file could not be opened as an image."));
    };
    image.src = url;
  });
}

// The operator's own DuitNow account (SRS 4.2.5, dynamic DuitNow QR). The
// platform builds each customer's fixed-amount QR around it.
export default function DuitNowAccountCard() {
  const [state, setState] = useState(null); // null = not loaded yet
  const [editing, setEditing] = useState(false);
  const [pasted, setPasted] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let current = true;
    operatorService
      .getDuitnowAccount()
      .then((res) => {
        if (current) setState(res.data);
      })
      .catch((err) => {
        if (current) setError(err.response?.data?.message || "Could not load your DuitNow account.");
      });
    return () => {
      current = false;
    };
  }, []);

  const save = async (payload) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await operatorService.saveDuitnowAccount(payload);
      setState(res.data);
      setEditing(false);
      setPasted("");
      setNotice("DuitNow account saved. Scan the test QR code below with your banking app to check it.");
    } catch (err) {
      setError(err.response?.data?.message || "Could not save the DuitNow account.");
    } finally {
      setBusy(false);
    }
  };

  const handleImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setNotice("");
    try {
      await save(await decodeQrImage(file));
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async () => {
    if (!window.confirm("Remove your DuitNow account? Customers will no longer see a QR code.")) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await operatorService.clearDuitnowAccount();
      setState(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Could not remove the DuitNow account.");
    } finally {
      setBusy(false);
    }
  };

  const configured = Boolean(state?.configured);
  const showInput = !configured || editing;

  return (
    <div className="operator-card" style={{ margin: "1rem 0" }}>
      <div style={{ marginBottom: "0.75rem" }}>
        <h3 style={{ marginBottom: "0.25rem" }}>DuitNow QR for customers</h3>
        <p style={{ fontSize: "0.875rem", opacity: 0.7 }}>
          Customers scan a QR code that already has the amount and booking reference in it, so they cannot pay
          the wrong amount. Add the QR code you receive DuitNow payments with, from your banking app.
        </p>
      </div>

      {error && (
        <div className="operator-alert danger" style={{ marginBottom: "0.75rem" }}>
          {error}
        </div>
      )}
      {notice && (
        <div className="operator-alert info" style={{ marginBottom: "0.75rem" }}>
          {notice}
        </div>
      )}

      {state === null && !error && <p style={{ opacity: 0.6 }}>Loading...</p>}

      {configured && (
        <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap", alignItems: "flex-start", marginBottom: "1rem" }}>
          <div style={{ background: "#fff", padding: 8, borderRadius: 12, border: "1px solid rgba(148,163,184,0.4)" }}>
            <DuitNowQr payload={state.samplePayload} alt="Test DuitNow QR code for RM 1.00" size={180} />
          </div>
          <div style={{ fontSize: "0.875rem", lineHeight: 1.6, flex: "1 1 240px" }}>
            <p>
              <strong>Account saved.</strong>
              {state.account?.merchantName ? ` ${state.account.merchantName}` : ""}
              {state.account?.merchantCity ? `, ${state.account.merchantCity}` : ""}
            </p>
            <p style={{ opacity: 0.7 }}>
              Bank code {state.account?.acquirerId} · ID {state.account?.qrIdHint}
            </p>
            <p style={{ marginTop: "0.5rem" }}>
              <strong>Test it:</strong> scan this QR code with your own banking app. It should open a payment of
              RM 1.00 to your account with the amount locked. Do not pay it.
            </p>
          </div>
        </div>
      )}

      {showInput && (
        <div style={{ display: "grid", gap: "0.75rem", marginBottom: "0.75rem" }}>
          <div>
            <label className="operator-primary-btn" style={{ cursor: busy ? "wait" : "pointer", opacity: busy ? 0.7 : 1 }}>
              {busy ? "Saving..." : "Upload your DuitNow QR image"}
              <input
                type="file"
                accept="image/*"
                onChange={handleImage}
                disabled={busy}
                style={{ display: "none" }}
              />
            </label>
            <p style={{ fontSize: "0.8rem", opacity: 0.7, marginTop: "0.35rem" }}>
              A screenshot of the DuitNow QR from your banking app or DuitNow account. It is read in your browser,
              and only the account details inside it are kept.
            </p>
          </div>

          <div>
            <label style={{ fontSize: "0.85rem", display: "block", marginBottom: "0.25rem" }}>
              Or paste the text of the QR code
            </label>
            <textarea
              rows={3}
              style={{ width: "100%" }}
              value={pasted}
              onChange={(event) => setPasted(event.target.value)}
              placeholder="00020201021126..."
              disabled={busy}
            />
            <button
              type="button"
              className="operator-secondary-btn"
              style={{ marginTop: "0.5rem" }}
              disabled={busy || !pasted.trim()}
              onClick={() => save(pasted)}
            >
              Save DuitNow account
            </button>
          </div>
        </div>
      )}

      {configured && (
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {!editing && (
            <button type="button" className="operator-secondary-btn" disabled={busy} onClick={() => setEditing(true)}>
              Replace QR code
            </button>
          )}
          {editing && (
            <button type="button" className="operator-secondary-btn" disabled={busy} onClick={() => setEditing(false)}>
              Cancel
            </button>
          )}
          <button type="button" className="operator-danger-btn" disabled={busy} onClick={remove}>
            Remove
          </button>
        </div>
      )}

      {!configured && state !== null && (
        <p style={{ fontSize: "0.8rem", opacity: 0.7, marginTop: "0.5rem" }}>
          Until you add it, customers see your payment instructions only and type the amount themselves.
        </p>
      )}
    </div>
  );
}
