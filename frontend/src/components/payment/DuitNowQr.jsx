import { useEffect, useState } from "react";
import QRCode from "qrcode";

// Draws a DuitNow QR from the payload the server built (amount and booking
// reference are inside it). Nothing here edits the payload.
export default function DuitNowQr({ payload, alt = "DuitNow QR code", size = 220 }) {
  const [drawn, setDrawn] = useState({ payload: "", url: "" });

  useEffect(() => {
    if (!payload) return undefined;
    let current = true;
    QRCode.toDataURL(payload, { errorCorrectionLevel: "M", margin: 2, width: size * 2 })
      .then((url) => {
        if (current) setDrawn({ payload, url });
      })
      .catch(() => {
        if (current) setDrawn({ payload, url: "" });
      });
    return () => {
      current = false;
    };
  }, [payload, size]);

  const url = drawn.payload === payload ? drawn.url : "";
  if (!url) return <p className="customer-muted">Preparing the QR code...</p>;
  return <img src={url} alt={alt} width={size} height={size} style={{ imageRendering: "pixelated" }} />;
}
