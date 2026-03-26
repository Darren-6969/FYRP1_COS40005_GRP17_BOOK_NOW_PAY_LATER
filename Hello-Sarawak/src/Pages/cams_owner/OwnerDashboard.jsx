import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Sidebar from '../../Component/Sidebar/Sidebar';
import Dashboard from './Modules/Dashboard/Dashboard';
import Customers from './Modules/Customers/Customers';
import Operators from './Modules/Operators/Operators';
import PropertyListing from './Modules/Property Listing/PropertyListing';
import Reservations from './Modules/Reservations/Reservations';
import BooknPayLog from './Modules/BooknPay Log/BooknPayLog';
import Finance from './Modules/Finances/Finances';
import AuditTrails from './Modules/Audit Trails/AuditTrails';
import Profile from './Modules/Profile/Profile';
import Cluster from './Modules/Cluster/Cluster';
import NoAccess from '../../Component/NoAccess/NoAccess';
import { FiHome, FiUsers, FiCalendar, FiCreditCard, FiBarChart, FiMessageSquare, FiFileText } from 'react-icons/fi';
import { FaHotel, FaUserTie, FaLayerGroup, FaHistory } from 'react-icons/fa';
import { GoLog } from "react-icons/go";
import { CgProfile } from "react-icons/cg";
import '../../Component/MainContent/MainContent.css';

  const OwnerDashboard = () => {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [usergroup, setusergroup] = useState('');
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
    // Initial check
    checkAndRedirect();
  
    const checkInterval = setInterval(() => {
      checkAndRedirect();
    }, 3000); // Check every 3 seconds
  
    // Define the check function
    function checkAndRedirect() {
    const loggedInStatus = localStorage.getItem('isLoggedIn');
    const usergroupStatus = localStorage.getItem('usergroup');
    
    setIsLoggedIn(loggedInStatus === 'true');
    setusergroup(usergroupStatus);
    
    if (loggedInStatus !== 'true' || usergroupStatus !== 'Owner') {
      navigate('/no-access');
    }
  }
  
    // Clean up interval on unmount
    return () => clearInterval(checkInterval);
  }, [navigate]);

  if (!isLoggedIn || usergroup !== 'Owner') {
    return <NoAccess />;
  }

  const links = [
    { path: '/owner_dashboard/dashboard', label: 'Dashboard', icon: <FiHome /> },
    { path: '/owner_dashboard/customers', label: 'Customers', icon: <FiUsers /> },
    { path: '/owner_dashboard/operators', label: 'Admin/Moderator', icon: <FaUserTie /> },
    { path: '/owner_dashboard/property-listing', label: 'PropertyListing', icon: <FaHotel /> },
    { path: '/owner_dashboard/reservations', label: 'Reservations', icon: <FiCalendar /> },
    { path: '/owner_dashboard/booknpay-log', label: 'BooknPayLog', icon: <GoLog /> },
    { path: '/owner_dashboard/finance', label: 'Finance', icon: <FiCreditCard /> },
    { path: '/owner_dashboard/audit-trails', label: 'Audit Trails', icon: <FaHistory /> },
    { path: '/owner_dashboard/cluster', label: 'Cluster', icon: <FaLayerGroup /> },
    { path: '/owner_dashboard/profile', label: 'Profile', icon: <CgProfile /> },
    
  ];

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  return (
    <div className={`dashboard-container ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar
        title="CAMS Owner"
        links={links}
        isCollapsed={isSidebarCollapsed}
        toggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        handleLogout={handleLogout}
      />
      <div className="dashboard-content">
        <Routes>
          <Route path="/" element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="customers" element={<Customers />} />
          <Route path="operators" element={<Operators />} />
          <Route path="property-listing" element={<PropertyListing />} />
          <Route path="reservations" element={<Reservations />} />
          <Route path="booknpay-log" element={<BooknPayLog />} />
          <Route path="finance" element={<Finance />} />
          <Route path="audit-trails" element={<AuditTrails />} />
          <Route path="cluster" element={<Cluster />} />
          <Route path="profile" element={<Profile />} />
          {/* Catch-all for undefined routes */}
          <Route path="*" element={<NoAccess />} />
        </Routes>
      </div>
    </div>
  );
};

export default OwnerDashboard;
