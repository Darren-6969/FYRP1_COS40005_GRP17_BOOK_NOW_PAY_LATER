import { useEffect, useState } from "react";
import { Car, CreditCard, Send, ShieldCheck, XCircle } from "lucide-react";
import styles from "../../../assets/styles/public/ForOperators.module.css";

// Hero demo of a booking request as it appears in the operator dashboard.
// Everything here is sample content; the buttons only change this card.
const START_SECONDS = 11 * 3600 + 42 * 60 + 8;

function pad(n) {
  return String(n).padStart(2, "0");
}

function formatCountdown(total) {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function Outcome({ tone, icon, children, onUndo }) {
  const toneClass = tone === "offer" ? styles.outcomeOffer : tone === "declined" ? styles.outcomeDeclined : "";
  return (
    <div className={`${styles.outcome} ${toneClass}`} role="status">
      {icon}
      <span>{children}</span>
      <button type="button" className={styles.undo} onClick={onUndo}>
        Undo
      </button>
    </div>
  );
}

export default function RequestDemo() {
  const [seconds, setSeconds] = useState(START_SECONDS);
  const [state, setState] = useState("pending");

  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);

  const reset = () => setState("pending");

  return (
    <div className={`${styles.stage} ${styles.rise} ${styles.d4}`}>
      <div className={styles.ghostCard} aria-hidden="true" />

      <article className={styles.req} aria-label="Example booking request in the operator dashboard">
        <div className={styles.reqTop}>
          <span className={styles.label}>New booking request</span>
          <span className={`${styles.timer} ${seconds < 3600 ? styles.timerUrgent : ""}`}>
            <span className={styles.tick} aria-hidden="true" />
            <span>
              Respond in <span aria-hidden="true">{formatCountdown(seconds)}</span>
              <span className={styles.srOnly}>before the response deadline</span>
            </span>
          </span>
        </div>

        <div className={styles.car}>
          <div className={styles.carPh} aria-hidden="true">
            <Car size={28} strokeWidth={1.6} />
          </div>
          <div>
            <h3 className={styles.carName}>Perodua Bezza 1.3 AV</h3>
            <p className={styles.carMeta}>Automatic, 5 seats, Kuching Branch</p>
          </div>
        </div>

        <div className={styles.legs}>
          <div className={styles.leg}>
            <span className={styles.legKey}>Pick-up</span>
            <div>
              <b>Fri 23 Oct, 9:00 AM</b>
              <br />
              <span className={styles.legPlace}>Kuching Airport counter</span>
            </div>
          </div>
          <div className={styles.leg}>
            <span className={styles.legKey}>Return</span>
            <div>
              <b>Sun 25 Oct, 6:00 PM</b>
              <br />
              <span className={styles.legPlace}>Requested: Riverside hotel lobby</span>
              <span className={styles.chip}>Needs a charge</span>
            </div>
          </div>
        </div>

        <div className={styles.money}>
          <div className={styles.moneyItem}>
            <span className={styles.moneyKey}>Rental total</span>
            <b className={styles.moneyVal}>RM 286.00</b>
          </div>
          <div className={styles.moneyItem}>
            <span className={styles.moneyKey}>Deposit (20%)</span>
            <b className={styles.moneyVal}>RM 57.20</b>
          </div>
          <div className={styles.moneyItem}>
            <span className={styles.moneyKey}>Balance</span>
            <b className={styles.moneyVal}>RM 228.80</b>
          </div>
        </div>

        {state === "pending" && (
          <div className={styles.reqActions}>
            <button type="button" className={styles.reqBtn} onClick={() => setState("declined")}>
              Reject
            </button>
            <button type="button" className={styles.reqBtn} onClick={() => setState("offer")}>
              Make an offer
            </button>
            <button type="button" className={`${styles.reqBtn} ${styles.reqBtnGo}`} onClick={() => setState("accepted")}>
              Accept
            </button>
          </div>
        )}
        {state === "accepted" && (
          <Outcome
            onUndo={reset}
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" strokeWidth="1.6" />
                <path className={styles.checkDraw} d="M7.5 12.5l3 3 6-6.5" />
              </svg>
            }
          >
            Accepted. The customer is asked to pay the deposit.
          </Outcome>
        )}
        {state === "offer" && (
          <Outcome tone="offer" onUndo={reset} icon={<Send size={20} aria-hidden="true" />}>
            Offer sent: RM 25.00 for the hotel drop-off.
          </Outcome>
        )}
        {state === "declined" && (
          <Outcome tone="declined" onUndo={reset} icon={<XCircle size={20} aria-hidden="true" />}>
            Request declined. The car is free again.
          </Outcome>
        )}
      </article>

      <div className={`${styles.float} ${styles.floatOne}`} aria-hidden="true">
        <span className={styles.floatIcon}>
          <ShieldCheck size={16} />
        </span>
        <div>
          Verified operator
          <span className={styles.floatSub}>Shown on your seller page</span>
        </div>
      </div>
      <div className={`${styles.float} ${styles.floatTwo}`} aria-hidden="true">
        <span className={`${styles.floatIcon} ${styles.floatIconWarm}`}>
          <CreditCard size={16} />
        </span>
        <div>
          Deposit paid, RM 57.20
          <span className={styles.floatSub}>Stripe card</span>
        </div>
      </div>
    </div>
  );
}
