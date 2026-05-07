import { useEffect, useState } from "react";
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend,
  ComposedChart, Area
} from "recharts";
import { getBookings } from "../../services/booking_service";
import { getPayments } from "../../services/payment_service";
import { operatorService } from "../../services/operator_service";

export default function Dashboard() {
  // ========== ALL HOOKS - TOP LEVEL ==========
  const [bookings, setBookings] = useState([]);
  const [payments, setPayments] = useState([]);
  const [forecastData, setForecastData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const getGridColumns = () => {
    if (typeof window !== 'undefined' && window.innerWidth <= 1000) return 'repeat(3, 1fr)';
    if (typeof window !== 'undefined' && window.innerWidth <= 640) return 'repeat(2, 1fr)';
    return 'repeat(6, 1fr)';
  };
  
  const [gridColumns, setGridColumns] = useState(getGridColumns());

  // Main data loading effect
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        
        let bookingsRes = { data: [] };
        let paymentsRes = { data: [] };
        let reportsRes = { data: null };
        
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
    const handleResize = () => setGridColumns(getGridColumns());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ========== CALCULATIONS ==========
  const totalBookings = bookings?.length || 0;
  const pendingBookings = bookings?.filter(b => b?.status === "PENDING").length || 0;
  const paidBookings = bookings?.filter(b => b?.status === "PAID").length || 0;
  const cancelledBookings = bookings?.filter(b => 
    b?.status === "REJECTED" || b?.status === "CANCELLED"
  ).length || 0;
  const overduePayments = payments?.filter(p => p?.status === "OVERDUE").length || 0;
  const totalRevenue = payments?.filter(p => p?.status === "PAID")
    .reduce((sum, p) => sum + Number(p?.amount || 0), 0) || 0;

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
    container: { padding: '24px', maxWidth: '1400px', margin: '0 auto' },
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
      padding: '16px',
      boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
    },
    metricTitle: { fontSize: '13px', color: '#6b7280', marginBottom: '8px' },
    metricValue: { fontSize: '28px', fontWeight: '700', color: '#1f2937' },
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
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '24px',
      marginBottom: '32px'
    },
    card: {
      background: 'white',
      border: '1px solid #e5e7eb',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
    },
    cardTitle: { fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#1f2937' },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
    th: { textAlign: 'left', padding: '12px 8px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontWeight: '600', color: '#6b7280' },
    td: { padding: '12px 8px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' },
    badge: { display: 'inline-block', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' },
    paymentActivityItem: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '12px 0',
      borderBottom: '1px solid #f1f5f9'
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

      {/* ROW 1: Six Metric Cards */}
      <div style={styles.metricsGrid}>
        <div style={styles.metricCard}>
          <div style={styles.metricTitle}>Total Bookings</div>
          <div style={styles.metricValue}>{totalBookings}</div>
        </div>
        <div style={styles.metricCard}>
          <div style={styles.metricTitle}>Pending Bookings</div>
          <div style={styles.metricValue}>{pendingBookings}</div>
        </div>
        <div style={styles.metricCard}>
          <div style={styles.metricTitle}>Paid Bookings</div>
          <div style={styles.metricValue}>{paidBookings}</div>
        </div>
        <div style={styles.metricCard}>
          <div style={styles.metricTitle}>Cancelled/Voided</div>
          <div style={styles.metricValue}>{cancelledBookings}</div>
        </div>
        <div style={styles.metricCard}>
          <div style={styles.metricTitle}>Overdue Payments</div>
          <div style={styles.metricValue}>{overduePayments}</div>
        </div>
        <div style={styles.metricCard}>
          <div style={styles.metricTitle}>Total Revenue</div>
          <div style={styles.metricValue}>RM {totalRevenue.toLocaleString()}</div>
        </div>
      </div>

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
              tick={{ fontSize: 11, fill: '#6b7280' }}
              axisLine={{ stroke: '#e5e7eb' }}
              tickLine={false}
              interval={Math.floor(chartData.length / 10)}
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
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
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