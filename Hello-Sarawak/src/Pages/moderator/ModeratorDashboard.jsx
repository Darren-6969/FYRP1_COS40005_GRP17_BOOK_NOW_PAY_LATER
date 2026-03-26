import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Sidebar from '../../Component/Sidebar/Sidebar';
import Dashboard from './Modules/Dashboard/Dashboard';
import Customers from './Modules/Customers/Customers';
import PropertyListing from './Modules/Property Listing/PropertyListing';
import Reservations from './Modules/Reservations/Reseravtions';
import BooknPayLog from './Modules/BooknPay Log/BooknPayLog';
import Finance from './Modules/Finance/Finances';
import NoAccess from '../../Component/NoAccess/NoAccess';
import Profile from './Modules/Profile/Profile';
import AuditTrails from './Modules/Audit Trails/AuditTrails';
import '../../Component/MainContent/MainContent.css';
import { FiCalendar, FiUsers, FiHome } from 'react-icons/fi';
import { CgProfile } from "react-icons/cg";
import { GoLog } from "react-icons/go";
import { FaHotel, FaHistory } from 'react-icons/fa';
import { VscGraphLine } from "react-icons/vsc";
import { useQuery } from '@tanstack/react-query';
import { fetchUserData } from '../../../Api/api';

const ModeratorDashboard = () => {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [usergroup, setusergroup] = useState('');
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const navigate = useNavigate();
    const userID = localStorage.getItem('userid');

    // React Query for user data with polling
    const { data: userData } = useQuery({
        queryKey: ['userData', userID],
        queryFn: () => fetchUserData(userID),
        enabled: !!isLoggedIn && !!userID,
        staleTime: 0,
        refetchInterval: 1000, // Check every 1 second for faster response
        refetchIntervalInBackground: true,
    });

    useEffect(() => {
        // Check for inactive status
        if (userData?.uactivation === "Inactive") {
            handleLogout();
            navigate('/no-access');
        }
    }, [userData?.uactivation, navigate]);

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
            
            if (loggedInStatus !== 'true' || usergroupStatus !== 'Moderator') {
                navigate('/no-access');
            }
        }

        // Clean up interval on unmount
        return () => clearInterval(checkInterval);
    }, [navigate]);

    const handleLogout = () => {
        localStorage.clear();
        setIsLoggedIn(false);
        setusergroup('');
    };

    // Display a loading state until authentication is confirmed
    if (!isLoggedIn || usergroup !== 'Moderator') {
        return <div>Loading...</div>;
    }

    const links = [
        { path: '/moderator_dashboard/dashboard', label: 'Dashboard', icon: <FiHome /> },
        { path: '/moderator_dashboard/customers', label: 'Customer', icon: <FiUsers /> },
        { path: '/moderator_dashboard/property-listing', label: 'PropertyListing', icon: <FaHotel /> },
        { path: '/moderator_dashboard/reservations', label: 'Reservations', icon: <FiCalendar /> },
        { path: '/moderator_dashboard/booknpay-log', label: 'BooknPayLog', icon: <GoLog /> },
        { path: '/moderator_dashboard/audit-trails', label: 'AuditTrails', icon: <FaHistory /> },
        { path: '/moderator_dashboard/finance', label: 'Finance', icon: <VscGraphLine /> },
        { path: '/moderator_dashboard/profile', label: 'Profile', icon: <CgProfile /> },
    ];

    return (
        <div className={`dashboard-container ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
            <Sidebar
                title="Moderator"
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
                    <Route path="property-listing" element={<PropertyListing />} />
                    <Route path="reservations" element={<Reservations/>} />
                    <Route path="booknpay-log" element={<BooknPayLog />} />
                    <Route path="audit-trails" element={<AuditTrails />} />
                    <Route path="finance" element={<Finance />} />
                    <Route path="profile" element={<Profile />} />
                    <Route path="*" element={<NoAccess />} />
                </Routes>
            </div>
        </div>
    );
};

export default ModeratorDashboard;
