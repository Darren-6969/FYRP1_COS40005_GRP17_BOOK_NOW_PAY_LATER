import React, { useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import  Loader  from "../../Component/Loader/Loader";
import { Line } from "react-chartjs-2";
import { fetchFinance, fetchOccupancyRate, fetchRevPAR, fetchCancellationRate, fetchCustomerRetentionRate, fetchGuestSatisfactionScore, fetchALOS } from "../../../Api/api";
import { useQuery } from "@tanstack/react-query";
import "./FinanceCard.css";
import { FiDollarSign } from 'react-icons/fi';
import { FaChartBar, FaRegCreditCard, FaChartLine, FaBan } from 'react-icons/fa';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const FinanceCard = () => {
  const [chartType, setChartType] = useState("revenue");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const userid = localStorage.getItem('userid');

  const {
    data: financeData,
    isLoading: financeLoading,
    error: financeError
  } = useQuery({
    queryKey: ['finance', userid], 
    queryFn: () => fetchFinance(userid),
    enabled: !!userid
  });

  const { 
    data: occupancyData,
    isLoading: occupancyLoading,
    error: occupancyError
  } = useQuery({
    queryKey: ['occupancy_rate', userid],
    queryFn: () => fetchOccupancyRate(userid),
    enabled: !!userid
  });

  const {
    data: revPARData,
    isLoading: revPARLoading,
    error: revPARError
  } = useQuery({
    queryKey: ['revpar', userid],
    queryFn: () => fetchRevPAR(userid),
    enabled: !!userid 
  });

  const { 
    data: cancellationRateData,
    isLoading: cancellationRateLoading,
    error: cancellationRateError
  } = useQuery({
    queryKey: ['cancellation_rate', userid],
    queryFn: () => fetchCancellationRate(userid),
    enabled: !!userid
  });

  const { 
    data: customerRetentionRateData,
    isLoading: customerRetentionRateLoading,
    error: customerRetentionRateError
  } = useQuery({
    queryKey: ['customerRetentionRate', userid],
    queryFn: () => fetchCustomerRetentionRate(userid),
    enabled: !!userid
  });

  const { 
    data: guestSatisfactionScoreData,
    isLoading: guestSatisfactionScoreLoading,
    error: guestSatisfactionScoreError
  } = useQuery({
    queryKey: ['guestSatisfactionScore', userid],
    queryFn: () => fetchGuestSatisfactionScore(userid),
    enabled: !!userid
  });

  const { 
    data: alosData,
    isLoading: alosLoading,
    error: alosError
  } = useQuery({
    queryKey: ['alos', userid],
    queryFn: () => fetchALOS(userid),
    enabled: !!userid
  });


  const isLoading = financeLoading || occupancyLoading || revPARLoading || 
                   cancellationRateLoading || customerRetentionRateLoading || 
                   guestSatisfactionScoreLoading || alosLoading;


  const hasError = financeError || occupancyError || revPARError || 
                  cancellationRateError || customerRetentionRateError || 
                  guestSatisfactionScoreError || alosError;

  if (isLoading) return <div className="loader-box"><Loader /></div>;
  if (hasError) return <div>Error: {hasError.message}</div>;


  const filterDataByYear = (data) => {
    if (!data?.monthlyData) return data;
    return {
      ...data,
      monthlyData: data.monthlyData.filter(item => item.month.startsWith(selectedYear))
    };
  };

  const calculateGrowthRate = (currentValue, lastValue) => {
    if (!lastValue || lastValue === 0) return 0;
    return (((currentValue - lastValue) / lastValue) * 100).toFixed(1);
  };

  const getAvailableYears = () => {
    const allYears = new Set();
    

    [financeData, occupancyData, revPARData, cancellationRateData, 
     customerRetentionRateData, guestSatisfactionScoreData, alosData].forEach(data => {
      if (data?.monthlyData) {
        data.monthlyData.forEach(item => {
          allYears.add(item.month.split('-')[0]);
        });
      }
    });
    
    return Array.from(allYears).sort((a, b) => b - a);
  };

  const getMonthlyStats = () => {
    if (!financeData?.monthlyData || financeData.monthlyData.length < 2) {
      return {
        revenue: { current: 0, growth: 0 },
        reservations: { current: 0, growth: 0 },
        averageRevenue: { current: 0, growth: 0 },
      };
    }

    const sortedData = [...financeData.monthlyData].sort((a, b) =>
      b.month.localeCompare(a.month)
    );

    const currentMonth = sortedData[0];
    const lastMonth = sortedData[1];

    return {
      revenue: {
        current: currentMonth.monthlyrevenue,
        growth: calculateGrowthRate(
          currentMonth.monthlyrevenue,
          lastMonth.monthlyrevenue
        ),
      },
      reservations: {
        current: currentMonth.monthlyreservations,
        growth: calculateGrowthRate(
          currentMonth.monthlyreservations,
          lastMonth.monthlyreservations
        ),
      },
      averageRevenue: {
        current: currentMonth.monthlyrevenue,
        growth: calculateGrowthRate(
          currentMonth.monthlyrevenue,
          lastMonth.monthlyrevenue
        ),
      },
    };
  };


  const createMiniChart = (data, title, color, valueFormatter, dataKey) => {
    if (!data?.monthlyData || data.monthlyData.length === 0) {
      return null;
    }

    const sortedData = [...data.monthlyData].sort((a, b) => 
      new Date(a.month) - new Date(b.month)
    );

    const chartData = {
      labels: sortedData.map(item => {
        const date = new Date(item.month);
        return date.toLocaleDateString('en-US', { month: 'short' });
      }),
      datasets: [{
        label: title,
        data: sortedData.map(item => {

          let value = 0;
          if (dataKey === 'revenue') {
            value = item.monthlyrevenue || 0;
          } else if (dataKey === 'reservations') {
            value = item.monthlyreservations || 0;
          } else if (dataKey === 'averageRevenue') {
            value = item.monthlyrevenue || 0;
          }
          return value;
        }),
        fill: true,
        backgroundColor: 'rgba(30, 192, 192, 0.12)',
        borderColor: color,
        borderWidth: 2,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointBackgroundColor: color,
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
      }]
    };

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `${title}: ${valueFormatter(context.parsed.y)}`
          }
        }
      },
      scales: {
        x: {
          display: false,
          grid: { display: false }
        },
        y: {
          display: false,
          grid: { display: false }
        }
      },
      elements: {
        point: {
          radius: 0
        }
      }
    };

    return { data: chartData, options };
  };

  const filteredFinanceData = filterDataByYear(financeData);
  const filteredOccupancyData = filterDataByYear(occupancyData);
  const filteredRevPARData = filterDataByYear(revPARData);
  const filteredCancellationRateData = filterDataByYear(cancellationRateData);
  const filteredCustomerRetentionRateData = filterDataByYear(customerRetentionRateData);
  const filteredGuestSatisfactionScoreData = filterDataByYear(guestSatisfactionScoreData);
  const filteredALOSData = filterDataByYear(alosData);

 

  const renderChart = () => {
    switch (chartType) {
      case "revenue":
        if (!filteredFinanceData?.monthlyData || filteredFinanceData.monthlyData.length === 0) {
          return <h1>No revenue data available.</h1>;
        }
        return (
          <Line 
            data={{
              labels: filteredFinanceData.monthlyData.map((item) => item.month),
              datasets: [{
                label: "Monthly Revenue",
                data: filteredFinanceData.monthlyData.map((item) => item.monthlyrevenue),
                fill: true,
                backgroundColor: "rgba(75, 192, 192, 0.2)",
                borderColor: "rgb(75, 192, 192)",
                tension: 0.3,
                pointBackgroundColor: "rgb(75, 192, 192)",
                pointBorderColor: "#fff",
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7,
              }],
            }}
            options={{
              responsive: true,
              plugins: {
                legend: { position: "top" },
                title: { display: true, text: `Monthly Revenue Trend - ${selectedYear}` },
                tooltip: {
                  callbacks: { label: (context) => `Revenue: $${context.parsed.y}` },
                },
              },
              scales: {
                y: {
                  beginAtZero: true,
                  title: { display: true, text: "Revenue ($)" },
                },
                x: { title: { display: true, text: "Month" } },
              },
            }}
          />
        );

      case "reservations":
        if (!filteredFinanceData?.monthlyData || filteredFinanceData.monthlyData.length === 0) {
          return <h1>No reservations data available.</h1>;
        }
        return (
          <Line 
            data={{
              labels: filteredFinanceData.monthlyData.map((item) => item.month),
              datasets: [{
                label: "Monthly Reservations",
                data: filteredFinanceData.monthlyData.map((item) => item.monthlyreservations),
                fill: true,
                backgroundColor: "rgba(30, 144, 255, 0.2)",
                borderColor: "rgb(30, 144, 255)",
                tension: 0.3,
                pointBackgroundColor: "rgb(30, 144, 255)",
                pointBorderColor: "#fff",
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7,
              }],
            }}
            options={{
              responsive: true,
              plugins: {
                legend: { position: "top" },
                title: { display: true, text: `Monthly Reservations Trend - ${selectedYear}` },
                tooltip: {
                  callbacks: { label: (context) => `Reservations: ${context.parsed.y}` },
                },
              },
              scales: {
                y: {
                  beginAtZero: true,
                  title: { display: true, text: "Number of Reservations" },
                },
                x: { title: { display: true, text: "Month" } },
              },
            }}
          />
        );

      case "occupancy":
        if (!filteredOccupancyData?.monthlyData || filteredOccupancyData.monthlyData.length === 0) {
          return <h1>No occupancy rate data available.</h1>;
        }
        return (
          <Line 
            data={{
              labels: filteredOccupancyData.monthlyData.map((item) => item.month),
              datasets: [{
                label: "Occupancy Rate",
                data: filteredOccupancyData.monthlyData.map((item) => 
                  parseFloat(item.occupancy_rate || item.occupancyRate || 0)
                ),
                fill: true,
                backgroundColor: "rgba(255, 99, 132, 0.2)",
                borderColor: "rgb(255, 99, 132)",
                tension: 0.3,
                pointBackgroundColor: "rgb(255, 99, 132)",
                pointBorderColor: "#fff",
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7,
              }],
            }}
            options={{
              responsive: true,
              plugins: {
                legend: { position: "top" },
                title: { display: true, text: `Monthly Occupancy Rate Trend - ${selectedYear}` },
                tooltip: {
                  callbacks: { label: (context) => `Occupancy Rate: ${context.parsed.y.toFixed(2)}%` },
                },
              },
              scales: {
                y: {
                  beginAtZero: true,
                  max: 100,
                  title: { display: true, text: "Occupancy Rate (%)" },
                },
                x: { title: { display: true, text: "Month" } },
              },
            }}
          />
        );

      case "revpar":
        if (!filteredRevPARData?.monthlyData || filteredRevPARData.monthlyData.length === 0) {
          return <h1>No RevPAR data available.</h1>;
        }
        return (
          <Line 
            data={{
              labels: filteredRevPARData.monthlyData.map((item) => item.month),
              datasets: [{
                label: "RevPAR",
                data: filteredRevPARData.monthlyData.map((item) => 
                  parseFloat(item.revpar || item.revPAR || 0)
                ),
                fill: true,
                backgroundColor: "rgba(255, 159, 64, 0.2)",
                borderColor: "rgb(255, 159, 64)",
                tension: 0.3,
                pointBackgroundColor: "rgb(255, 159, 64)",
                pointBorderColor: "#fff",
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7,
              }],
            }}
            options={{
              responsive: true,
              plugins: {
                legend: { position: "top" },
                title: { display: true, text: `Monthly RevPAR Trend - ${selectedYear}` },
                tooltip: {
                  callbacks: { label: (context) => `RevPAR: $${context.parsed.y.toFixed(2)}` },
                },
              },
              scales: {
                y: {
                  beginAtZero: true,
                  title: { display: true, text: "RevPAR ($)" },
                },
                x: { title: { display: true, text: "Month" } },
              },
            }}
          />
        );

      case "cancellation":
        if (!filteredCancellationRateData?.monthlyData || filteredCancellationRateData.monthlyData.length === 0) {
          return <h1>No cancellation rate data available.</h1>;
        }
        return (
          <Line 
            data={{
              labels: filteredCancellationRateData.monthlyData.map((item) => item.month),
              datasets: [{
                label: "Cancellation Rate",
                data: filteredCancellationRateData.monthlyData.map((item) => 
                  parseFloat(item.cancellation_rate || item.cancellationRate || 0)
                ),
                fill: true,
                backgroundColor: "rgba(255, 205, 86, 0.2)",
                borderColor: "rgb(255, 205, 86)",
                tension: 0.3,
                pointBackgroundColor: "rgb(255, 205, 86)",
                pointBorderColor: "#fff",
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7,
              }],
            }}
            options={{
              responsive: true,
              plugins: {
                legend: { position: "top" },
                title: { display: true, text: `Monthly Cancellation Rate Trend - ${selectedYear}` },
                tooltip: {
                  callbacks: { label: (context) => `Cancellation Rate: ${context.parsed.y.toFixed(2)}%` },
                },
              },
              scales: {
                y: {
                  beginAtZero: true,
                  max: 100,
                  title: { display: true, text: "Cancellation Rate (%)" },
                },
                x: { title: { display: true, text: "Month" } },
              },
            }}
          />
        );

      case "retention":
        if (!filteredCustomerRetentionRateData?.monthlyData || filteredCustomerRetentionRateData.monthlyData.length === 0) {
          return <h1>No customer retention rate data available.</h1>;
        }
        return (
          <Line 
            data={{
              labels: filteredCustomerRetentionRateData.monthlyData.map((item) => item.month),
              datasets: [{
                label: "Customer Retention Rate",
                data: filteredCustomerRetentionRateData.monthlyData.map((item) => 
                  parseFloat(item.customer_retention_rate || item.customerRetentionRate || 0)
                ),
                fill: true,
                backgroundColor: "rgba(153, 102, 255, 0.2)",
                borderColor: "rgb(153, 102, 255)",
                tension: 0.3,
                pointBackgroundColor: "rgb(153, 102, 255)",
                pointBorderColor: "#fff",
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7,
              }],
            }}
            options={{
              responsive: true,
              plugins: {
                legend: { position: "top" },
                title: { display: true, text: `Monthly Customer Retention Rate Trend - ${selectedYear}` },
                tooltip: {
                  callbacks: { label: (context) => `Retention Rate: ${context.parsed.y.toFixed(2)}%` },
                },
              },
              scales: {
                y: {
                  beginAtZero: true,
                  max: 100,
                  title: { display: true, text: "Retention Rate (%)" },
                },
                x: { title: { display: true, text: "Month" } },
              },
            }}
          />
        );

      case "satisfaction":
        if (!filteredGuestSatisfactionScoreData?.monthlyData || filteredGuestSatisfactionScoreData.monthlyData.length === 0) {
          return <h1>No guest satisfaction score data available.</h1>;
        }
        return (
          <Line 
            data={{
              labels: filteredGuestSatisfactionScoreData.monthlyData.map((item) => item.month),
              datasets: [{
                label: "Guest Satisfaction Score",
                data: filteredGuestSatisfactionScoreData.monthlyData.map((item) => 
                  parseFloat(item.guest_satisfaction_score || item.guestSatisfactionScore || 0)
                ),
                fill: true,
                backgroundColor: "rgba(201, 203, 207, 0.2)",
                borderColor: "rgb(201, 203, 207)",
                tension: 0.3,
                pointBackgroundColor: "rgb(201, 203, 207)",
                pointBorderColor: "#fff",
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7,
              }],
            }}
            options={{
              responsive: true,
              plugins: {
                legend: { position: "top" },
                title: { display: true, text: `Monthly Guest Satisfaction Score Trend - ${selectedYear}` },
                tooltip: {
                  callbacks: { label: (context) => `Satisfaction Score: ${context.parsed.y.toFixed(2)}` },
                },
              },
              scales: {
                y: {
                  beginAtZero: true,
                  max: 5,
                  title: { display: true, text: "Satisfaction Score" },
                },
                x: { title: { display: true, text: "Month" } },
              },
            }}
          />
        );

      case "alos":
        if (!filteredALOSData?.monthlyData || filteredALOSData.monthlyData.length === 0) {
          return <h1>No average length of stay data available.</h1>;
        }
        return (
          <Line 
            data={{
              labels: filteredALOSData.monthlyData.map((item) => item.month),
              datasets: [{
                label: "Average Length of Stay",
                data: filteredALOSData.monthlyData.map((item) => 
                  parseFloat(item.average_length_of_stay || item.averageLengthOfStay || 0)
                ),
                fill: true,
                backgroundColor: "rgba(54, 162, 235, 0.2)",
                borderColor: "rgb(54, 162, 235)",
                tension: 0.3,
                pointBackgroundColor: "rgb(54, 162, 235)",
                pointBorderColor: "#fff",
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7,
              }],
            }}
            options={{
              responsive: true,
              plugins: {
                legend: { position: "top" },
                title: { display: true, text: `Monthly Average Length of Stay Trend - ${selectedYear}` },
                tooltip: {
                  callbacks: { label: (context) => `ALOS: ${context.parsed.y.toFixed(2)} days` },
                },
              },
              scales: {
                y: {
                  beginAtZero: true,
                  title: { display: true, text: "Average Length of Stay (Days)" },
                },
                x: { title: { display: true, text: "Month" } },
              },
            }}
          />
        );

      default:
        return <h1>Please select a valid chart type.</h1>;
    }
  };


  const getOccupancyGrowth = () => {
    if (!filteredOccupancyData?.monthlyData || filteredOccupancyData.monthlyData.length < 2) return 0;
    const sorted = [...filteredOccupancyData.monthlyData].sort((a, b) => a.month.localeCompare(b.month));
    const last = parseFloat(sorted[sorted.length - 2].occupancy_rate || 0);
    const curr = parseFloat(sorted[sorted.length - 1].occupancy_rate || 0);
    return last === 0 ? 0 : (((curr - last) / last) * 100).toFixed(1);
  };


  const getCancellationGrowth = () => {
    if (!filteredCancellationRateData?.monthlyData || filteredCancellationRateData.monthlyData.length < 2) return 0;
    const sorted = [...filteredCancellationRateData.monthlyData].sort((a, b) => a.month.localeCompare(b.month));
    const last = parseFloat(sorted[sorted.length - 2].cancellation_rate || 0);
    const curr = parseFloat(sorted[sorted.length - 1].cancellation_rate || 0);
    return last === 0 ? 0 : (((curr - last) / last) * 100).toFixed(1);
  };


  const getRevPARGrowth = () => {
    if (!filteredRevPARData?.monthlyData || filteredRevPARData.monthlyData.length < 2) return 0;
    const sorted = [...filteredRevPARData.monthlyData].sort((a, b) => a.month.localeCompare(b.month));
    const last = parseFloat(sorted[sorted.length - 2].revpar || 0);
    const curr = parseFloat(sorted[sorted.length - 1].revpar || 0);
    return last === 0 ? 0 : (((curr - last) / last) * 100).toFixed(1);
  };

  return (
    <div>
      <div className="finance-dashboard-stats-row">
        {/* Total Revenue */}
        <div className="finance-dashboard-card kpi-card">
          <div className="kpi-content">
            <div className="kpi-icon"><FiDollarSign size={28} color="#1bc47d" /></div>
            <div className="finance-dashboard-card-title">Total Revenue</div>
            <div className="finance-dashboard-card-value">
              RM{(
                Array.isArray(filteredFinanceData?.monthlyData)
                  ? filteredFinanceData.monthlyData.reduce((sum, item) => sum + item.monthlyrevenue, 0)
                  : 0
              ).toFixed(2)}
            </div>
            <div className={`kpi-percentage ${Number(getMonthlyStats().revenue.growth) > 0 ? 'positive' : 'negative'}`}> 
              {Number(getMonthlyStats().revenue.growth) > 0 ? '+' : ''}
              {getMonthlyStats().revenue.growth}%
              <span className="kpi-icon">
                {Number(getMonthlyStats().revenue.growth) > 0 ? '▲' : '▼'}
              </span>
            </div>
          </div>
        </div>
        {/* Occupancy Rate */}
        <div className="finance-dashboard-card kpi-card">
          <div className="kpi-content">
            <div className="kpi-icon"><FaChartLine size={28} color="#fbc02d" /></div>
            <div className="finance-dashboard-card-title">Occupancy Rate</div>
            <div className="finance-dashboard-card-value">
              {filteredOccupancyData?.monthlyData && filteredOccupancyData.monthlyData.length > 0
                ? `${parseFloat(filteredOccupancyData.monthlyData[filteredOccupancyData.monthlyData.length - 1].occupancy_rate || 0).toFixed(2)}%`
                : '0.00%'}
            </div>
            <div className={`kpi-percentage ${getOccupancyGrowth() > 0 ? 'positive' : 'negative'}`}> 
              {getOccupancyGrowth() > 0 ? '+' : ''}
              {getOccupancyGrowth()}%
              <span className="kpi-icon">
                {getOccupancyGrowth() > 0 ? '▲' : '▼'}
              </span>
            </div>
          </div>
        </div>
        {/* RevPAR */}
        <div className="finance-dashboard-card kpi-card">
          <div className="kpi-content">
            <div className="kpi-icon"><FaChartBar size={28} color="#1e90ff" /></div>
            <div className="finance-dashboard-card-title">RevPAR</div>
            <div className="finance-dashboard-card-value">
              {filteredRevPARData?.monthlyData && filteredRevPARData.monthlyData.length > 0
                ? `RM${parseFloat(filteredRevPARData.monthlyData[filteredRevPARData.monthlyData.length - 1].revpar || 0).toFixed(2)}`
                : 'RM0.00'}
            </div>
            <div className={`kpi-percentage ${getRevPARGrowth() > 0 ? 'positive' : 'negative'}`}> 
              {getRevPARGrowth() > 0 ? '+' : ''}
              {getRevPARGrowth()}%
              <span className="kpi-icon">
                {getRevPARGrowth() > 0 ? '▲' : '▼'}
              </span>
            </div>
          </div>
        </div>
        {/* Average Revenue */}
        <div className="finance-dashboard-card kpi-card">
          <div className="kpi-content">
            <div className="kpi-icon"><FaRegCreditCard size={28} color="#ff6384" /></div>
            <div className="finance-dashboard-card-title">Average Revenue</div>
            <div className="finance-dashboard-card-value">
              RM{Array.isArray(filteredFinanceData?.monthlyData) && filteredFinanceData.monthlyData.length > 0
                ? (filteredFinanceData.monthlyData.reduce((sum, item) => sum + item.monthlyrevenue, 0) / filteredFinanceData.monthlyData.length).toFixed(2)
                : '0.00'}
            </div>
            <div className={`kpi-percentage ${Number(getMonthlyStats().averageRevenue.growth) > 0 ? 'positive' : 'negative'}`}> 
              {Number(getMonthlyStats().averageRevenue.growth) > 0 ? '+' : ''}
              {getMonthlyStats().averageRevenue.growth}%
              <span className="kpi-icon">
                {Number(getMonthlyStats().averageRevenue.growth) > 0 ? '▲' : '▼'}
              </span>
            </div>
          </div>
        </div>  
      </div>

      <div className="finance-dashboard-chart-panel">
        <div className="finance-dashboard-controls-row">
          <div className="finance-control-group">
            <label htmlFor="chartSelector" className="finance-control-label">
              Select Chart:
            </label>
            <div className="finance-select-wrapper">
              <select
                id="chartSelector"
                value={chartType}
                onChange={(e) => setChartType(e.target.value)}
                className="finance-select"
              >
                <option value="revenue">Revenue Chart</option>
                <option value="reservations">Reservations Chart</option>
                <option value="occupancy">Occupancy Rate Chart</option>
                <option value="revpar">RevPAR Chart</option>
                <option value="cancellation">Cancellation Rate Chart</option>
                <option value="retention">Customer Retention Rate Chart</option>
                <option value="satisfaction">Guest Satisfaction Score Chart</option>
                <option value="alos">Average Length of Stay Chart</option>
              </select>
              <div className="finance-select-arrow">
                <svg className="finance-select-icon" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          <div className="finance-control-group">
            <label htmlFor="yearSelector" className="finance-control-label">
              Select Year:
            </label>
            <div className="finance-select-wrapper">
              <select
                id="yearSelector"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="finance-select"
              >
                {getAvailableYears().map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <div className="finance-select-arrow">
                <svg className="finance-select-icon" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        </div>
        <div className="finance-dashboard-chart-area">{renderChart()}</div>
      </div>
    </div>
  );
}

export default FinanceCard