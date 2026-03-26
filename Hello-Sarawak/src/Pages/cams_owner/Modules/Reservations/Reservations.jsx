import React, { useState, useEffect } from 'react';
import { fetchReservation } from '../../../../../Api/api';
import Filter from '../../../../Component/Filter/Filter';
import ActionDropdown from '../../../../Component/ActionDropdown/ActionDropdown';
import Modal from '../../../../Component/Modal/Modal';
import SearchBar from '../../../../Component/SearchBar/SearchBar';
import PaginatedTable from '../../../../Component/PaginatedTable/PaginatedTable';
import Status from '../../../../Component/Status/Status';
import { FaEye } from 'react-icons/fa';
import Toast from '../../../../Component/Toast/Toast';
import Alert from '../../../../Component/Alert/Alert';
import '../../../../Component/MainContent/MainContent.css';
import '../../../../Component/ActionDropdown/ActionDropdown.css';
import '../../../../Component/Modal/Modal.css';
import '../../../../Component/Filter/Filter.css';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Loader from '../../../../Component/Loader/Loader';

const Reservations = () => {
    const [searchKey, setSearchKey] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('All');
    const [appliedFilters, setAppliedFilters] = useState({ status: 'All' });
    const [selectedReservation, setSelectedReservation] = useState(null);
    const [toastMessage, setToastMessage] = useState('');
    const [toastType, setToastType] = useState('');
    const [showToast, setShowToast] = useState(false);
    
    const queryClient = useQueryClient();

    const displayToast = (type, message) => {
        setToastType(type);
        setToastMessage(message);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 5000);
    };

    // Use TanStack Query to fetch and process reservations
    const { 
        data: reservations = [],
        isLoading,
        isError,
        error,
        refetch
    } = useQuery({
        queryKey: ['reservations'],
        queryFn: async () => {
            try {
                const reservationData = await fetchReservation();
                if (!Array.isArray(reservationData)) {
                    throw new Error("Invalid data format received");
                }
                
                // Process reservations to check for expired status
                return reservationData.map(reservation => {
                    const reservationblocktime = new Date(reservation.reservationblocktime).getTime();
                    const currentDateTime = Date.now() + 8 * 60 * 60 * 1000;

                    if (reservation.reservationstatus === 'Pending' && currentDateTime > reservationblocktime) {
                        return { ...reservation, reservationstatus: 'expired' };
                    }
                    return reservation;
                });
            } catch (error) {
                console.error('Failed to fetch reservation details:', error);
                throw new Error(`Failed to fetch reservations: ${error.message}`);
            }
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: false,
        onError: (error) => {
            displayToast('error', error.message || 'Failed to load reservations');
        }
    });

    const handleApplyFilters = () => {
        setAppliedFilters({ status: selectedStatus });
    };

    // Filter options
    const filters = [
        {
            name: 'status',
            label: 'Status',
            value: selectedStatus,
            onChange: setSelectedStatus,
            options: [
                { value: 'All', label: 'All Statuses' },
                { value: 'Pending', label: 'Pending' },
                { value: 'Accepted', label: 'Accepted' },
                { value: 'Rejected', label: 'Rejected' },
                { value: 'Canceled', label: 'Canceled' },
                { value: 'Paid', label: 'Paid' },
                { value: 'Expired', label: 'Expired' },
            ],
        },
    ];

    const displayLabels = {
        reservationid: "Reservation ID",
        propertyaddress: "Property Name",
        totalprice: "Total Price",
        reservationstatus: "Reservation Status",
        checkindatetime: "Check-In Date Time",
        checkoutdatetime: "Check-Out Date Time",
        request: "Request",
        images: "Images"
    };

    const formatDate = (datetime) => {
        if (!datetime) return '';
        const date = new Date(datetime);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
    };

    const filteredReservations = Array.isArray(reservations)
    ? reservations.filter(
        (reservation) =>
            (appliedFilters.status === 'All' ||
                (reservation.reservationstatus ?? 'Pending').toLowerCase() === appliedFilters.status.toLowerCase()) &&
            (
                (reservation.reservationid?.toString().toLowerCase().includes(searchKey.toLowerCase()) || '') ||
                (reservation.propertyaddress?.toString().toLowerCase().includes(searchKey.toLowerCase()) || '') ||
                (reservation.totalprice?.toString().toLowerCase().includes(searchKey.toLowerCase()) || '') ||
                (reservation.request?.toLowerCase().includes(searchKey.toLowerCase()) || '') ||
                (reservation.reservationstatus?.toLowerCase().includes(searchKey.toLowerCase()) || '') ||
                (formatDate(reservation.checkindatetime).includes(searchKey)) ||
                (formatDate(reservation.checkoutdatetime).includes(searchKey)) ||
                (reservation.rcfirstname?.toLowerCase().includes(searchKey.toLowerCase()) || '') ||
                (reservation.rclastname?.toLowerCase().includes(searchKey.toLowerCase()) || '')
            )
    )
    : [];

    const handleAction = (action, reservation) => {
        if (reservation.reservationstatus === 'expired') {
            displayToast('error', 'Action cannot be performed. This reservation has expired.');
            return;
        }

        if (action === 'view') {
            setSelectedReservation({
                reservationid: reservation.reservationid || 'N/A',
                propertyaddress: reservation.propertyaddress || 'N/A',
                checkindatetime: formatDate(reservation.checkindatetime) || 'N/A',
                checkoutdatetime: formatDate(reservation.checkoutdatetime) || 'N/A',
                request: reservation.request || 'N/A',
                totalprice: reservation.totalprice || 'N/A',
                name: `${reservation.rcfirstname || ''} ${reservation.rclastname || ''}`.trim() || 'N/A',
                reservationstatus: reservation.reservationstatus || 'N/A',
                images: reservation.propertyimage || [],
            });
        }
    };

    const reservationDropdownItems = [
        { label: 'View Details', icon: <FaEye />, action: 'view' }
    ];

    const columns = [
        { header: 'ID', accessor: 'reservationid' },
        {
            header: 'Image',
            accessor: 'propertyimage',
            render: (reservation) => (
                Array.isArray(reservation.propertyimage) && reservation.propertyimage.length > 0 ? (
                    <img
                        src={`data:image/jpeg;base64,${reservation.propertyimage[0]}`}
                        alt={reservation.propertyaddress}
                        style={{ width: 80, height: 80 }}
                    />
                ) : (
                    <span>No Image</span>
                )
            ),
        },
        { header: 'Property', accessor: 'propertyaddress' },
        {
            header: 'Name',
            accessor: 'name',
            render: (reservation) => (
                `${reservation.rcfirstname.trim()} ${reservation.rclastname.trim()}`
            ),
        },
        { header: 'Total Price', accessor: 'totalprice' },
        {
            header: 'Check-In Date',
            accessor: 'checkindatetime',
            render: (reservation) => {
                const date = new Date(reservation.checkindatetime);
                return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
            },
        },
        {
            header: 'Check-Out Date',
            accessor: 'checkoutdatetime',
            render: (reservation) => {
                const date = new Date(reservation.checkoutdatetime);
                return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
            },
        },
        {
            header: 'Status',
            accessor: 'reservationstatus',
            render: (reservation) => (
                <Status value={reservation.reservationstatus} />
            ),
        },
        {
            header: 'Actions',
            accessor: 'actions',
            render: (reservation) => (
                <ActionDropdown
                    items={reservationDropdownItems}
                    onAction={(action) => handleAction(action, reservation)}
                    onClose={() => {}}
                />
            ),
        },
    ];

    return (
        <div>
            {showToast && <Toast type={toastType} message={toastMessage} />}
            <div className="header-container">
                <h1 className="dashboard-page-title">Reservations</h1>
                <SearchBar 
                    value={searchKey} 
                    onChange={(newValue) => setSearchKey(newValue)} 
                    placeholder="Search reservation..." 
                />
            </div>

            <Filter filters={filters} onApplyFilters={handleApplyFilters} />

            {isLoading && <div className="loader-box">
                <Loader />
            </div>}
            
            {isError && (
                <Alert 
                    type="error" 
                    message={`Error: ${error?.message || 'Failed to load reservations'}`} 
                />
            )}

            {!isLoading && !isError && (
                <PaginatedTable
                    data={filteredReservations}
                    columns={columns}
                    rowKey="reservationid"
                    enableCheckbox={false} 
                />
            )}

            <Modal
                isOpen={!!selectedReservation}
                title={`Reservation ID: ${selectedReservation?.reservationid}`}
                data={selectedReservation || {}}
                labels={displayLabels} 
                onClose={() => setSelectedReservation(null)}
            />
        </div>
    );
};

export default Reservations;
