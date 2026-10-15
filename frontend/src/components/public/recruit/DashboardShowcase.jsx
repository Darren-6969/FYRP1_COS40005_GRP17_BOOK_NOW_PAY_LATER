import { useId, useRef, useState } from "react";
import styles from "../../../assets/styles/public/ForOperators.module.css";

// Dashboard showcase (FR-CUST-010). Each tab shows a small preview built from
// sample data. These can be swapped for WebP screenshots of the seeded
// dashboard (frontend/public/recruit/) without changing the tab list.

function Row({ title, sub, children }) {
  return (
    <div className={styles.row}>
      <div className={styles.rowMain}>
        <b>{title}</b>
        <span className={styles.rowSub}>{sub}</span>
      </div>
      {children}
    </div>
  );
}

function Pill({ tone, children }) {
  const toneClass = tone === "warn" ? styles.pillWarn : tone === "info" ? styles.pillInfo : "";
  return <span className={`${styles.pill} ${toneClass}`}>{children}</span>;
}

function QueuePane() {
  return (
    <>
      <h3 className={styles.paneTitle}>Booking requests</h3>
      <p className={styles.paneSub}>Answer each request before its deadline. You choose how long customers wait.</p>
      <Row title="Perodua Bezza 1.3 AV" sub="23 to 25 Oct, Kuching Airport">
        <Pill tone="warn">Needs a charge</Pill>
        <Pill>11h 42m left</Pill>
      </Row>
      <Row title="Toyota Vios 1.5 G" sub="24 to 31 Oct, Kuching Branch">
        <Pill>18h 05m left</Pill>
      </Row>
      <Row title="Proton X50 1.5T" sub="26 to 27 Oct, Waterfront point">
        <Pill tone="info">Offer sent</Pill>
      </Row>
      <Row title="Perodua Myvi 1.5 AV" sub="20 to 22 Oct, Kuching Branch">
        <Pill>Accepted</Pill>
      </Row>
    </>
  );
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const CAL_DAYS = [
  [19, ""], [20, ""], [21, "b"], [22, "b"], [23, "b"], [24, "x"], [25, "x"],
  [26, ""], [27, ""], [28, ""], [29, "b"], [30, "b"], [31, ""], [1, ""],
];

function CalendarPane() {
  return (
    <>
      <h3 className={styles.paneTitle}>Availability calendar</h3>
      <p className={styles.paneSub}>
        Toyota Vios 1.5 G, 3 cars on the platform. Block dates you need for your own customers.
      </p>
      <div className={styles.cal}>
        {WEEKDAYS.map((d) => (
          <span key={d} className={styles.calHead}>
            {d}
          </span>
        ))}
        {CAL_DAYS.map(([day, kind]) => (
          <span
            key={`${day}-${kind}`}
            className={`${styles.calDay} ${kind === "b" ? styles.calBooked : ""} ${kind === "x" ? styles.calBlocked : ""}`}
          >
            {day}
          </span>
        ))}
      </div>
      <div className={styles.legend}>
        <span>
          <i className={styles.swatch} style={{ background: "var(--pub-surface)" }} />
          Available
        </span>
        <span>
          <i className={styles.swatch} style={{ background: "var(--pub-brand)" }} />
          Booked
        </span>
        <span>
          <i className={styles.swatch} style={{ background: "var(--pub-stripe-b)" }} />
          Blocked by you
        </span>
      </div>
    </>
  );
}

function PaymentsPane() {
  return (
    <>
      <h3 className={styles.paneTitle}>Payments</h3>
      <p className={styles.paneSub}>Card payments are matched automatically. DuitNow receipts wait for you to check.</p>
      <Row title="Deposit, BK-1048" sub="Stripe card, RM 57.20">
        <Pill>Paid</Pill>
      </Row>
      <Row title="Balance, BK-1031" sub="DuitNow receipt uploaded, RM 410.00">
        <span className={styles.miniBtn} aria-hidden="true" style={{ display: "inline-flex", alignItems: "center" }}>
          Verify receipt
        </span>
      </Row>
      <Row title="Balance, BK-1019" sub="Due 24 Oct, RM 228.80">
        <Pill tone="info">Waiting</Pill>
      </Row>
    </>
  );
}

function PointsPane() {
  return (
    <>
      <h3 className={styles.paneTitle}>Branches and handover points</h3>
      <p className={styles.paneSub}>
        Each point has its own charge. Customers can still ask for somewhere else, and you quote it.
      </p>
      <Row title="Kuching Branch" sub="Mon to Sat, 8:00 AM to 6:00 PM">
        <Pill>Branch</Pill>
      </Row>
      <Row title="Kuching Airport counter" sub="Pick-up and drop-off">
        <Pill>RM 0.00</Pill>
      </Row>
      <Row title="Waterfront point" sub="Pick-up and drop-off">
        <Pill>RM 15.00</Pill>
      </Row>
      <Row title="Night handover, 9 PM to 9 AM" sub="One overtime charge per booking">
        <Pill tone="warn">RM 30.00</Pill>
      </Row>
    </>
  );
}

const BAR_HEIGHTS = [38, 52, 46, 64, 58, 72];

function SalesPane() {
  return (
    <>
      <h3 className={styles.paneTitle}>Sales and price suggestions</h3>
      <p className={styles.paneSub}>Monthly bookings, with a forecast that suggests next month&apos;s daily rate.</p>
      <div className={styles.bars} aria-hidden="true">
        {BAR_HEIGHTS.map((h, i) => (
          <i key={i} className={styles.barCol} style={{ height: `${h}%`, animationDelay: `${i * 0.05}s` }} />
        ))}
        <i className={`${styles.barCol} ${styles.barForecast}`} style={{ height: "84%", animationDelay: "0.3s" }} />
      </div>
      <div style={{ marginTop: 12 }}>
        <Row title="Suggested daily rate for next month" sub="Toyota Vios 1.5 G, now RM 120.00">
          <Pill tone="warn">RM 135.00</Pill>
        </Row>
      </div>
    </>
  );
}

function EmbedPane() {
  return (
    <>
      <h3 className={styles.paneTitle}>Partner site bookings</h3>
      <p className={styles.paneSub}>
        Add the booking widget to a partner&apos;s website. Their requests land in the same queue.
      </p>
      <div className={styles.code}>
        {"<script src=\""}
        <span className={styles.codeHole}>[embed script]</span>
        {"\"\n        data-key=\""}
        <span className={styles.codeHole}>[your API key]</span>
        {"\"></script>"}
      </div>
      <div style={{ marginTop: 12 }}>
        <Row title="Toyota Vios 1.5 G" sub="From a partner site, 28 to 30 Oct">
          <Pill>13h 10m left</Pill>
        </Row>
      </div>
    </>
  );
}

const TABS = [
  { id: "queue", title: "Request queue", line: "Response deadlines at a glance", path: "bookings", Pane: QueuePane },
  { id: "calendar", title: "Availability calendar", line: "Open or block dates per car", path: "availability", Pane: CalendarPane },
  { id: "payments", title: "Payments", line: "Card payments and DuitNow receipts", path: "payments", Pane: PaymentsPane },
  { id: "points", title: "Branches and points", line: "Handover places with their charges", path: "branches", Pane: PointsPane },
  { id: "sales", title: "Sales and pricing", line: "Reports and suggested rates", path: "analytics", Pane: SalesPane },
  { id: "embed", title: "Partner sites", line: "Take bookings from host websites", path: "integrations", Pane: EmbedPane },
];

export default function DashboardShowcase() {
  const [active, setActive] = useState(0);
  const tabRefs = useRef([]);
  const baseId = useId();
  const tab = TABS[active];
  const { Pane } = tab;

  // Arrow keys move between tabs (WAI-ARIA tabs pattern).
  const onKeyDown = (e) => {
    const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
    let next = null;
    if (e.key in keys) next = (active + keys[e.key] + TABS.length) % TABS.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = TABS.length - 1;
    if (next === null) return;
    e.preventDefault();
    setActive(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className={styles.show}>
      <div className={styles.tabs} role="tablist" aria-label="Dashboard features" aria-orientation="vertical" onKeyDown={onKeyDown}>
        {TABS.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            id={`${baseId}-tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={i === active}
            aria-controls={`${baseId}-panel`}
            tabIndex={i === active ? 0 : -1}
            className={`${styles.tab} ${i === active ? styles.tabOn : ""}`}
            onClick={() => setActive(i)}
          >
            <span className={styles.tabNum}>{String(i + 1).padStart(2, "0")}</span>
            <span>
              <span className={styles.tabTitle}>{t.title}</span>
              <span className={styles.tabLine}>{t.line}</span>
            </span>
          </button>
        ))}
      </div>

      <div
        id={`${baseId}-panel`}
        className={styles.screen}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${tab.id}`}
        tabIndex={0}
      >
        <div className={styles.chrome} aria-hidden="true">
          <i className={styles.chromeDot} />
          <i className={styles.chromeDot} />
          <i className={styles.chromeDot} />
          <span className={styles.chromeUrl}>operator / {tab.path}</span>
          <span className={styles.chromeTag}>Sample data</span>
        </div>
        {/* key remounts the pane so the swap animation replays on each change */}
        <div key={tab.id} className={styles.pane}>
          <Pane />
        </div>
      </div>
    </div>
  );
}
