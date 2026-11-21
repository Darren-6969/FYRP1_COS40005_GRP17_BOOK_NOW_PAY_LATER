import { Link } from "react-router-dom";
import { AlertTriangle, ChevronRight } from "lucide-react";

import "../../assets/styles/operator-booking-attention.css";

// Everything on this booking that is waiting for the operator, at the top of
// the booking page so it is seen before scrolling. Each item says what is
// waiting and takes the operator to where they can act on it.
//
// item: { key, tone: "warning" | "danger", title, detail?, actionLabel,
//         to? (route) | targetId? (element id on this page) }
export default function BookingAttentionBanner({ items }) {
  if (!items?.length) return null;

  const urgent = items.some((item) => item.tone === "danger");

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
      className={`booking-attention ${urgent ? "danger" : "warning"}`}
      role="status"
      aria-label="Needs your attention"
    >
      <div className="booking-attention-head">
        <AlertTriangle size={20} aria-hidden="true" />
        <strong>
          {items.length === 1
            ? "1 thing needs your attention"
            : `${items.length} things need your attention`}
        </strong>
      </div>

      <ul className="booking-attention-list">
        {items.map((item) => (
          <li key={item.key} className={`booking-attention-item ${item.tone}`}>
            <div>
              <p className="booking-attention-title">{item.title}</p>
              {item.detail && (
                <p className="booking-attention-detail">{item.detail}</p>
              )}
            </div>

            {item.to ? (
              <Link className="booking-attention-action" to={item.to}>
                {item.actionLabel}
                <ChevronRight size={16} aria-hidden="true" />
              </Link>
            ) : (
              <button
                type="button"
                className="booking-attention-action"
                onClick={() => goTo(item.targetId)}
              >
                {item.actionLabel}
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
