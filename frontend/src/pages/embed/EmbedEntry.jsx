import { useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { setMemorySession, updateMemoryTokens } from "../../utils/memorySession";
import {
  exchangeHostSession,
  requestHostOtp,
  verifyHostOtp,
} from "../../services/host_service";
import { postToHost, startAutoResize } from "../../utils/embedBridge";

const wrap = { fontFamily: "Arial, sans-serif", padding: "24px", maxWidth: 440, margin: "0 auto", textAlign: "center" };
const btn = { display: "inline-block", padding: "12px 18px", borderRadius: 8, border: 0, background: "#2563eb", color: "#fff", fontSize: 15, cursor: "pointer", width: "100%", marginTop: 12 };
const btnGhost = { ...btn, background: "transparent", color: "#2563eb", border: "1px solid #2563eb" };
const input = { width: "100%", padding: "12px", fontSize: 20, letterSpacing: 6, textAlign: "center", borderRadius: 8, border: "1px solid #ccc", boxSizing: "border-box" };

export default function EmbedEntry() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const ht = params.get("ht");

  const [phase, setPhase] = useState("loading"); // loading | otp | done | error
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState("");
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  useEffect(() => startAutoResize(), []);
  useEffect(() => { postToHost("bnpl:ready"); }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    if (!ht) {
      setPhase("error");
      setError("Missing session token.");
      return;
    }

    (async () => {
      try {
        const { data } = await exchangeHostSession(ht);

        setMemorySession({
          token: data.authToken,
          refreshToken: data.refreshToken,
          user: data.user,
        });

        setBooking({ bookingId: data.bookingId, bookingCode: data.bookingCode });

        if (data.needsOtp) {
          setPhase("otp");
          try { await requestHostOtp(); } catch { /* user can resend */ }
        } else {
          succeed(data.bookingId, data.bookingCode);
        }
      } catch (err) {
        const msg = err.response?.data?.message || "Could not start your BNPL session.";
        setPhase("error");
        setError(msg);
        postToHost("bnpl:error", { message: msg });
      }
    })();
  }, [ht]);

  function succeed(bookingId, bookingCode) {
    setPhase("done");
    postToHost("bnpl:success", { bookingId, bookingCode });
  }

  async function submitOtp(e) {
    e.preventDefault();
    setOtpError("");
    setBusy(true);
    try {
        const { data } = await verifyHostOtp(otp.trim());
        updateMemoryTokens({ token: data.token, refreshToken: data.refreshToken });
        succeed(booking.bookingId, booking.bookingCode);
    } catch (err) {
      setOtpError(err.response?.data?.message || "Invalid code.");
    } finally {
      setBusy(false);
    }
  }

  if (phase === "loading") {
    return <div style={wrap}><h3>Setting up your booking…</h3><p>Please wait.</p></div>;
  }

  if (phase === "error") {
    return (
      <div style={wrap}>
        <h3>Something went wrong</h3>
        <p style={{ color: "#b91c1c" }}>{error}</p>
        <button style={btnGhost} onClick={() => postToHost("bnpl:cancel")}>Close</button>
      </div>
    );
  }

  if (phase === "otp") {
    return (
      <div style={wrap}>
        <h3>Verify your identity</h3>
        <p>We sent a 6-digit code to your email. Enter it to confirm your Book Now Pay Later booking.</p>
        <form onSubmit={submitOtp}>
          <input style={input} value={otp} onChange={(e) => setOtp(e.target.value)}
                 inputMode="numeric" maxLength={6} placeholder="______" />
          {otpError && <p style={{ color: "#b91c1c" }}>{otpError}</p>}
          <button style={btn} type="submit" disabled={busy || otp.trim().length < 6}>
            {busy ? "Verifying…" : "Verify"}
          </button>
        </form>
        <button style={{ ...btnGhost, marginTop: 8 }} onClick={() => requestHostOtp().catch(() => {})}>
          Resend code
        </button>
      </div>
    );
  }

  // done
  return (
    <div style={wrap}>
      <h3>Booking submitted 🎉</h3>
      <p>Your BNPL booking <strong>{booking?.bookingCode}</strong> has been created.</p>
      <button style={btn} onClick={() => navigate(`/customer/bookings/${booking.bookingId}`)}>
        View booking details
      </button>
      <button style={btnGhost} onClick={() => postToHost("bnpl:cancel")}>Close</button>
    </div>
  );
}