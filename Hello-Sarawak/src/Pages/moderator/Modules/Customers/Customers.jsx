import React, { useState, useEffect } from 'react';
import { fetchCustomers } from '../../../../../Api/api';
import { useQuery } from '@tanstack/react-query';
import ActionDropdown from '../../../../Component/ActionDropdown/ActionDropdown';
import Modal from '../../../../Component/Modal/Modal';
import SearchBar from '../../../../Component/SearchBar/SearchBar';
import PaginatedTable from '../../../../Component/PaginatedTable/PaginatedTable';
import Toast from '../../../../Component/Toast/Toast';
import Role from '../../../../Component/Role/Role';
import UserActivityCell from '../../../../Component/UserActivityCell/UserActivityCell';
import { FaEye } from 'react-icons/fa';
import '../../../../Component/MainContent/MainContent.css';
import '../../../../Component/ActionDropdown/ActionDropdown.css';
import '../../../../Component/Modal/Modal.css';
import '../../../../Component/SearchBar/SearchBar.css';
import './Customers.css';
import Loader from '../../../../Component/Loader/Loader';

const Customers = () => {
    const [searchKey, setSearchKey] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [toastMessage, setToastMessage] = useState('');
    const [showToast, setShowToast] = useState(false);
    const [toastType, setToastType] = useState('');
    const API_URL = import.meta.env.VITE_API_URL;

    // Using React Query to fetch customers data
    const { data: customers = [], isLoading, error } = useQuery({
        queryKey: ['customers'],
        queryFn: fetchCustomers,
        staleTime: 5 * 60 * 1000, // Data remains fresh for 5 minutes
        cacheTime: 10 * 60 * 1000, // Cache persists for 10 minutes
    });

    // Display error toast if data fetching fails
    useEffect(() => {
        if (error) {
            displayToast('error', 'Failed to fetch customer details');
            console.error('Failed to fetch customer details', error);
        }
    }, [error]);

    const displayToast = (type, message) => {
        setToastType(type);
        setToastMessage(message);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 5000);
    };

    const handleAction = (action, customer) => {
        if (action === 'view') {
            const essentialFields = {
                firstName: customer.ufirstname || 'N/A',
                lastName: customer.ulastname || 'N/A',
                email: customer.uemail || 'N/A',
                phoneNo: customer.uphoneno || 'N/A',
                gender: customer.ugender || 'N/A',
                country: customer.ucountry || 'N/A',
            };
            setSelectedCustomer(essentialFields);
        }
    };

    const customerDropdownItems = [
        { label: 'View Details', icon: <FaEye />, action: 'view' },
    ];

    const displayLabels = {
        firstName: "First Name",
        lastName: "Last Name",
        email: "Email",
        gender: "Gender",
        country: "Country"
    };

    const columns = [
        { header: 'UID', accessor: 'userid' },
        {
            header: 'Customer',
            accessor: 'customer',
            render: (customer) => (
               <UserActivityCell user={customer} />
            ),
        },
        {
            header: 'Name',
            accessor: 'name',
            render: (customer) => (
                `${customer.ufirstname.trim()} ${customer.ulastname.trim()}`
            ),
        },
        { header: 'Email', accessor: 'uemail' },
        {
            header: 'Role',
            accessor: 'usergroup',
            render: (customer) => (
               <Role role={customer.usergroup || 'Customer'} />
            ),
        },
        {
            header: 'Actions',
            accessor: 'actions',
            render: (customer) => (
                <ActionDropdown
                    items={customerDropdownItems}
                    onAction={(action) => handleAction(action, customer)}
                    onClose={() => {}}
                />
            ),
        },
    ];

    const filteredCustomers = customers.filter((customer) =>
        `${customer.ufirstname} ${customer.ulastname} ${customer.uemail} ${customer.uphoneno}`
            .toLowerCase()
            .includes(searchKey.toLowerCase())
    );

    return (
        <div>
            {showToast && <Toast type={toastType} message={toastMessage} />}
            
            <div className="header-container">
                <h1 className="dashboard-page-title">Customer Details</h1>
                <SearchBar value={searchKey} onChange={(newValue) => setSearchKey(newValue)} placeholder="Search customers..." />
            </div>

            {isLoading ? (
                <div className="loader-box">
                    <Loader />
                </div>
            ) : (
                <PaginatedTable
                    data={filteredCustomers}
                    columns={columns}
                    rowKey="userid"
                    enableCheckbox={false}
                />
            )}

            <Modal
                isOpen={!!selectedCustomer}
                title={`${selectedCustomer?.firstName} ${selectedCustomer?.lastName}`}
                data={selectedCustomer || {}}
                labels={displayLabels}
                onClose={() => setSelectedCustomer(null)}
            />
        </div>
    );
};

export default Customers;
