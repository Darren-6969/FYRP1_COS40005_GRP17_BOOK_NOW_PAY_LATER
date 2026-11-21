import { Link } from "react-router-dom";
import { AlertCircle, ArrowRight } from "lucide-react";

import "../../assets/styles/operator-booking-attention.css";

// Everything on this booking that is waiting for the operator, at the top of
// the booking page so it is seen before scrolling. Each item says what is
// waiting and takes the operator to where they can act on it.
//
// item: { key, tone: "warning" | "danger", title, detail?, actionLabel,
//         to? (route) | targetId? (element id on this page) }
export default function BookingAttentionBanner({ items }) {
  if (!items?.length) return null;

  const goTo = (targetId) => {
    const element = document.getElementById(targetId);
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "start" });
    element.classList.add("booking-attention-flash");
    window.setTimeout(
      () => element.classList.remove("booking-attention-flash"),
      1600
    );
  };

  return (
    <section
      className="booking-attention"
      role="status"
      aria-label={`${items.length} ${items.length === 1 ? "thing needs" : "things need"} your attention`}
    >
      <div className="booking-attention-head">
        <AlertCircle size={18} aria-hidden="true" />
        <strong>Needs your attention</strong>
        <span className="booking-attention-count">{items.length}</span>
      </div>

      <ul className="booking-attention-list">
        {items.map((item) => (
          <li key={item.key} className={`booking-attention-item ${item.tone}`}>
            <span className="booking-attention-dot" aria-hidden="true" />
            <div className="booking-attention-text">
              <p className="booking-attention-title">
                {item.title}
                {/* Urgency is said in words too, not only by the red dot. */}
                {item.tone === "danger" && (
                  <span className="booking-attention-urgent">Urgent</span>
                )}
              </p>
              {item.detail && (
                <p className="booking-attention-detail">{item.detail}</p>
              )}
            </div>

            {item.to ? (
              <Link className="booking-attention-action" to={item.to}>
                {item.actionLabel}
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            ) : (
              <button
                type="button"
                className="booking-attention-action"
                onClick={() => goTo(item.targetId)}
              >
                {item.actionLabel}
                <ArrowRight size={15} aria-hidden="true" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
