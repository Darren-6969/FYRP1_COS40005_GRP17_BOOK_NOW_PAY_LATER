import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import { X } from "lucide-react";
import styles from "../../assets/styles/public/SaveSigninPrompt.module.css";

const GAP = 8;
const WIDTH = 264;
const EST_HEIGHT = 170;

// Where the prompt sits: under the heart, right edges aligned, or above it
// when there is no room below. Fixed to the viewport so a card's rounded,
// clipped corners can't cut it off.
// The portal stays inside the public root so the design tokens and theme apply.
function placementFor(anchor) {
  const r = anchor.getBoundingClientRect();
  const width = Math.min(WIDTH, window.innerWidth - 24);
  const right = Math.max(12, window.innerWidth - r.right);
  const below = r.bottom + GAP + EST_HEIGHT <= window.innerHeight;
  const host = anchor.closest("[data-public-root]") || document.body;
  const style = below
    ? { top: r.bottom + GAP, right, width }
    : { bottom: window.innerHeight - r.top + GAP, right, width };
  return { host, style };
}

// Shown when a signed-out visitor taps a save heart. Saving is for signed-in
// customers only, so it offers sign in or sign up and returns them to this
// page afterwards. Nothing is saved until they tap the heart again.
export default function SaveSigninPrompt({ open, anchorRef, onClose }) {
  const location = useLocation();
  const boxRef = useRef(null);
  const [place, setPlace] = useState(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;
    setPlace(placementFor(anchorRef.current));
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return undefined;
    boxRef.current?.querySelector("a")?.focus();

    const close = () => onClose({ refocus: false });
    const onKey = (e) => {
      if (e.key === "Escape") onClose({ refocus: true });
    };
    const onPointer = (e) => {
      if (boxRef.current?.contains(e.target) || anchorRef.current?.contains(e.target)) return;
      close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    // The prompt is placed once; scrolling or resizing closes it instead of
    // leaving it behind.
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open, onClose, anchorRef]);

  if (!open || !place) return null;

  const back = encodeURIComponent(location.pathname + location.search);
  const query = `redirect=${back}&reason=save`;

  return createPortal(
    <div
      ref={boxRef}
      role="dialog"
      aria-label="Sign in to save"
      className={styles.prompt}
      style={place.style}
    >
      <button
        type="button"
        className={styles.close}
        aria-label="Close"
        onClick={() => onClose({ refocus: true })}
      >
        <X size={16} aria-hidden="true" />
      </button>
      <p className={styles.title}>Save cars to your account</p>
      <p className={styles.text}>Sign in or create an account to save this car and find it again on any device.</p>
      <div className={styles.actions}>
        <Link to={`/login?${query}`} className={styles.primary}>
          Sign in
        </Link>
        <Link to={`/register?${query}`} className={styles.secondary}>
          Create account
        </Link>
      </div>
    </div>,
    place.host
  );
}
