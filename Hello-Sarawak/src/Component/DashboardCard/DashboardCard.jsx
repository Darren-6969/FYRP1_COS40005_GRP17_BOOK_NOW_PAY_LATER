import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FiUsers, FiCalendar, FiDollarSign, FiArrowRight } from 'react-icons/fi';
import { FaBuilding, FaChartLine, FaRegCreditCard, FaChartBar } from 'react-icons/fa';
import {
    fetchCustomers,
    fetchModerators,
    fetchAdministrators,
    fetchReservation,
    fetchFinance,
    fetchOccupancyRate,
    fetchRevPAR,
    fetchGuestSatisfactionScore,
    fetchPropertiesListingTable
} from '../../../Api/api';
import './DashboardCard.css';
import Loader from '../Loader/Loader';

const DashboardCard = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        totalUsers: 0,
        totalProperties: 0,
        totalReservations: 0,
        totalRevenue: 0,
    });
    const [userid, setUserid] = useState('');
    const [userGroup, setUserGroup] = useState('');

    useEffect(() => {
        const storedUserId = localStorage.getItem('userid');
        const storedUserGroup = localStorage.getItem('usergroup');
        if (storedUserId) setUserid(storedUserId);
        if (storedUserGroup) setUserGroup(storedUserGroup);
    }, []);

    // Fetch customers
    const { data: customers = [], isLoading: customersLoading } = useQuery({
        queryKey: ['customers'],
        queryFn: fetchCustomers,
    });

    // Fetch moderators
    const { data: moderators = [], isLoading: moderatorsLoading } = useQuery({
        queryKey: ['moderators'],
        queryFn: fetchModerators,
    });

    // Fetch administrators
    const { data: administrators = [], isLoading: administratorsLoading } = useQuery({
        queryKey: ['administrators'],
        queryFn: fetchAdministrators,
    });

    // Fetch properties
    const { data: properties = [], isLoading: propertiesLoading } = useQuery({
        queryKey: ['properties'],
        queryFn: fetchPropertiesListingTable,
    });

    // Fetch reservations
    const { data: reservations = [], isLoading: reservationsLoading } = useQuery({
        queryKey: ['reservations'],
        queryFn: fetchReservation,
    });

    // Fetch finance data
    const { data: finance = { totalRevenue: 0 }, isLoading: financeLoading } = useQuery({
        queryKey: ['finance', userid],
        queryFn: () => fetchFinance(userid),
        enabled: !!userid,
    });

    // Fetch occupancy rate
    const { data: occupancyRate = { rate: 0 }, isLoading: occupancyRateLoading } = useQuery({
        queryKey: ['occupancy_rate', userid],
        queryFn: () => fetchOccupancyRate(userid),
        enabled: !!userid,
    });

    // Fetch RevPAR
    const { data: revPAR = { rate: 0 }, isLoading: revPARLoading } = useQuery({
        queryKey: ['revpar', userid],
        queryFn: () => fetchRevPAR(userid),
        enabled: !!userid,
    });

    // Fetch guest satisfaction score
    const { data: guestSatisfactionScore = { score: 0 }, isLoading: guestSatisfactionScoreLoading } = useQuery({
        queryKey: ['guestSatisfactionScore', userid],
        queryFn: () => fetchGuestSatisfactionScore(userid),
        enabled: !!userid,
    });

    useEffect(() => {
        if (!customersLoading && !moderatorsLoading && !administratorsLoading && !propertiesLoading && !reservationsLoading && !financeLoading) {
            const totalUsers = (Array.isArray(customers) ? customers.length : 0)
                + (Array.isArray(moderators) ? moderators.length : 0)
                + (Array.isArray(administrators) ? administrators.length : 0);
            setStats({
                totalUsers,
                totalProperties: properties.properties.length,
                totalReservations: Array.isArray(reservations) ? reservations.length : 0,
                totalRevenue: finance.monthlyData?.[0]?.monthlyrevenue || 0,
                
            });
            
        }
    }, [
        customers, moderators, administrators, properties, reservations, finance,
        customersLoading, moderatorsLoading, administratorsLoading, propertiesLoading, reservationsLoading, financeLoading
    ]);

    const isLoading = customersLoading || moderatorsLoading || administratorsLoading ||
        propertiesLoading || reservationsLoading || financeLoading ||
        occupancyRateLoading || revPARLoading || guestSatisfactionScoreLoading;

    const formatCurrency = (amount) => `MYR ${amount.toFixed(2)}`;
    const formatPercentage = (value) => `${value.toFixed(1)}%`;

    const getNavigationPath = (path) => {
        switch (userGroup) {
            case 'Moderator':
                return `/moderator_dashboard${path}`;
            case 'Administrator':
                return `/administrator_dashboard${path}`;
            case 'Owner':
                return `/owner_dashboard${path}`;
            default:
                return `/moderator_dashboard${path}`;
        }
    };

    const cardData = [
        {
            title: 'Total Users',
            value: stats.totalUsers,
            icon: <FiUsers />,
            iconClass: 'user-icon',
            onDetails: () => navigate(getNavigationPath('/customers')),
        },
        {
            title: 'Total Properties',
            value: stats.totalProperties,
            icon: <FaBuilding />,
            iconClass: 'property-icon',
            onDetails: () => navigate(getNavigationPath('/property-listing')),
        },
        {
            title: 'Total Reservations',
            value: stats.totalReservations,
            icon: <FiCalendar />,
            iconClass: 'reservation-icon',
            onDetails: () => navigate(getNavigationPath('/reservations')),
        },
        {
            title: 'Occupancy Rate',
            value: formatPercentage(occupancyRate.monthlyData?.[0]?.occupancy_rate || 0),
            icon: <FaChartLine />,
            iconClass: 'occupancy-icon',
            onDetails: () => navigate(getNavigationPath('/finance')),
        },
        {
            title: 'RevPAR',
            value: formatCurrency(revPAR?.rate || 0),
            icon: <FaRegCreditCard />,
            iconClass: 'revpar-icon',
            onDetails: () => navigate(getNavigationPath('/finance')),
        },
        {
            title: 'Total Revenue',
            value: formatCurrency(stats.totalRevenue),
            icon: <FiDollarSign />,
            iconClass: 'revenue-icon',
            onDetails: () => navigate(getNavigationPath('/finance')),
        },
        {
            title: 'Guest Satisfaction',
            value: `${guestSatisfactionScore?.score?.toFixed(1) || "0.0"}/5.0`,
            icon: <FaChartBar />,
            iconClass: 'satisfaction-icon',
            onDetails: () => navigate(getNavigationPath('/finance')),
        },
    ];

    if (isLoading) {
        return (
            <div className="loader-box">
                <Loader />
            </div>
        );
    }

    return (
        <div className="stats-grid">
            {cardData.map((card) => (
                <div className="dashboard-card" key={card.title}>
                    <div className="dashboard-card-header">
                        <span>{card.title}</span>
                        <div className={`dashboard-card-icon ${card.iconClass}`}>{card.icon}</div>
                    </div>
                    <div className="dashboard-card-value">{card.value}</div>
                    <button className="dashboard-card-btn" onClick={card.onDetails}>
                        View Details <FiArrowRight />
                    </button>
                </div>
            ))}
        </div>
    );
};

export default DashboardCard;
