import { useEffect, useMemo, useState } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  formatOperatorMoney,
  operatorService,
} from "../../services/operator_service";

// ─── Custom tooltip for the revenue chart ────────────────────────────────────
function RevenueTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  const items = payload.filter(
    (p) => p.dataKey !== "lower" && p.dataKey !== "ciWidth"
  );

  return (
    <div className="operator-forecast-tooltip">
      <p className="forecast-tooltip-label">{label}</p>
      {items.map((p) => (
        <p key={p.dataKey} style={{ color: p.color, margin: "2px 0" }}>
          {p.name}: {formatOperatorMoney(p.value)}
        </p>
      ))}
    </div>
  );
}

// ─── Metric card ─────────────────────────────────────────────────────────────
function Metric({ label, value, sub = "Live backend data", variant = "" }) {
  return (
    <div className={`operator-metric ${variant}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{sub}</small>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function OperatorSalesReport() {
  // ========== ALL HOOKS AT THE TOP - NO CONDITIONALS ==========
  const [summary, setSummary] = useState(null);
  const [paymentMethodBreakdown, setPaymentMethodBreakdown] = useState([]);
  const [topBookedServices, setTopBookedServices] = useState([]);
  const [revenueTrend, setRevenueTrend] = useState([]);
  const [demandForecast, setDemandForecast] = useState([]);
  const [forecastSummary, setForecastSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Responsive grid state - MUST be before any conditional returns
  const [gridColumns, setGridColumns] = useState(3);

  const loadReport = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await operatorService.getReports();
      setSummary(res.data.summary ?? {});
      setPaymentMethodBreakdown(res.data.paymentMethodBreakdown ?? []);
      setTopBookedServices(res.data.topBookedServices ?? []);
      setRevenueTrend(res.data.revenueTrend ?? []);
      setDemandForecast(res.data.demandForecast ?? []);
      setForecastSummary(res.data.forecastSummary ?? null);
    } catch (err) {
      console.error("Load report error:", err);
      setError(err.response?.data?.message ?? "Failed to load sales report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  // Responsive resize effect
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width <= 768) setGridColumns(1);
      else if (width <= 1100) setGridColumns(2);
      else setGridColumns(3);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Merge historical + forecast into one series for the revenue chart.
  const revenueChartData = useMemo(() => {
    const hist = (revenueTrend || []).map((d) => ({
      date: d.date?.slice(5) || "",
      actual: Math.round((d.revenue || 0) * 100) / 100,
    }));
    const fcast = (demandForecast || []).map((d) => ({
      date: d.date?.slice(5) || "",
      predicted: Math.round((d.predictedRevenue || 0) * 100) / 100,
      lower: Math.round((d.revenueLower || 0) * 100) / 100,
      ciWidth: Math.round(((d.revenueUpper || 0) - (d.revenueLower || 0)) * 100) / 100,
    }));
    return [...hist, ...fcast];
  }, [revenueTrend, demandForecast]);

  // Bar chart for bookings – next 14 days only
  const bookingChartData = useMemo(() => {
    const forecast = demandForecast || [];
    return forecast.slice(0, 14).map((d) => ({
      date: d.date?.slice(5) || "",
      bookings: Math.round((d.predictedBookings || 0) * 10) / 10,
    }));
  }, [demandForecast]);

  // Colors for pie chart
  const PIE_COLORS = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', 
    '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
  ];

  // Get category icon
  const getCategoryIcon = (category) => {
    switch(category?.toLowerCase()) {
      case 'vehicle': return '🚗';
      case 'room': return '🏨';
      case 'package': return '📦';
      case 'transport': return '🚕';
      default: return '📋';
    }
  };

  // Inline styles for the new components (no CSS changes)
  const inlineStyles = {
    threeColumnGrid: {
      display: 'grid',
      gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
      gap: '20px',
      marginTop: '20px'
    },
    topServicesContainer: {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      maxHeight: '400px',
      overflowY: 'auto'
    },
    serviceItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '14px',
      padding: '12px',
      background: '#f8fafc',
      borderRadius: '12px'
    },
    serviceIcon: {
      width: '40px',
      height: '40px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#e0e7ff',
      borderRadius: '10px',
      fontSize: '20px',
      flexShrink: 0
    },
    serviceRank: {
      width: '32px',
      height: '32px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#3b82f6',
      color: 'white',
      fontWeight: 'bold',
      fontSize: '14px',
      borderRadius: '8px',
      flexShrink: 0
    },
    serviceInfo: {
      flex: 1,
      minWidth: 0
    },
    serviceName: {
      fontWeight: 600,
      color: '#1f2937',
      fontSize: '14px',
      marginBottom: '4px'
    },
    serviceCategory: {
      fontSize: '11px',
      color: '#6b7280'
    },
    serviceStats: {
      textAlign: 'right',
      flexShrink: 0
    },
    serviceCount: {
      fontSize: '13px',
      fontWeight: 600,
      color: '#3b82f6',
      marginBottom: '4px'
    },
    serviceRevenue: {
      fontSize: '12px',
      color: '#059669',
      fontWeight: 500
    },
    methodListItem: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '8px 0',
      borderBottom: '1px solid #e5e7eb'
    },
    methodName: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    colorDot: {
      display: 'inline-block',
      width: '12px',
      height: '12px',
      borderRadius: '2px'
    },
    viewMoreBtn: {
      width: '100%',
      padding: '8px',
      marginTop: '12px',
      background: '#f3f4f6',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '12px',
      color: '#6b7280'
    }
  };

  // ========== CONDITIONAL RETURNS AFTER ALL HOOKS ==========
  if (loading) {
    return (
      <div className="operator-page">
        <div className="operator-card">Loading report…</div>
      </div>
    );
  }

  const lateRisk = forecastSummary?.latePaymentRisk ?? 0;
  const riskVariant = lateRisk >= 30 ? "danger" : lateRisk >= 10 ? "warning" : "success";

  return (
    <div className="operator-page">
      {/* ── Page header ── */}
      <section className="operator-page-head">
        <div>
          <h1>Sales Report</h1>
          <p>
            Revenue analytics, booking trends, and SARIMA-powered demand
            forecasting.
          </p>
        </div>
      </section>

      {error && (
        <div className="operator-alert danger">
          {error}
          <button type="button" onClick={loadReport}>
            Retry
          </button>
        </div>
      )}

      {/* ── Historical KPIs ── */}
      <section className="operator-metric-grid five">
        <Metric
          label="Total Revenue"
          value={formatOperatorMoney(summary?.totalRevenue ?? 0)}
        />
        <Metric label="Total Bookings" value={summary?.totalBookings ?? 0} />
        <Metric label="Paid Bookings" value={summary?.paidBookings ?? 0} />
        <Metric
          label="Pending Payments"
          value={summary?.pendingPayments ?? 0}
        />
        <Metric
          label="Payment Completion"
          value={`${summary?.paymentCompletionRate ?? 0}%`}
        />
      </section>

      {/* ── Forecast KPIs ── */}
      {forecastSummary && (
        <section className="operator-metric-grid four">
          <Metric
            label="Next 7 Days Revenue"
            value={formatOperatorMoney(forecastSummary.next7DaysRevenue)}
            sub="Forecast"
            variant="info"
          />
          <Metric
            label="Next 7 Days Bookings"
            value={forecastSummary.next7DaysBookings}
            sub="Forecast"
            variant="info"
          />
          <Metric
            label="Late Payment Risk"
            value={`${lateRisk}%`}
            sub="Based on last 30 days"
            variant={riskVariant}
          />
          <Metric
            label="Forecast Model"
            value={forecastSummary.modelType}
            sub={`${forecastSummary.dataPoints} data points`}
          />
        </section>
      )}

      {/* ── Revenue trend + forecast chart (full width) ── */}
      <div className="operator-card operator-forecast-card">
        <div className="operator-card-head">
          <div>
            <h2>Revenue Trend &amp; 30-Day Forecast</h2>
            <p>
              Solid line — actual revenue (last 30 days). Dashed line — SARIMA
              forecast. Shaded area — 95% confidence interval.
            </p>
          </div>
          {forecastSummary && (
            <span className="operator-model-badge">
              {forecastSummary.modelType}
            </span>
          )}
        </div>

        {revenueChartData.length > 1 ? (
          <>
            <ResponsiveContainer width="100%" height={290}>
              <ComposedChart
                data={revenueChartData}
                margin={{ top: 10, right: 16, left: 8, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="ciGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#93c5fd" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#93c5fd" stopOpacity={0.08} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  interval={Math.floor(revenueChartData.length / 8)}
                />
                <YAxis
                  tickFormatter={(v) => v >= 1000 ? `RM${(v / 1000).toFixed(1)}k` : `RM${v}`}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  width={64}
                />
                <Tooltip content={<RevenueTooltip />} />
                <Legend formatter={(value) => value === "95% CI" ? "95% Confidence Interval" : value} />
                <Area type="monotone" dataKey="lower" stackId="ci" stroke="none" fill="#f8fbff" legendType="none" name="CI Base" connectNulls />
                <Area type="monotone" dataKey="ciWidth" stackId="ci" stroke="none" fill="url(#ciGradient)" legendType="square" name="95% CI" connectNulls />
                <Line type="monotone" dataKey="actual" stroke="#2563eb" strokeWidth={2.5} dot={false} name="Actual Revenue" connectNulls />
                <Line type="monotone" dataKey="predicted" stroke="#f59e0b" strokeWidth={2.5} strokeDasharray="7 4" dot={false} name="Forecast" connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
            <div className="operator-chart-legend">
              <span><i className="legend-blue" /> Actual Revenue</span>
              <span><i className="legend-orange" /> SARIMA Forecast</span>
              <span><i style={{ background: "#93c5fd", display: "inline-block", width: 9, height: 9, borderRadius: 2, marginRight: 6 }} />95% Confidence Interval</span>
            </div>
          </>
        ) : (
          <div className="operator-empty-state">Not enough historical data for the forecast chart yet.</div>
        )}
      </div>

      {/* ── Bottom row: Payment Breakdown + Top Booked Services + Booking Forecast ── */}
      <div style={inlineStyles.threeColumnGrid}>
        
        {/* TAB 1: Payment method breakdown with Pie Chart */}
        <div className="operator-card">
          <h2>💰 Payment Method Breakdown</h2>
          
          {paymentMethodBreakdown && paymentMethodBreakdown.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={paymentMethodBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="amount"
                    nameKey="method"
                    label={({ name, percent }) => 
                      name && percent ? `${name} (${(percent * 100).toFixed(0)}%)` : name
                    }
                    labelLine={true}
                  >
                    {paymentMethodBreakdown.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={PIE_COLORS[index % PIE_COLORS.length]} 
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [formatOperatorMoney(value), "Amount"]} />
                </PieChart>
              </ResponsiveContainer>
              
              <div style={{ marginTop: '16px' }}>
                {paymentMethodBreakdown.map((item, idx) => (
                  <div key={item.method || idx} style={inlineStyles.methodListItem}>
                    <div style={inlineStyles.methodName}>
                      <span style={{ 
                        ...inlineStyles.colorDot, 
                        backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] 
                      }}></span>
                      <span>{item.method || 'Unknown'}</span>
                    </div>
                    <strong>{formatOperatorMoney(item.amount || 0)}</strong>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="operator-empty-state">No paid payment method data yet.</div>
          )}
        </div>

        {/* TAB 2: Top Booked Services */}
        <div className="operator-card">
          <h2>🏆 Top Booked Services</h2>
          <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '16px' }}>
            Most frequently booked vehicles, rooms, and packages
          </p>
          
          {topBookedServices && topBookedServices.length > 0 ? (
            <div style={inlineStyles.topServicesContainer}>
              {topBookedServices.slice(0, 5).map((service, idx) => (
                <div key={service.id || idx} style={inlineStyles.serviceItem}>
                  <div style={inlineStyles.serviceRank}>#{idx + 1}</div>
                  <div style={inlineStyles.serviceIcon}>
                    {getCategoryIcon(service.category)}
                  </div>
                  <div style={inlineStyles.serviceInfo}>
                    <div style={inlineStyles.serviceName}>{service.name}</div>
                    <div style={inlineStyles.serviceCategory}>
                      {service.category || 'Service'}
                    </div>
                  </div>
                  <div style={inlineStyles.serviceStats}>
                    <div style={inlineStyles.serviceCount}>{service.bookingCount} bookings</div>
                    <div style={inlineStyles.serviceRevenue}>{formatOperatorMoney(service.revenue || 0)}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="operator-empty-state">No booking data available yet.</div>
          )}
        </div>

        {/* TAB 3: Booking volume forecast */}
        <div className="operator-card">
          <div className="operator-card-head">
            <div>
              <h2>📅 Booking Volume Forecast</h2>
              <p>Predicted bookings — next 14 days</p>
            </div>
          </div>

          {bookingChartData && bookingChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={bookingChartData} margin={{ top: 0, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#64748b" }} interval={1} />
                <YAxis tick={{ fontSize: 10, fill: "#64748b" }} />
                <Tooltip formatter={(v) => [v, "Predicted Bookings"]} labelStyle={{ fontWeight: 700 }} />
                <Bar dataKey="bookings" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Predicted Bookings" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="operator-empty-state">No forecast data available yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}