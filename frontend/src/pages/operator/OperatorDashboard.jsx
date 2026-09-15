import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  Car,
  Eye,
  RotateCcw,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  ComposedChart,
} from "recharts";
import {
  operatorService,
  formatOperatorMoney,
  formatOperatorDateTime,
  operatorStatusClass,
  operatorStatusLabel,
} from "../../services/operator_service";

const POLL_INTERVAL_MS = 8000;
const MALAYSIA_TIME_ZONE = "Asia/Kuala_Lumpur";
const ACTIVE_ALLOCATION_STATUSES = new Set([
  "ACCEPTED",
  "PENDING_PAYMENT",
  "PAID",
  "COMPLETED",
]);
const EXCLUDED_OPERATION_STATUSES = new Set([
  "REJECTED",
  "CANCELLED",
  "OVERDUE",
]);

function malaysiaDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MALAYSIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const getPart = (type) => parts.find((part) => part.type === type)?.value || "";
  return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
}

function addDaysToDateKey(dateKey, days) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const base = new Date(Date.UTC(year, month - 1, day));
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function startOfMalaysiaMonthKey(dateKey) {
  return `${dateKey.slice(0, 7)}-01`;
}

function ProgressBar({ value, max }) {
  const safeMax = Math.max(Number(max) || 0, 0);
  const safeValue = Math.max(Number(value) || 0, 0);
  const percent = safeMax > 0 ? Math.min((safeValue / safeMax) * 100, 100) : 0;

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={Math.min(safeValue, safeMax)}
      style={{
        width: "100%",
        height: "10px",
        borderRadius: "999px",
        background: "#e5e7eb",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${percent}%`,
          height: "100%",
          borderRadius: "999px",
          background: "#2563eb",
          transition: "width 200ms ease",
        }}
      />
    </div>
  );
}

export default function OperatorDashboard() {
  const [summary, setSummary] = useState({});
  const [bookings, setBookings] = useState([]);
  const [recentBookings, setRecentBookings] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [forecastData, setForecastData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const MetricTitle = ({ title, description }) => (
    <div style={styles.metricTitleRow}>
      <span style={styles.metricTitleText}>{title}</span>
      <span className="operator-metric-info-wrap" style={styles.metricInfoWrap}>
        <Eye size={14} />
        <span className="operator-metric-tooltip" style={styles.metricTooltip}>
          {description}
        </span>
      </span>
    </div>
  );

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError("");

      const [dashboardRes, bookingsRes, reportsRes] = await Promise.all([
        operatorService.getDashboard(),
        operatorService.getBookings(),
        operatorService.getReports().catch(() => ({ data: null })),
      ]);

      setSummary(dashboardRes.data.summary || {});
      setBookings(bookingsRes.data.bookings || []);
      setRecentBookings(dashboardRes.data.recentBookings || []);
      setNotifications(dashboardRes.data.notifications || []);
      setForecastData(reportsRes.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load operator dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const refreshDashboardSilently = async () => {
    try {
      const [dashboardRes, bookingsRes] = await Promise.all([
        operatorService.getDashboard(),
        operatorService.getBookings(),
      ]);

      setSummary(dashboardRes.data.summary || {});
      setBookings(bookingsRes.data.bookings || []);
      setRecentBookings(dashboardRes.data.recentBookings || []);
      setNotifications(dashboardRes.data.notifications || []);
    } catch {
      // Ignore transient poll failures; the next tick retries.
    }
  };

  const refreshRef = useRef(refreshDashboardSilently);
  useEffect(() => {
    refreshRef.current = refreshDashboardSilently;
  });

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      refreshRef.current();
    };

    const intervalId = window.setInterval(tick, POLL_INTERVAL_MS);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  const operationalMetrics = useMemo(() => {
    const todayKey = malaysiaDateKey();
    const next7EndKey = addDaysToDateKey(todayKey, 6);
    const monthStartKey = startOfMalaysiaMonthKey(todayKey);

    const validBookings = bookings.filter(
      (booking) => !EXCLUDED_OPERATION_STATUSES.has(String(booking.status || "").toUpperCase())
    );

    const todaysPickups = validBookings.filter(
      (booking) => malaysiaDateKey(booking.pickupDate) === todayKey
    );

    const todaysReturns = validBookings.filter(
      (booking) => malaysiaDateKey(booking.returnDate) === todayKey
    );

    const next7Bookings = validBookings.filter((booking) => {
      const pickupKey = malaysiaDateKey(booking.pickupDate);
      return pickupKey && pickupKey >= todayKey && pickupKey <= next7EndKey;
    });

    const allocatedNext7 = next7Bookings.filter((booking) => {
      const status = String(booking.status || "").toUpperCase();
      const paymentStatus = String(booking.payment?.status || "").toUpperCase();
      return ACTIVE_ALLOCATION_STATUSES.has(status) || paymentStatus === "PAID";
    });

    const remainingNext7 = next7Bookings.filter(
      (booking) => !allocatedNext7.some((allocated) => allocated.id === booking.id)
    );

    const awaitingReturnConfirmation = validBookings.filter((booking) => {
      const returnKey = malaysiaDateKey(booking.returnDate);
      const status = String(booking.status || "").toUpperCase();
      return returnKey && returnKey <= todayKey && status !== "COMPLETED";
    });

    const monthToDateVolume = bookings.filter((booking) => {
      const bookingKey = malaysiaDateKey(booking.createdAt || booking.bookingDate);
      return bookingKey && bookingKey >= monthStartKey && bookingKey <= todayKey;
    }).length;

    return {
      todayKey,
      next7EndKey,
      todaysPickups,
      todaysReturns,
      next7Bookings,
      allocatedNext7,
      remainingNext7,
      awaitingReturnConfirmation,
      exhaustedAllocations:
        next7Bookings.length > 0 && remainingNext7.length === 0 ? 1 : 0,
      monthToDateVolume,
    };
  }, [bookings]);

  const trendChartData = useMemo(() => {
    const historical = (forecastData?.revenueTrend || []).slice(-30).map((item) => ({
      date: item.date?.slice(5) || item.date,
      actual: Math.round(item.revenue || 0),
    }));

    const forecast = (forecastData?.demandForecast || []).slice(0, 14).map((item) => ({
      date: item.date?.slice(5) || item.date,
      predicted: Math.round(item.predictedRevenue || 0),
    }));

    const combined = [...historical];
    forecast.forEach((forecastItem) => {
      const existing = combined.find((item) => item.date === forecastItem.date);
      if (existing) existing.predicted = forecastItem.predicted;
      else combined.push({ ...forecastItem, actual: null });
    });

    return combined;
  }, [forecastData]);

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>Loading operator dashboard...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.pageTitle}>Operator Dashboard</h1>
          <p style={styles.pageSubtitle}>
            Daily rental operations, allocation readiness and revenue performance.
          </p>
        </div>
      </div>

      {error && (
        <div style={styles.errorBox}>
          {error}
          <button type="button" onClick={loadDashboard} style={styles.retryButton}>
            Retry
          </button>
        </div>
      )}

      <div style={styles.metricGrid}>
        <div style={styles.metricCard}>
          <div style={styles.metricIcon}><CalendarDays size={19} /></div>
          <MetricTitle
            title="Today's Pickups"
            description="Bookings with a pickup date scheduled for today in Malaysia time."
          />
          <div style={styles.metricValue}>{operationalMetrics.todaysPickups.length}</div>
          <div style={styles.metricSub}>Scheduled for collection today</div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricIcon}><RotateCcw size={19} /></div>
          <MetricTitle
            title="Today's Returns"
            description="Bookings with a vehicle return date scheduled for today in Malaysia time."
          />
          <div style={styles.metricValue}>{operationalMetrics.todaysReturns.length}</div>
          <div style={styles.metricSub}>Vehicles due back today</div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricIcon}><Car size={19} /></div>
          <MetricTitle
            title="Month-to-Date Volume"
            description="Number of bookings recorded from the first day of this month through today."
          />
          <div style={styles.metricValue}>{operationalMetrics.monthToDateVolume}</div>
          <div style={styles.metricSub}>Bookings this month</div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricIcon}><Banknote size={19} /></div>
          <MetricTitle
            title="Revenue"
            description="Confirmed revenue calculated from paid or completed bookings."
          />
          <div style={styles.metricValueMoney}>
            {formatOperatorMoney(summary?.totalRevenue || 0)}
          </div>
          <div style={styles.metricSub}>Confirmed paid revenue</div>
        </div>
      </div>

      <div style={styles.twoColumnGrid}>
        <div style={styles.card}>
          <div style={styles.cardHead}>
            <div>
              <h2 style={styles.cardTitle}>7-Day Allocation Status</h2>
              <p style={styles.cardSub}>
                {operationalMetrics.todayKey} to {operationalMetrics.next7EndKey}
              </p>
            </div>
          </div>

          <div style={styles.allocationNumbers}>
            <div>
              <div style={styles.allocationValue}>{operationalMetrics.allocatedNext7.length}</div>
              <div style={styles.allocationLabel}>Allocated</div>
            </div>
            <div style={styles.allocationDivider} />
            <div>
              <div style={styles.allocationValue}>{operationalMetrics.remainingNext7.length}</div>
              <div style={styles.allocationLabel}>Remaining</div>
            </div>
            <div style={styles.allocationDivider} />
            <div>
              <div style={styles.allocationValue}>{operationalMetrics.next7Bookings.length}</div>
              <div style={styles.allocationLabel}>Scheduled</div>
            </div>
          </div>

          <div style={styles.progressTextRow}>
            <span>
              {operationalMetrics.allocatedNext7.length} allocated of {operationalMetrics.next7Bookings.length} scheduled bookings
            </span>
            <strong>
              {operationalMetrics.next7Bookings.length > 0
                ? `${Math.round((operationalMetrics.allocatedNext7.length / operationalMetrics.next7Bookings.length) * 100)}%`
                : "0%"}
            </strong>
          </div>
          <ProgressBar
            value={operationalMetrics.allocatedNext7.length}
            max={operationalMetrics.next7Bookings.length}
          />
          <p style={styles.helperText}>
            Allocation is based on bookings already accepted, awaiting payment, paid or completed. The current database does not store a fleet-capacity limit, so this bar compares allocated bookings with scheduled bookings rather than inventing a vehicle target.
          </p>
        </div>

        <div style={styles.card}>
          <div style={styles.cardHead}>
            <div>
              <h2 style={styles.cardTitle}>Outstanding Actions</h2>
              <p style={styles.cardSub}>Items needing operator attention</p>
            </div>
          </div>

          <div style={styles.actionList}>
            <div style={styles.actionItem}>
              <div style={styles.actionIcon}><RotateCcw size={18} /></div>
              <div style={styles.actionContent}>
                <div style={styles.actionTitle}>Vehicles awaiting return confirmation</div>
                <div style={styles.actionText}>
                  Returns due by today that are not yet marked completed.
                </div>
              </div>
              <div style={styles.actionCount}>
                {operationalMetrics.awaitingReturnConfirmation.length}
              </div>
            </div>

            <div style={styles.actionItem}>
              <div style={styles.actionIcon}><AlertTriangle size={18} /></div>
              <div style={styles.actionContent}>
                <div style={styles.actionTitle}>Exhausted allocations</div>
                <div style={styles.actionText}>
                  Next-seven-day schedule has no bookings left awaiting allocation.
                </div>
              </div>
              <div style={styles.actionCount}>
                {operationalMetrics.exhaustedAllocations}
              </div>
            </div>
          </div>
        </div>
      </div>

      {trendChartData.length > 0 && (
        <div style={styles.card}>
          <div style={styles.cardHead}>
            <div>
              <h2 style={styles.cardTitle}>Revenue Trend</h2>
              <p style={styles.cardSub}>Actual revenue with available SARIMA forecast</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={270}>
            <ComposedChart data={trendChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#6b7280" }} interval={4} />
              <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} />
              <Tooltip formatter={(value) => formatOperatorMoney(value)} />
              <Legend />
              <Line
                type="monotone"
                dataKey="actual"
                stroke="#2563eb"
                strokeWidth={2.5}
                dot={{ r: 3 }}
                name="Actual Revenue"
              />
              <Line
                type="monotone"
                dataKey="predicted"
                stroke="#f59e0b"
                strokeWidth={2.5}
                strokeDasharray="8 4"
                dot={{ r: 3 }}
                name="Forecast Revenue"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={styles.twoColumnGrid}>
        <div style={styles.card}>
          <div style={styles.cardHead}>
            <div>
              <h2 style={styles.cardTitle}>Recent Booking Activity</h2>
              <p style={styles.cardSub}>Latest booking updates</p>
            </div>
            <Link to="/operator/booking-log" style={styles.linkButton}>View all →</Link>
          </div>

          <div style={styles.activityList}>
            {recentBookings.map((booking) => (
              <Link
                key={booking.id}
                to={`/operator/bookings/${booking.id}`}
                style={styles.activityItem}
              >
                <div style={styles.activityLeft}>
                  <div style={styles.activityId}>{booking.bookingCode || `#${booking.id}`}</div>
                  <div style={styles.activityCustomer}>{booking.customer?.name || "-"}</div>
                  <div style={styles.activityTime}>{formatOperatorDateTime(booking.createdAt)}</div>
                </div>
                <span className={`operator-status ${operatorStatusClass(booking.status)}`}>
                  {operatorStatusLabel(booking.status)}
                </span>
              </Link>
            ))}

            {!recentBookings.length && (
              <div style={styles.emptyState}>No recent bookings found.</div>
            )}
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardHead}>
            <div>
              <h2 style={styles.cardTitle}>Recent Notifications</h2>
              <p style={styles.cardSub}>Booking and payment updates</p>
            </div>
            <Link to="/operator/notifications" style={styles.linkButton}>View all →</Link>
          </div>

          <div style={styles.notificationList}>
            {notifications.map((item) => (
              <div key={item.id} style={styles.notificationItem}>
                <div style={styles.notificationDot} />
                <div style={styles.notificationContent}>
                  <div style={styles.notificationTitle}>{item.title}</div>
                  <div style={styles.notificationMessage}>{item.message}</div>
                </div>
                <div style={styles.notificationTime}>{formatOperatorDateTime(item.createdAt)}</div>
              </div>
            ))}

            {!notifications.length && (
              <div style={styles.emptyState}>No notifications yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: "24px",
    maxWidth: "1400px",
    margin: "0 auto",
    boxSizing: "border-box",
  },
  pageHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    marginBottom: "24px",
  },
  pageTitle: {
    fontSize: "26px",
    fontWeight: 700,
    margin: 0,
    color: "#111827",
  },
  pageSubtitle: {
    margin: "6px 0 0",
    fontSize: "13px",
    color: "#6b7280",
  },
  metricGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
    marginBottom: "24px",
  },
  metricCard: {
    position: "relative",
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "14px",
    padding: "18px",
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
    overflow: "visible",
  },
  metricIcon: {
    width: "36px",
    height: "36px",
    borderRadius: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#eff6ff",
    color: "#2563eb",
    marginBottom: "12px",
  },
  metricTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: "7px",
    marginBottom: "8px",
    position: "relative",
  },
  metricTitleText: {
    fontSize: "13px",
    color: "#6b7280",
    fontWeight: 600,
  },
  metricInfoWrap: {
    position: "relative",
    width: "20px",
    height: "20px",
    borderRadius: "50%",
    background: "rgba(37, 99, 235, 0.1)",
    color: "#64748b",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flexShrink: 0,
  },
  metricTooltip: {
    position: "absolute",
    top: "26px",
    left: "50%",
    transform: "translateX(-50%)",
    minWidth: "220px",
    maxWidth: "270px",
    padding: "10px 12px",
    borderRadius: "10px",
    background: "rgba(15, 23, 42, 0.96)",
    color: "#ffffff",
    fontSize: "12px",
    lineHeight: 1.45,
    fontWeight: 500,
    zIndex: 9999,
    opacity: 0,
    visibility: "hidden",
    pointerEvents: "none",
  },
  metricValue: {
    fontSize: "30px",
    lineHeight: 1.1,
    fontWeight: 750,
    color: "#111827",
  },
  metricValueMoney: {
    fontSize: "24px",
    lineHeight: 1.2,
    fontWeight: 750,
    color: "#111827",
    wordBreak: "break-word",
  },
  metricSub: {
    fontSize: "11px",
    color: "#9ca3af",
    marginTop: "6px",
  },
  twoColumnGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: "20px",
    marginBottom: "24px",
  },
  card: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "14px",
    padding: "20px",
    minWidth: 0,
    boxSizing: "border-box",
    marginBottom: "24px",
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.03)",
  },
  cardHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
    marginBottom: "18px",
  },
  cardTitle: {
    fontSize: "16px",
    fontWeight: 700,
    color: "#111827",
    margin: 0,
  },
  cardSub: {
    fontSize: "12px",
    color: "#6b7280",
    margin: "4px 0 0",
  },
  allocationNumbers: {
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr auto 1fr",
    alignItems: "center",
    gap: "16px",
    marginBottom: "18px",
  },
  allocationValue: {
    fontSize: "26px",
    fontWeight: 750,
    color: "#111827",
  },
  allocationLabel: {
    marginTop: "3px",
    fontSize: "11px",
    color: "#6b7280",
  },
  allocationDivider: {
    width: "1px",
    height: "36px",
    background: "#e5e7eb",
  },
  progressTextRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    fontSize: "12px",
    color: "#4b5563",
    marginBottom: "8px",
  },
  helperText: {
    fontSize: "11px",
    lineHeight: 1.5,
    color: "#6b7280",
    margin: "10px 0 0",
  },
  actionList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  actionItem: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "14px",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    background: "#f9fafb",
  },
  actionIcon: {
    width: "36px",
    height: "36px",
    borderRadius: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#fff7ed",
    color: "#c2410c",
    flexShrink: 0,
  },
  actionContent: { flex: 1, minWidth: 0 },
  actionTitle: {
    fontSize: "13px",
    fontWeight: 650,
    color: "#111827",
  },
  actionText: {
    marginTop: "3px",
    fontSize: "11px",
    lineHeight: 1.4,
    color: "#6b7280",
  },
  actionCount: {
    minWidth: "36px",
    height: "36px",
    borderRadius: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    fontSize: "16px",
    fontWeight: 750,
    color: "#111827",
  },
  activityList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  activityItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    padding: "12px",
    background: "#f9fafb",
    borderRadius: "10px",
    textDecoration: "none",
  },
  activityLeft: { flex: 1, minWidth: 0 },
  activityId: {
    fontWeight: 650,
    color: "#111827",
    fontSize: "13px",
  },
  activityCustomer: {
    fontSize: "12px",
    color: "#6b7280",
    marginTop: "2px",
  },
  activityTime: {
    fontSize: "10px",
    color: "#9ca3af",
    marginTop: "2px",
  },
  notificationList: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  notificationItem: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "11px 0",
    borderBottom: "1px solid #f1f5f9",
  },
  notificationDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "#2563eb",
    flexShrink: 0,
  },
  notificationContent: { flex: 1, minWidth: 0 },
  notificationTitle: {
    fontWeight: 600,
    fontSize: "12px",
    color: "#111827",
  },
  notificationMessage: {
    fontSize: "11px",
    color: "#6b7280",
    marginTop: "2px",
  },
  notificationTime: {
    fontSize: "10px",
    color: "#9ca3af",
    textAlign: "right",
    flexShrink: 0,
  },
  linkButton: {
    color: "#2563eb",
    textDecoration: "none",
    fontSize: "12px",
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  emptyState: {
    textAlign: "center",
    padding: "28px",
    color: "#9ca3af",
    fontSize: "12px",
  },
  errorBox: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: "12px",
    padding: "14px",
    marginBottom: "20px",
    color: "#b91c1c",
    fontSize: "13px",
  },
  retryButton: {
    marginLeft: "12px",
    border: "1px solid #fca5a5",
    background: "#ffffff",
    color: "#b91c1c",
    borderRadius: "7px",
    padding: "5px 10px",
    cursor: "pointer",
  },
};
