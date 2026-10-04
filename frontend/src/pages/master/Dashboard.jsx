import { useEffect, useState } from "react";
import { 
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Line, CartesianGrid, Legend,
  ComposedChart
} from "recharts";
import { getBookings } from "../../services/booking_service";
import { getPayments } from "../../services/payment_service";
import { operatorService } from "../../services/operator_service";
import { Eye } from "lucide-react";
import { getDashboardStats } from "../../services/admin_service";

function MetricTitle({ title, description }) {
  return (
    <div className="master-metric-title-row">
      <span className="master-metric-title-text">{title}</span>
      <span className="master-metric-info-wrap">
        <Eye size={14} />
        <span className="master-metric-tooltip">{description}</span>
      </span>
    </div>
  );
}

export default function Dashboard() {
  // ========== ALL HOOKS - TOP LEVEL ==========
  const [bookings, setBookings] = useState([]);
  const [payments, setPayments] = useState([]);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [forecastData, setForecastData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const getGridColumns = () => {
  if (typeof window !== "undefined" && window.innerWidth <= 640) {
    return "1fr";
  }

  if (typeof window !== "undefined" && window.innerWidth <= 1000) {
    return "repeat(2, 1fr)";
  }

  return "repeat(4, 1fr)";
  };
  
  const [gridColumns, setGridColumns] = useState(getGridColumns());
  const [isMobile, setIsMobile] = useState(
  typeof window !== "undefined" && window.innerWidth <= 860
  );

  // Main data loading effect
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        
        let bookingsRes = { data: [] };
        let paymentsRes = { data: [] };
        let reportsRes = { data: null };
        let statsRes = { data: null };

        try {
          statsRes = await getDashboardStats();
        } catch (e) {
          console.warn("Dashboard stats API failed:", e);
        }
        
        try {
          bookingsRes = await getBookings();
        } catch (e) {
          console.warn("Bookings API failed:", e);
        }
        
        try {
          paymentsRes = await getPayments();
        } catch (e) {
          console.warn("Payments API failed:", e);
        }
        
        try {
          reportsRes = await operatorService.getReports();
        } catch (e) {
          console.warn("Reports API failed:", e);
        }
        
        setBookings(Array.isArray(bookingsRes?.data) ? bookingsRes.data : []);
        setPayments(Array.isArray(paymentsRes?.data) ? paymentsRes.data : []);
        setForecastData(reportsRes?.data || null);
        setDashboardStats(statsRes?.data || null);
        
      } catch (err) {
        console.error("Dashboard error:", err);
        setError(err.message || "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
  }, []);

  // Resize listener effect
  useEffect(() => {
  const handleResize = () => {
    setGridColumns(getGridColumns());
    setIsMobile(window.innerWidth <= 860);
  };

  window.addEventListener("resize", handleResize);
  handleResize();

  return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ========== CALCULATIONS ==========
  const totalBookings = dashboardStats?.totalBookings ?? bookings?.length ?? 0;
  const pendingBookings = bookings?.filter(b => b?.status === "PENDING").length || 0;
  const paidBookings = bookings?.filter(b => b?.status === "PAID").length || 0;
  const cancelledBookings = bookings?.filter(b => 
    b?.status === "REJECTED" || b?.status === "CANCELLED"
  ).length || 0;
  const overduePayments = dashboardStats?.overduePayments ?? payments?.filter(p => p?.status === "OVERDUE").length ?? 0;
  const calculatedRevenue = payments?.filter(p => p?.status === "PAID")
    .reduce((sum, p) => sum + Number(p?.amount || 0), 0) || 0;
  const totalRevenue = dashboardStats?.revenue ?? calculatedRevenue;

  const weeklyTrend = (dashboardStats?.sevenDayTrend || []).map((item) => ({
    ...item,
    label: new Date(`${item.date}T00:00:00`).toLocaleDateString("en-MY", {
      day: "numeric",
      month: "short",
    }),
  }));
  const paymentFailureRate = Number(dashboardStats?.paymentFailureRate || 0);
  const callbackBacklog = dashboardStats?.callbackBacklog ?? 0;
  const scheduledTaskFailures = dashboardStats?.scheduledTaskFailures ?? 0;
  const healthAlerts = [
    {
      title: "Payment failure rate",
      value: `${paymentFailureRate}%`,
      detail: `${dashboardStats?.failedPayments || 0} failed of ${dashboardStats?.paymentCount || 0} payments in 7 days`,
      level: paymentFailureRate >= 10 ? "critical" : paymentFailureRate >= 5 ? "warning" : "healthy",
    },
    {
      title: "Callback backlog",
      value: callbackBacklog.toLocaleString(),
      detail: "Unprocessed payment callbacks",
      level: callbackBacklog >= 20 ? "critical" : callbackBacklog > 0 ? "warning" : "healthy",
    },
    {
      title: "Scheduled task failures",
      value: scheduledTaskFailures.toLocaleString(),
      detail: "Failed or partial runs in 7 days",
      level: scheduledTaskFailures > 0 ? "critical" : "healthy",
    },
  ];

  // ========== 30-DAY BOOKINGS OVERVIEW (HISTORICAL) ==========
  const getLast30DaysData = () => {
    const last30Days = [];
    const today = new Date();
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayBookings = (bookings || []).filter(b => {
        const bookingDate = new Date(b?.createdAt).toISOString().split('T')[0];
        return bookingDate === dateStr;
      });
      
      last30Days.push({
        date: dateStr,
        submitted: dayBookings.length,
        accepted: dayBookings.filter(b => b?.status === "ACCEPTED").length,
        completed: dayBookings.filter(b => b?.status === "PAID").length,
        expired: dayBookings.filter(b => b?.status === "REJECTED" || b?.status === "EXPIRED").length,
      });
    }
    
    return last30Days;
  };

  const historicalData = getLast30DaysData();

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return `${date.getDate()} ${date.toLocaleString('default', { month: 'short' })}`;
  };

  // ========== MERGE HISTORICAL + FORECAST DATA ==========
  const chartData = (() => {
    const historical = historicalData.map(item => ({
      date: formatDate(item.date),
      submitted: item.submitted,
      accepted: item.accepted,
      completed: item.completed,
      expired: item.expired,
      isForecast: false
    }));
    
    const forecast = (forecastData?.demandForecast || []).slice(0, 14).map(item => ({
      date: item.date?.slice(5) || item.date,
      predicted: Math.round(item.predictedBookings || 0),
      lowerBound: Math.round(item.lowerBound || 0),
      upperBound: Math.round(item.upperBound || 0),
      isForecast: true
    }));
    
    return [...historical, ...forecast];
  })();

  // ========== RECENT BOOKINGS ==========
  const recentBookings = (bookings && Array.isArray(bookings)) 
    ? [...bookings]
        .filter(b => b)
        .sort((a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0))
        .slice(0, 10)
        .map(booking => ({
          id: booking?.bookingCode || booking?.id || 'N/A',
          customerName: booking?.customer?.name || booking?.customerName || 'Unknown',
          serviceName: booking?.serviceName || booking?.productName || 'Service',
          bookingStatus: booking?.status || 'UNKNOWN',
          paymentStatus: booking?.payment?.status || 'PENDING',
          dueDate: booking?.paymentDeadline ? new Date(booking.paymentDeadline).toLocaleDateString() : 'N/A'
        }))
    : [];

  // ========== RECENT PAYMENTS ==========
  const recentPayments = (payments && Array.isArray(payments))
    ? [...payments]
        .filter(p => p)
        .sort((a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0))
        .slice(0, 8)
        .map(payment => ({
          id: payment?.id,
          bookingId: payment?.bookingId,
          amount: payment?.amount || 0,
          status: payment?.status || 'UNKNOWN',
          method: payment?.method || 'Unknown',
          customerName: payment?.booking?.customer?.name || 'Unknown'
        }))
    : [];

  // ========== STATUS CHART DATA ==========
  const statusChartData = [
    { name: "Pending", value: pendingBookings, color: "#f59e0b" },
    { name: "Paid", value: paidBookings, color: "#10b981" },
    { name: "Cancelled", value: cancelledBookings, color: "#ef4444" },
    { name: "Others", value: Math.max(0, totalBookings - pendingBookings - paidBookings - cancelledBookings), color: "#6b7280" }
  ].filter(item => item.value > 0);

  // ========== HELPER FUNCTIONS ==========
  const getStatusBadgeStyle = (status) => {
    const styles = {
      'PENDING': { background: '#fef3c7', color: '#d97706' },
      'PAID': { background: '#d1fae5', color: '#059669' },
      'COMPLETED': { background: '#d1fae5', color: '#059669' },
      'ACCEPTED': { background: '#dbeafe', color: '#2563eb' },
      'REJECTED': { background: '#fee2e2', color: '#dc2626' },
      'CANCELLED': { background: '#fee2e2', color: '#dc2626' },
      'OVERDUE': { background: '#fee2e2', color: '#dc2626' }
    };
    return styles[status] || { background: '#f3f4f6', color: '#374151' };
  };

  const getPaymentStatusLabel = (status) => {
    const labels = {
      'PAID': 'Paid',
      'UNPAID': 'Unpaid',
      'PENDING': 'Pending',
      'PENDING_VERIFICATION': 'Under Review',
      'OVERDUE': 'Overdue',
      'FAILED': 'Failed'
    };
    return labels[status] || status || 'Pending';
  };

  const getForecastInsight = () => {
    if (!forecastData?.demandForecast?.length) return null;
    const firstWeek = forecastData.demandForecast.slice(0, 7).reduce((sum, d) => sum + (d.predictedBookings || 0), 0);
    const secondWeek = forecastData.demandForecast.slice(7, 14).reduce((sum, d) => sum + (d.predictedBookings || 0), 0);
    const trend = secondWeek > firstWeek ? 'increasing' : 'decreasing';
    const peakDay = forecastData.demandForecast.reduce((max, d) => 
      (d.predictedBookings > max.predictedBookings) ? d : max, forecastData.demandForecast[0]);
    return { trend, peakDay: peakDay?.date?.slice(5), peakValue: peakDay?.predictedBookings };
  };

  const forecastInsight = getForecastInsight();

  // ========== STYLES ==========
  const styles = {
    container: { padding: isMobile ? "16px 10px" : "24px",
                 maxWidth: "1400px",
                 margin: "0 auto",
                 width: "100%",
                 overflowX: "hidden",
                 boxSizing: "border-box", },
    pageTitle: { fontSize: '24px', fontWeight: '600', marginBottom: '24px', color: '#1f2937' },
    metricsGrid: {
      display: 'grid',
      gridTemplateColumns: gridColumns,
      gap: '16px',
      marginBottom: '32px'
    },

    metricCard: {
    background: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '18px 20px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
    position: 'relative',
    overflow: 'visible',
    minHeight: '132px',
    display: 'flex',
    flexDirection: 'column',
  },

    metricTitle: { fontSize: '13px', color: '#6b7280', marginBottom: '8px' },
    metricValue: { fontSize: '30px', fontWeight: '700', color: '#1f2937', lineHeight: 1.1, marginTop: '12px'},
    metricSub: { fontSize: '11px', color: '#9ca3af', marginTop: '4px' },
    chartSection: {
      background: 'white',
      border: '1px solid #e5e7eb',
      borderRadius: '16px',
      padding: '20px',
      marginBottom: '32px'
    },
    sectionHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '20px',
      flexWrap: 'wrap',
      gap: '12px'
    },
    sectionTitle: { margin: 0, fontSize: '16px', fontWeight: '600', color: '#1f2937' },
    legend: { display: 'flex', gap: '20px', flexWrap: 'wrap' },
    legendItem: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#6b7280' },
    legendDot: { width: '10px', height: '10px', borderRadius: '50%', display: 'inline-block' },
    twoColumnGrid: {
      display: "grid",
      gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
      gap: isMobile ? "18px" : "24px",
      marginBottom: "32px",
      width: "100%",
      minWidth: 0,
    },
    card: {
      background: "white",
      border: "1px solid #e5e7eb",
      borderRadius: isMobile ? "18px" : "12px",
      padding: isMobile ? "18px" : "20px",
      boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
      width: "100%",
      minWidth: 0,
      boxSizing: "border-box",
      overflow: "hidden",
    },
    cardTitle: { fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#1f2937' },
    table: {
      width: "100%",
      borderCollapse: "collapse",
      fontSize: isMobile ? "13px" : "13px",
      tableLayout: isMobile ? "fixed" : "auto",
    },
    th: {
      textAlign: "left",
      padding: isMobile ? "10px 8px" : "12px 8px",
      background: "#f9fafb",
      borderBottom: "1px solid #e5e7eb",
      fontWeight: "600",
      color: "#6b7280",
      whiteSpace: "normal",
      wordBreak: "break-word",
    },
    td: {
      padding: isMobile ? "12px 8px" : "12px 8px",
      borderBottom: "1px solid #f1f5f9",
      verticalAlign: "middle",
      whiteSpace: "normal",
      wordBreak: "break-word",
    },
    badge: { display: 'inline-block', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' },
    paymentActivityItem: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: isMobile ? "flex-start" : "center",
      gap: "12px",
      padding: "14px 0",
      borderBottom: "1px solid #f1f5f9",
      flexWrap: "wrap",
    },
    noData: { textAlign: 'center', padding: '40px', color: '#9ca3af' },
    errorBox: { background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '12px', padding: '16px', marginBottom: '20px', color: '#dc2626' },
    forecastNote: { marginTop: '16px', textAlign: 'center', fontSize: '12px', color: '#6b7280', borderTop: '1px solid #e5e7eb', paddingTop: '16px' }
  };

  // ========== CONDITIONAL RETURNS ==========
  if (loading) {
    return (
      <div style={styles.container}>
        <div style={{ ...styles.card, textAlign: 'center' }}>
          Loading dashboard...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.errorBox}>
          <strong>Error loading dashboard:</strong> {error}
          <button onClick={() => window.location.reload()} style={{ marginLeft: '12px', padding: '4px 12px', cursor: 'pointer' }}>Retry</button>
        </div>
      </div>
    );
  }

  // ========== MAIN RENDER ==========
  return (
    <div style={styles.container}>
      <h1 style={styles.pageTitle}>Dashboard</h1>

      {/* Platform-wide metrics */}
      <div style={styles.metricsGrid}>
      <div style={styles.metricCard}>
        <MetricTitle
          title="Total Bookings"
          description="Total number of bookings recorded in the BNPL system, including pending, paid, cancelled, and overdue bookings."
        />
        <div style={styles.metricValue}>{totalBookings}</div>
      </div>

      <div style={styles.metricCard}>
        <MetricTitle
          title="Pending Bookings"
          description="Bookings that are still waiting for review, approval, or payment action."
        />
        <div style={styles.metricValue}>{pendingBookings}</div>
      </div>

      <div style={styles.metricCard}>
        <MetricTitle
          title="Paid Bookings"
          description="Bookings that have been successfully paid through the BNPL payment process."
        />
        <div style={styles.metricValue}>{paidBookings}</div>
      </div>

      <div style={styles.metricCard}>
        <MetricTitle
          title="Cancelled/Voided"
          description="Bookings that were cancelled, rejected, voided, or no longer valid."
        />
        <div style={styles.metricValue}>{cancelledBookings}</div>
      </div>

      <div style={styles.metricCard}>
        <MetricTitle
          title="Overdue Payments"
          description="Bookings where the customer did not complete payment before the payment deadline."
        />
        <div style={styles.metricValue}>{overduePayments}</div>
      </div>

      <div style={styles.metricCard}>
        <MetricTitle
          title="Total Revenue"
          description="Total paid booking amount collected through the BNPL platform."
        />
        <div style={styles.metricValue}>RM {totalRevenue.toLocaleString()}</div>
      </div>

      <div style={styles.metricCard}>
        <MetricTitle
          title="Active Operators"
          description="Operators currently active on the platform."
        />
        <div style={styles.metricValue}>{(dashboardStats?.activeOperators ?? 0).toLocaleString()}</div>
      </div>

      <div style={styles.metricCard}>
        <MetricTitle
          title="Registered Users"
          description="All user accounts registered on the platform."
        />
        <div style={styles.metricValue}>{(dashboardStats?.registeredUsers ?? 0).toLocaleString()}</div>
      </div>
    </div>

      <section style={styles.chartSection} aria-labelledby="platform-health-title">
        <div style={styles.sectionHeader}>
          <h2 id="platform-health-title" style={styles.sectionTitle}>Platform health</h2>
          <span style={{ fontSize: "12px", color: "#6b7280" }}>Last 7 days</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))", gap: "12px" }}>
          {healthAlerts.map((alert) => {
            const palette = {
              healthy: { background: "#f0fdf4", border: "#bbf7d0", color: "#166534", label: "Healthy" },
              warning: { background: "#fffbeb", border: "#fde68a", color: "#92400e", label: "Attention" },
              critical: { background: "#fef2f2", border: "#fecaca", color: "#991b1b", label: "Critical" },
            }[alert.level];
            return (
              <div key={alert.title} style={{ padding: "14px 16px", border: `1px solid ${palette.border}`, borderLeft: `4px solid ${palette.color}`, borderRadius: "6px", background: palette.background }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" }}>
                  <strong style={{ color: "#1f2937", fontSize: "13px" }}>{alert.title}</strong>
                  <span style={{ color: palette.color, fontSize: "11px", fontWeight: 700, textTransform: "uppercase" }}>{palette.label}</span>
                </div>
                <div style={{ color: "#111827", fontSize: "24px", fontWeight: 700, marginTop: "8px" }}>{alert.value}</div>
                <div style={{ color: "#6b7280", fontSize: "12px", marginTop: "3px" }}>{alert.detail}</div>
              </div>
            );
          })}
        </div>
      </section>

      <section style={styles.chartSection} aria-labelledby="seven-day-trend-title">
        <div style={styles.sectionHeader}>
          <h2 id="seven-day-trend-title" style={styles.sectionTitle}>Seven-day bookings and revenue</h2>
        </div>
        {weeklyTrend.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={weeklyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6b7280" }} />
              <YAxis yAxisId="bookings" tick={{ fontSize: 11, fill: "#6b7280" }} allowDecimals={false} />
              <YAxis yAxisId="revenue" orientation="right" tick={{ fontSize: 11, fill: "#6b7280" }} tickFormatter={(value) => `RM ${Number(value).toLocaleString()}`} />
              <Tooltip formatter={(value, name) => name === "Revenue" ? [`RM ${Number(value).toLocaleString()}`, name] : [value, name]} />
              <Legend />
              <Line yAxisId="bookings" type="monotone" dataKey="bookings" name="Bookings" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line yAxisId="revenue" type="monotone" dataKey="revenue" name="Revenue" stroke="#059669" strokeWidth={2.5} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div style={styles.noData}>Seven-day trend data is unavailable.</div>
        )}
      </section>

      {/* ROW 2: Booking Overview & Forecast Line Chart (MOST IMPORTANT) */}
      <div style={styles.chartSection}>
        <div style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>📈 Booking Overview & Forecast</h3>
          <div style={styles.legend}>
            <span style={styles.legendItem}>
              <span style={{ ...styles.legendDot, backgroundColor: '#3b82f6' }}></span>
              Bookings
            </span>
            <span style={styles.legendItem}>
              <span style={{ ...styles.legendDot, backgroundColor: '#10b981' }}></span>
              Accepted
            </span>
            <span style={styles.legendItem}>
              <span style={{ ...styles.legendDot, backgroundColor: '#f59e0b' }}></span>
              SARIMA Forecast
            </span>
            <span style={styles.legendItem}>
              <span style={{ ...styles.legendDot, backgroundColor: '#ef4444' }}></span>
              Expired
            </span>
          </div>
        </div>
        
        <ResponsiveContainer width="100%" height={380}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "#6b7280" }}
              axisLine={{ stroke: "#e5e7eb" }}
              tickLine={false}
              angle={-45}
              textAnchor="end"
              height={75}
              interval={5}
            />
            <YAxis 
              tick={{ fontSize: 11, fill: '#6b7280' }}
              axisLine={{ stroke: '#e5e7eb' }}
              tickLine={false}
            />
            <Tooltip />
            <Legend />
            
            {/* Historical Data Lines */}
            <Line 
              type="monotone" 
              dataKey="submitted" 
              stroke="#3b82f6" 
              strokeWidth={2.5} 
              dot={{ r: 3, fill: "#3b82f6" }}
              name="Bookings"
            />
            <Line 
              type="monotone" 
              dataKey="accepted" 
              stroke="#10b981" 
              strokeWidth={2} 
              dot={{ r: 2, fill: "#10b981" }}
              name="Accepted"
            />
            <Line 
              type="monotone" 
              dataKey="expired" 
              stroke="#ef4444" 
              strokeWidth={2} 
              dot={{ r: 2, fill: "#ef4444" }}
              name="Expired"
            />
            
            {/* SARIMA Forecast Line */}
            <Line 
              type="monotone" 
              dataKey="predicted" 
              stroke="#f59e0b" 
              strokeWidth={3} 
              strokeDasharray="8 4" 
              dot={{ r: 4, fill: "#f59e0b", strokeWidth: 2 }}
              name="SARIMA Forecast"
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
        
        {/* Forecast Insight */}
        {forecastInsight && forecastData?.demandForecast?.length > 0 && (
          <div style={styles.forecastNote}>
            🤖 <strong>SARIMA Insight:</strong> Demand is forecasted to be <strong>{forecastInsight.trend}</strong> over the next 14 days.
            Peak expected on <strong>{forecastInsight.peakDay}</strong> with approximately <strong>{Math.round(forecastInsight.peakValue)}</strong> bookings.
            {forecastData?.forecastSummary?.modelType && ` (Model: ${forecastData.forecastSummary.modelType})`}
          </div>
        )}
        
        {!forecastData?.demandForecast?.length && (
          <div style={styles.forecastNote}>
            📊 Not enough historical data for SARIMA forecast. Bookings will appear here as data accumulates.
          </div>
        )}
      </div>

      {/* ROW 3: Two Column Layout */}
      <div style={styles.twoColumnGrid}>
        
        {/* Recent Booking Requests Table */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>📋 Recent Booking Requests</h3>
          {recentBookings.length > 0 ? (
            <div
                style={{
                  overflowX: "auto",
                  width: "100%",
                  maxWidth: "100%",
                  WebkitOverflowScrolling: "touch",
                }}
              >
                <table style={{ ...styles.table, minWidth: "720px" }}>
                <thead>
                  <tr>
                    <th style={styles.th}>Booking ID</th>
                    <th style={styles.th}>Customer</th>
                    <th style={styles.th}>Service</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Payment</th>
                    <th style={styles.th}>Due Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentBookings.map((booking, idx) => {
                    const statusStyle = getStatusBadgeStyle(booking.bookingStatus);
                    const paymentStyle = getStatusBadgeStyle(booking.paymentStatus);
                    return (
                      <tr key={idx}>
                        <td style={styles.td}>{booking.id}</td>
                        <td style={styles.td}>{booking.customerName}</td>
                        <td style={styles.td}>{booking.serviceName}</td>
                        <td style={styles.td}>
                          <span style={{ ...styles.badge, ...statusStyle }}>{booking.bookingStatus}</span>
                        </td>
                        <td style={styles.td}>
                          <span style={{ ...styles.badge, ...paymentStyle }}>{getPaymentStatusLabel(booking.paymentStatus)}</span>
                        </td>
                        <td style={styles.td}>{booking.dueDate}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={styles.noData}>No booking requests found</div>
          )}
        </div>

        {/* Right Column */}
        <div>
          {/* Recent Payment Activity */}
          <div style={{ ...styles.card, marginBottom: '24px' }}>
            <h3 style={styles.cardTitle}>💳 Recent Payment Activity</h3>
            {recentPayments.length > 0 ? (
              recentPayments.map((payment, idx) => {
                const statusStyle = getStatusBadgeStyle(payment.status);
                return (
                  <div key={idx} style={styles.paymentActivityItem}>
                    <div>
                      <div style={{ fontWeight: 500 }}>Booking #{payment.bookingId}</div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>{payment.method}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 600 }}>RM {payment.amount?.toLocaleString()}</div>
                      <span style={{ ...styles.badge, ...statusStyle }}>{getPaymentStatusLabel(payment.status)}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={styles.noData}>No payment activity found</div>
            )}
          </div>

          {/* Booking Status Chart */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>📊 Booking Status Distribution</h3>
            {statusChartData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      dataKey="value"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {statusChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap', marginTop: '12px' }}>
                  {statusChartData.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: item.color }}></span>
                      <span style={{ fontSize: '12px' }}>{item.name}: {item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={styles.noData}>No status data available</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}