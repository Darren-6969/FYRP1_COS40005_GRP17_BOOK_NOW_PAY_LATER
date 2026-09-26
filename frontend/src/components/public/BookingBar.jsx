import { Clock, Info } from "lucide-react";
import styles from "../../assets/styles/public/BookingBar.module.css";

// Sticky bar at the bottom of the car detail page. The page composes the
// wording; the bar only lays it out. `reason` explains why the button is off.
export default function BookingBar({
  label,
  figure,
  rate,
  sub,
  surchargeLine,
  lowStockText,
  reason,
  afterHoursText,
  note,
  buttonLabel = "Request to book",
  onRequest,
}) {
  const blocked = Boolean(reason);
  return (
    <aside className={styles.bar} aria-label="Booking summary">
      <div className={styles.inner}>
        {reason && (
          <p role="status" id="booking-bar-reason" className={styles.reason}>
            <Info size={16} aria-hidden="true" className={styles.icon} />
            <span>{reason}</span>
          </p>
        )}
        <div className={styles.row}>
          <div className={styles.figures}>
            <div className={styles.payBlock}>
              <div className={styles.labelRow}>
                <span className={styles.label}>{label}</span>
                {lowStockText && <span className={styles.lowStock}>{lowStockText}</span>}
              </div>
              <div className={styles.figureRow}>
                <span className={styles.figure}>{figure}</span>
                <span className={styles.rate}>{rate}</span>
              </div>
            </div>
            <div className={styles.sub}>
              <span className={styles.subMain}>{sub}</span>
              {surchargeLine && <span className={styles.subExtra}>{surchargeLine}</span>}
            </div>
          </div>
          <div className={styles.action}>
            {afterHoursText && (
              <p role="status" className={styles.afterHours}>
                <Clock size={16} aria-hidden="true" className={styles.icon} />
                <span>{afterHoursText}</span>
              </p>
            )}
            <button
              type="button"
              className={styles.button}
              onClick={onRequest}
              disabled={blocked}
              aria-describedby={blocked ? "booking-bar-reason" : undefined}
            >
              {buttonLabel}
            </button>
            <span className={styles.note}>{note}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
