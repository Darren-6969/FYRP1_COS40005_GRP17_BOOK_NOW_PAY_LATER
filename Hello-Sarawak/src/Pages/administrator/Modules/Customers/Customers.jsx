import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCustomers, suspendUser, activateUser } from '../../../../../Api/api';
import ActionDropdown from '../../../../Component/ActionDropdown/ActionDropdown';
import Modal from '../../../../Component/Modal/Modal';
import SearchBar from '../../../../Component/SearchBar/SearchBar';
import Filter from '../../../../Component/Filter/Filter';
import PaginatedTable from '../../../../Component/PaginatedTable/PaginatedTable';
import Toast from '../../../../Component/Toast/Toast';
import Loader from '../../../../Component/Loader/Loader';
import Status from '../../../../Component/Status/Status';
import UserActivityCell from '../../../../Component/UserActivityCell/UserActivityCell';
import { FaEye, FaBan, FaUser } from 'react-icons/fa';
import '../../../../Component/MainContent/MainContent.css';
import '../../../../Component/ActionDropdown/ActionDropdown.css';
import '../../../../Component/Modal/Modal.css';
import '../../../../Component/Filter/Filter.css';
import '../../../../Component/SearchBar/SearchBar.css';
import './Customers.css';


const Customers = () => {
    const [filteredCustomers, setFilteredCustomers] = useState([]);
    const [searchKey, setSearchKey] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('All');
    const [appliedFilters, setAppliedFilters] = useState({ status: 'All' });
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [toastMessage, setToastMessage] = useState('');
    const [showToast, setShowToast] = useState(false);
    const [toastType, setToastType] = useState('');

    const queryClient = useQueryClient();

    const { data: customers = [], isLoading } = useQuery({
        queryKey: ['customers'],
        queryFn: fetchCustomers,
        onError: (error) => {
            console.error('Failed to fetch customer details', error);
            displayToast('error', 'Failed to load customers. Please try again.');
        },
        staleTime: 5 * 60 * 1000,
    });

    const suspendMutation = useMutation({
        mutationFn: (userId) => suspendUser(userId),
        onSuccess: (_, userId) => {
            queryClient.setQueryData(['customers'], (oldData) =>
                oldData.map((c) => (c.userid === userId ? { ...c, uactivation: 'Inactive' } : c))
            );
            const customer = customers.find((c) => c.userid === userId);
            displayToast('success', `User ${customer.username} has been suspended.`);
        },
        onError: (error) => {
            console.error('Failed to suspend user:', error);
            displayToast('error', 'Error suspending user');
        },
    });

    const activateMutation = useMutation({
        mutationFn: (userId) => activateUser(userId),
        onSuccess: (_, userId) => {
            queryClient.setQueryData(['customers'], (oldData) =>
                oldData.map((c) => (c.userid === userId ? { ...c, uactivation: 'Active' } : c))
            );
            const customer = customers.find((c) => c.userid === userId);
            displayToast('success', `User ${customer.username} has been activated.`);
        },
        onError: (error) => {
            console.error('Failed to activate user:', error);
            displayToast('error', 'Error activating user');
        },
    });

    useEffect(() => {
        if (customers.length > 0) {
            applyFilters();
        }
    }, [customers, searchKey, appliedFilters]);

    const displayToast = (type, message) => {
        setToastType(type);
        setToastMessage(message);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 5000);
    };

    const applyFilters = () => {
        const filtered = customers.filter(
            (customer) =>
                (appliedFilters.status === 'All' || customer.uactivation === appliedFilters.status) &&
                `${customer.username} ${customer.uemail} ${customer.uactivation}`
                    .toLowerCase()
                    .includes(searchKey.toLowerCase())
        );
        setFilteredCustomers(filtered);
    };

    const filters = [
        {
            name: 'status',
            label: 'Status',
            value: selectedStatus,
            onChange: setSelectedStatus,
            options: [
                { value: 'All', label: 'All Statuses' },
                { value: 'Active', label: 'Active' },
                { value: 'Inactive', label: 'Inactive' },
            ],
        },
    ];

    const displayLabels = {
        userid: 'UID',
        ufirstname: 'First Name',
        ulastname: 'Last Name',
        uemail: 'Email',
        uphoneno: 'Phone Number',
        uactivation: 'Status',
        ugender: 'Gender',
        ucountry: 'Country',
        ustatus: 'Login Status'
      };

    const handleAction = async (action, customer) => {
        if (action === 'view') {
            const essentialFields = {
                userid: customer.userid || 'N/A',
                username: customer.username || 'N/A',
                ufirstname: customer.ufirstname || 'N/A',
                ulastname: customer.ulastname || 'N/A',
                uemail: customer.uemail || 'N/A',
                uphoneno: customer.uphoneno || 'N/A',
                uactivation: customer.uactivation || 'N/A',
                ugender: customer.ugender || 'N/A',
                ucountry: customer.ucountry || 'N/A',
                ustatus: customer.ustatus || 'N/A',
            };
            setSelectedCustomer(essentialFields);
        } else if (action === 'suspend') {
            suspendMutation.mutate(customer.userid);
        } else if (action === 'activate') {
            activateMutation.mutate(customer.userid);
        }
    };

    const handleApplyFilters = () => {
        setAppliedFilters({ status: selectedStatus });
    };

    const customerDropdownItems = (customerStatus) => {
        if (customerStatus === 'Inactive') {
            return [
                { label: 'View Details', icon: <FaEye />, action: 'view' },
                { label: 'Activate', icon: <FaUser />, action: 'activate' },
            ];
        } else if (customerStatus === 'Active') {
            return [
                { label: 'View Details', icon: <FaEye />, action: 'view' },
                { label: 'Suspend', icon: <FaBan />, action: 'suspend' },
            ];
        }

        return [{ label: 'View Details', icon: <FaEye />, action: 'view' }];
    };

    const columns = [
        { header: 'UID', accessor: 'userid' },
        {
            header: 'Username',
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
            header: 'Status',
            accessor: 'uactivation',
            render: (customer) => (
                <Status value={customer.uactivation || 'Active'} />
            ),
        },
        {
            header: 'Actions',
            accessor: 'actions',
            render: (customer) => (
                <ActionDropdown
                    items={customerDropdownItems(customer.uactivation)}
                    onAction={(action) => handleAction(action, customer)}
                />
            ),
        },
    ];

    return (
        <div>
            <div className="header-container">
                <h1 className="dashboard-page-title">Customer Details</h1>
                <SearchBar
                    value={searchKey}
                    onChange={(newValue) => setSearchKey(newValue)}
                    placeholder="Search customers..."
                />
            </div>

            <Filter filters={filters} onApplyFilters={handleApplyFilters} />

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
                title="Customer Details"
                data={selectedCustomer || {}}
                labels={displayLabels}
                onClose={() => setSelectedCustomer(null)}
            />

            {showToast && <Toast type={toastType} message={toastMessage} />}
        </div>
    );
};

export default Customers;
