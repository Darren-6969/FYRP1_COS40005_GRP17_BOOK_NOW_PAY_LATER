import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Eye } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, ComposedChart, BarChart, Bar
} from "recharts";
import {
  operatorService,
  formatOperatorMoney,
  formatOperatorDateTime,
  operatorStatusClass,
  operatorStatusLabel,
} from "../../services/operator_service";

export default function OperatorDashboard() {
  const [summary, setSummary] = useState(null);
  const [recentBookings, setRecentBookings] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [forecastData, setForecastData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const MetricTitle = ({ title, description }) => (
  <div style={styles.metricTitleRow}>
    <span style={styles.metricTitleText}>{title}</span>

    <span
      className="operator-metric-info-wrap"
      style={styles.metricInfoWrap}
    >
      <Eye size={14} />
      <span
        className="operator-metric-tooltip"
        style={styles.metricTooltip}
      >
        {description}
      </span>
    </span>
  </div>
);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError("");

      const [dashboardRes, reportsRes] = await Promise.all([
        operatorService.getDashboard(),
        operatorService.getReports().catch(() => ({ data: null }))
      ]);

      setSummary(dashboardRes.data.summary || {});
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



  // ========== PREPARE FORECAST CHART DATA ==========
  const prepareForecastData = () => {
    if (!forecastData?.demandForecast?.length) return [];
    
    return forecastData.demandForecast.slice(0, 14).map(item => ({
      date: item.date?.slice(5) || item.date,
      predictedBookings: Math.round(item.predictedBookings || 0),
      predictedRevenue: Math.round(item.predictedRevenue || 0),
    }));
  };

  const prepareTrendData = () => {
    const historical = (forecastData?.revenueTrend || []).slice(-30).map(item => ({
      date: item.date?.slice(5) || item.date,
      actual: Math.round(item.revenue || 0),
      type: 'actual'
    }));
    
    const forecast = (forecastData?.demandForecast || []).slice(0, 14).map(item => ({
      date: item.date?.slice(5) || item.date,
      predicted: Math.round(item.predictedRevenue || 0),
      type: 'forecast'
    }));
    
    const combined = [...historical];
    forecast.forEach((f, idx) => {
      const existingIndex = combined.findIndex(c => c.date === f.date);
      if (existingIndex >= 0) {
        combined[existingIndex].predicted = f.predicted;
      } else {
        combined.push({ ...f, actual: null });
      }
    });
    
    return combined;
  };

  const forecastChartData = prepareForecastData();
  const trendChartData = prepareTrendData();

  // Calculate forecast insights
  const next7DaysBookings = forecastData?.forecastSummary?.next7DaysBookings || 
    forecastChartData.slice(0, 7).reduce((sum, d) => sum + (d.predictedBookings || 0), 0);
  
  const next7DaysRevenue = forecastData?.forecastSummary?.next7DaysRevenue ||
    forecastChartData.slice(0, 7).reduce((sum, d) => sum + (d.predictedRevenue || 0), 0);
  
  const peakDay = forecastChartData.length > 0 ? 
    forecastChartData.reduce((max, d) => (d.predictedBookings > max.predictedBookings) ? d : max, forecastChartData[0]) : null;

  // ========== INLINE STYLES ==========
  const styles = {
    container: { padding: '24px', maxWidth: '1400px', margin: '0 auto' },
    pageTitle: { fontSize: '24px', fontWeight: '600', marginBottom: '24px', color: '#1f2937' },
    
    // Search row
    searchRow: {
      display: 'flex',
      gap: '12px',
      marginBottom: '24px'
    },
    searchInput: {
      flex: 1,
      padding: '10px 16px',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      fontSize: '14px'
    },
    searchButton: {
      padding: '10px 20px',
      background: '#3b82f6',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer'
    },
    
    // Metric grid
    metricGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(5, 1fr)',
      gap: '16px',
      marginBottom: '32px'
    },
    metricCard: {
       background: 'white',
       border: '1px solid #e5e7eb',
       borderRadius: '12px',
       padding: '16px',
       boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
       position: 'relative',
       overflow: 'visible',
    },

    metricTitle: { fontSize: '13px', color: '#6b7280', marginBottom: '8px' },
    metricTitleRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        position: 'relative',
        marginBottom: '8px',
    },

    metricTitleText: {
        fontSize: '13px',
        color: '#6b7280',
        fontWeight: 600,
    },

    metricInfoWrap: {
        position: 'relative',
      width: '20px',
      height: '20px',
      borderRadius: '50%',
      background: 'rgba(37, 99, 235, 0.1)',
      color: '#64748b',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      flexShrink: 0,
    },

    metricTooltip: {
      position: 'absolute',
      top: '26px',
      left: '50%',
      transform: 'translateX(-50%)',
      minWidth: '220px',
      maxWidth: '260px',
      padding: '10px 12px',
      borderRadius: '12px',
      background: 'rgba(15, 23, 42, 0.96)',
      color: '#ffffff',
      fontSize: '12px',
      lineHeight: 1.45,
      fontWeight: 600,
      textAlign: 'left',
      boxShadow: '0 14px 35px rgba(15, 23, 42, 0.22)',
      zIndex: 9999,
      opacity: 0,
      visibility: 'hidden',
      pointerEvents: 'none',
    },

    metricValue: { fontSize: '28px', fontWeight: '700', color: '#1f2937' },
    metricSub: { fontSize: '11px', color: '#9ca3af', marginTop: '4px' },
    
    // Forecast section
    forecastSection: { marginBottom: '32px' },
    forecastHeader: { marginBottom: '20px' },
    forecastTitle: { fontSize: '18px', fontWeight: '600', color: '#1f2937', margin: 0 },
    forecastSub: { fontSize: '13px', color: '#6b7280', marginTop: '4px' },
    
    forecastMetricsRow: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: '16px',
      marginBottom: '24px'
    },
    forecastMetricCard: {
      background: '#f8fafc',
      borderRadius: '12px',
      padding: '16px',
      border: '1px solid #e5e7eb'
    },
    forecastMetricLabel: { fontSize: '12px', color: '#6b7280', marginBottom: '8px' },
    forecastMetricValue: { fontSize: '24px', fontWeight: '700', color: '#1f2937' },
    forecastMetricSub: { fontSize: '11px', color: '#9ca3af', marginTop: '4px' },
    
    chartContainer: {
      background: 'white',
      border: '1px solid #e5e7eb',
      borderRadius: '16px',
      padding: '20px',
      marginBottom: '20px'
    },
    chartTitle: { fontSize: '15px', fontWeight: '600', marginBottom: '16px', color: '#1f2937' },
    
    insightBox: {
      background: '#f0fdf4',
      border: '1px solid #bbf7d0',
      borderRadius: '12px',
      padding: '16px',
      marginTop: '16px'
    },
    insightText: { fontSize: '13px', color: '#166534', margin: 0 },
    
    // Dashboard grid
    dashboardGrid: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '24px',
      marginBottom: '32px'
    },
    card: {
      background: 'white',
      border: '1px solid #e5e7eb',
      borderRadius: '12px',
      padding: '20px'
    },
    cardHead: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '16px'
    },
    cardTitle: { fontSize: '16px', fontWeight: '600', color: '#1f2937', margin: 0 },
    cardSub: { fontSize: '12px', color: '#6b7280', marginTop: '2px' },
    linkButton: { color: '#3b82f6', textDecoration: 'none', fontSize: '13px' },
    
    bigNumber: { fontSize: '36px', fontWeight: '700', color: '#1f2937', marginBottom: '8px' },
    mutedText: { fontSize: '12px', color: '#6b7280', margin: 0 },
    
    activityList: { display: 'flex', flexDirection: 'column', gap: '12px' },
    activityItem: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '12px',
      background: '#f9fafb',
      borderRadius: '10px',
      textDecoration: 'none',
      cursor: 'pointer'
    },
    activityLeft: { flex: 1 },
    activityId: { fontWeight: '600', color: '#1f2937', fontSize: '14px' },
    activityCustomer: { fontSize: '12px', color: '#6b7280', marginTop: '2px' },
    activityTime: { fontSize: '10px', color: '#9ca3af', marginTop: '2px' },
    
    notificationList: { display: 'flex', flexDirection: 'column', gap: '12px' },
    notificationItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px',
      borderBottom: '1px solid #f1f5f9'
    },
    notificationIcon: { width: '32px', fontSize: '16px', textAlign: 'center' },
    notificationContent: { flex: 1 },
    notificationTitle: { fontWeight: '500', fontSize: '13px', color: '#1f2937' },
    notificationMessage: { fontSize: '11px', color: '#6b7280', marginTop: '2px' },
    notificationTime: { fontSize: '10px', color: '#9ca3af' },
    
    emptyState: { textAlign: 'center', padding: '40px', color: '#9ca3af' },
    errorBox: { background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '12px', padding: '16px', marginBottom: '20px', color: '#dc2626' },
    
    // Responsive
    responsiveMetricGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(5, 1fr)',
      gap: '16px',
      marginBottom: '32px'
    }
  };

  // Responsive metric grid
  const getMetricColumns = () => {
    if (typeof window !== 'undefined' && window.innerWidth <= 768) return 'repeat(2, 1fr)';
    if (typeof window !== 'undefined' && window.innerWidth <= 500) return 'repeat(1, 1fr)';
    return 'repeat(5, 1fr)';
  };

  const [metricColumns, setMetricColumns] = useState(getMetricColumns());

  useEffect(() => {
    const handleResize = () => setMetricColumns(getMetricColumns());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={{ textAlign: 'center' }}>Loading operator dashboard...</div>
        </div>
      </div>
    );
  }

  const getMetricCardStyle = () => ({
    ...styles.metricCard,
    ...styles.responsiveMetricGrid,
    gridTemplateColumns: metricColumns
  });

  return (
    <div style={styles.container}>
      <h1 style={styles.pageTitle}>Operator Dashboard</h1>

      {error && (
        <div style={styles.errorBox}>
          {error}
          <button type="button" onClick={loadDashboard} style={{ marginLeft: '12px' }}>Retry</button>
        </div>
      )}

      {/* Search Row */}
      <div style={styles.searchRow}>
        <input 
          type="text" 
          placeholder="Search..." 
          style={styles.searchInput}
        />
        <button type="button" style={styles.searchButton}>Filter</button>
      </div>

      {/* 5 Metrics */}
<div style={{ ...styles.responsiveMetricGrid, gridTemplateColumns: metricColumns }}>
  <div style={styles.metricCard}>
    <MetricTitle
      title="Total Bookings"
      description="Total number of bookings recorded in the system, including pending, paid, and expired bookings."
    />
    <div style={styles.metricValue}>{summary?.totalBookings || 0}</div>
    <div style={styles.metricSub}>Live backend data</div>
  </div>

  <div style={styles.metricCard}>
    <MetricTitle
      title="Pending Requests"
      description="Bookings submitted by customers that are waiting for operator review or approval."
    />
    <div style={styles.metricValue}>{summary?.pendingRequests || 0}</div>
    <div style={styles.metricSub}>Awaiting approval</div>
  </div>

  <div style={styles.metricCard}>
    <MetricTitle
      title="Payment Pending"
      description="Approved bookings where the customer has not completed payment yet."
    />
    <div style={styles.metricValue}>{summary?.paymentPending || 0}</div>
    <div style={styles.metricSub}>Awaiting payment</div>
  </div>

  <div style={styles.metricCard}>
    <MetricTitle
      title="Paid Bookings"
      description="Bookings that have been successfully paid and confirmed."
    />
    <div style={styles.metricValue}>{summary?.paidBookings || 0}</div>
    <div style={styles.metricSub}>Completed</div>
  </div>

  <div style={styles.metricCard}>
    <MetricTitle
      title="Expired"
      description="Bookings that are overdue, cancelled, expired, or no longer valid."
    />
    <div style={styles.metricValue}>{summary?.expiredBookings || 0}</div>
    <div style={styles.metricSub}>Overdue/Cancelled</div>
  </div>
</div>

      {/* SARIMA Forecast Section */}
      {forecastData?.demandForecast?.length > 0 && (
        <div style={styles.forecastSection}>
          <div style={styles.forecastHeader}>
            <h3 style={styles.forecastTitle}>📈 SARIMA Demand Forecast</h3>
            <p style={styles.forecastSub}>AI-powered booking demand prediction based on historical data</p>
          </div>

          {/* Forecast Metrics */}
          <div style={styles.forecastMetricsRow}>
            <div style={styles.forecastMetricCard}>
              <div style={styles.forecastMetricLabel}>Next 7 Days Bookings</div>
              <div style={styles.forecastMetricValue}>{Math.round(next7DaysBookings)}</div>
              <div style={styles.forecastMetricSub}>predicted bookings</div>
            </div>
            <div style={styles.forecastMetricCard}>
              <div style={styles.forecastMetricLabel}>Next 7 Days Revenue</div>
              <div style={styles.forecastMetricValue}>{formatOperatorMoney(next7DaysRevenue)}</div>
              <div style={styles.forecastMetricSub}>forecasted revenue</div>
            </div>
            <div style={styles.forecastMetricCard}>
              <div style={styles.forecastMetricLabel}>Peak Forecast Day</div>
              <div style={styles.forecastMetricValue}>{peakDay?.date || 'N/A'}</div>
              <div style={styles.forecastMetricSub}>
                {peakDay ? `${peakDay.predictedBookings} bookings predicted` : ''}
              </div>
            </div>
            <div style={styles.forecastMetricCard}>
              <div style={styles.forecastMetricLabel}>Confidence Level</div>
              <div style={styles.forecastMetricValue}>95%</div>
              <div style={styles.forecastMetricSub}>SARIMA model</div>
            </div>
          </div>

          {/* Chart 1: Predicted Bookings (Bar Chart) */}
          {forecastChartData.length > 0 && (
            <div style={styles.chartContainer}>
              <div style={styles.chartTitle}>📊 Predicted Bookings (Next 14 Days)</div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={forecastChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <Tooltip formatter={(value) => [Math.round(value), 'Predicted Bookings']} />
                  <Legend />
                  <Bar dataKey="predictedBookings" fill="#3b82f6" radius={[6, 6, 0, 0]} name="Predicted Bookings" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Chart 2: Revenue Trend + Forecast */}
          {trendChartData.length > 0 && (
            <div style={styles.chartContainer}>
              <div style={styles.chartTitle}>💰 Revenue Trend & Forecast</div>
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={trendChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} interval={4} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <Tooltip formatter={(value) => formatOperatorMoney(value)} />
                  <Legend />
                  <Line type="monotone" dataKey="actual" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} name="Actual Revenue" />
                  <Line type="monotone" dataKey="predicted" stroke="#f59e0b" strokeWidth={2.5} strokeDasharray="8 4" dot={{ r: 3 }} name="Forecasted Revenue" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Insight Box */}
          <div style={styles.insightBox}>
            <p style={styles.insightText}>
              🤖 <strong>SARIMA Insight:</strong> Based on historical booking patterns, 
              demand is forecasted to {forecastChartData[7]?.predictedBookings > forecastChartData[0]?.predictedBookings ? 'increase' : 'decrease'} 
              over the next 14 days. {peakDay ? `Peak demand expected on ${peakDay.date} with approximately ${peakDay.predictedBookings} bookings.` : ''}
              {forecastData?.forecastSummary?.modelType && ` (Model: ${forecastData.forecastSummary.modelType})`}
            </p>
          </div>
        </div>
      )}

      {/* No Forecast Data Message */}
      {!forecastData?.demandForecast?.length && !loading && (
        <div style={{ ...styles.card, marginBottom: '24px', background: '#fefce8', borderColor: '#fef08a' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>📊</span>
            <div>
              <strong style={{ color: '#854d0e' }}>SARIMA Forecast Unavailable</strong>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#854d0e' }}>
                Not enough historical data for accurate forecasting. Forecast will appear after more bookings are recorded.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Dashboard Grid - Revenue Overview + Recent Activity */}
      <div style={styles.dashboardGrid}>
        {/* Revenue Overview Card */}
        <div style={styles.card}>
          <div style={styles.cardHead}>
            <div>
              <h3 style={styles.cardTitle}>Revenue Overview</h3>
              <p style={styles.cardSub}>Confirmed payment amount</p>
            </div>
          </div>
          <div style={styles.bigNumber}>
            {formatOperatorMoney(summary?.totalRevenue || 0)}
          </div>
          <p style={styles.mutedText}>
            Revenue is calculated from bookings with paid payment status.
          </p>
        </div>

        {/* Recent Booking Activity */}
        <div style={styles.card}>
          <div style={styles.cardHead}>
            <div>
              <h3 style={styles.cardTitle}>Recent Booking Activity</h3>
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
                  <div style={styles.activityId}>#{booking.id}</div>
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
      </div>

      {/* Notifications Card */}
      <div style={styles.card}>
        <div style={styles.cardHead}>
          <div>
            <h3 style={styles.cardTitle}>Recent Notifications</h3>
            <p style={styles.cardSub}>Real-time booking/payment updates for this operator account.</p>
          </div>
          <Link to="/operator/notifications" style={styles.linkButton}>View all →</Link>
        </div>

        <div style={styles.notificationList}>
          {notifications.map((item) => (
            <div key={item.id} style={styles.notificationItem}>
              <div style={styles.notificationIcon}>◇</div>
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
  );
}