import { useState } from "react";
import DuitNowQr from "./DuitNowQr";

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };
  return (
    <button type="button" className="customer-secondary-btn small" onClick={copy}>
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// The operator's own DuitNow QR with no amount, shown under the fixed-amount QR.
// Some banking apps (for example Maybank and Touch 'n Go) cannot read the
// fixed-amount QR, so the customer scans this one and types the amount.
export default function StaticQrFallback({ payload, amount, amountText, reference }) {
  if (!payload) return null;
  return (
    <div
      className="customer-qr-section"
      style={{ marginTop: 20, paddingTop: 20, borderTop: "1px dashed rgba(148, 163, 184, 0.5)" }}
    >
      <div className="customer-qr-box">
        <DuitNowQr payload={payload} alt="DuitNow QR code without an amount" />
      </div>
      <div className="customer-qr-instructions">
        <strong>Banking app cannot read the QR above?</strong>
        <p>
          Scan this DuitNow QR instead. It has no amount, so type the amount below
          yourself and put the reference in your payment remarks. Then upload your receipt.
        </p>
        <div className="customer-info-list compact">
          <div>
            <span>Amount to type</span>
            <strong>{amountText}</strong>
            {amount != null && <CopyButton value={Number(amount).toFixed(2)} />}
          </div>
          <div>
            <span>Reference</span>
            <strong>{reference}</strong>
            <CopyButton value={reference} />
          </div>
        </div>
      </div>
    </div>
  );
}
