import React from 'react';
import './Dashboard.css';
import '../../../../Component/MainContent/MainContent.css';
import DashboardCard from '../../../../Component/DashboardCard/DashboardCard';

const Dashboard = () => {
  return (
    <div>
      <div className="header-container">
        <h1 className="dashboard-page-title">Dashboard</h1>
      </div>
      <DashboardCard />
    </div>
  );
};

export default Dashboard;
