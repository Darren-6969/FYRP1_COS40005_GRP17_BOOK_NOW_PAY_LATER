import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchReservation, updateReservationStatus, acceptBooking, getOperatorProperties, fetchOperators, suggestNewRoom, sendSuggestNotification } from '../../../../../Api/api';
import Filter from '../../../../Component/Filter/Filter';
import ActionDropdown from '../../../../Component/ActionDropdown/ActionDropdown';
import Modal from '../../../../Component/Modal/Modal';
import SearchBar from '../../../../Component/SearchBar/SearchBar';
import PaginatedTable from '../../../../Component/PaginatedTable/PaginatedTable';
import Toast from '../../../../Component/Toast/Toast';
import Loader from '../../../../Component/Loader/Loader';
import Status from '../../../../Component/Status/Status';
import RoomPlannerCalendar from '../../../../Component/Room_Planner_Calender/Room_Planner_Calender';
import { FaEye, FaCheck, FaTimes, FaWifi, FaCar, FaUtensils, FaUmbrellaBeach, FaFire, FaHeart, FaStar, FaTimes as FaTimesCircle, FaTv, FaWind, FaSwimmingPool, FaGamepad, FaWineGlass, FaCoffee, FaShower, FaBed, FaHome, FaBuilding } from 'react-icons/fa';
import '../../../../Component/MainContent/MainContent.css';
import '../../../../Component/ActionDropdown/ActionDropdown.css';
import '../../../../Component/Modal/Modal.css';
import '../../../../Component/Filter/Filter.css';
import './Reservations.css';

const Reservations = () => {
    const [searchKey, setSearchKey] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('All');
    const [appliedFilters, setAppliedFilters] = useState({ status: 'All' });
    const [selectedReservation, setSelectedReservation] = useState(null);
    const [toastMessage, setToastMessage] = useState('');
    const [toastType, setToastType] = useState('');
    const [showToast, setShowToast] = useState(false);
    const [showMessageBox, setShowMessageBox] = useState(false);
    const [messageBoxMode, setMessageBoxMode] = useState(null);
    const [selectedProperty, setSelectedProperty] = useState(null);
    const [selectedOperators, setSelectedOperators] = useState([]);
    const [rejectedReservationID, setRejectedReservationID] = useState(null);
    const [suggestSearchKey, setSuggestSearchKey] = useState('');
    const [priceRange, setPriceRange] = useState({ min: '', max: '' });
    const [selectedUserGroup, setSelectedUserGroup] = useState('All');
    const [selectedCluster, setSelectedCluster] = useState('All');
    const [showTable, setShowTable] = useState(true);
    const [currentUser, setCurrentUser] = useState({
        username: '',
        userid: '',
        userGroup: ''
    });

    const queryClient = useQueryClient();

    useEffect(() => {
        const username = localStorage.getItem('username');
        const userid = localStorage.getItem('userid');
        const userGroup = localStorage.getItem('userGroup');

        setCurrentUser({
            username,
            userid,
            userGroup
        });

        console.log('Current user loaded:', { username, userid, userGroup });
    }, []);

    // Fetch reservations with React Query
    const { data: reservationsData = [], isLoading: reservationsLoading } = useQuery({
        queryKey: ['reservations'],
        queryFn: async () => {
            try {
                const reservationData = await fetchReservation();
                if (Array.isArray(reservationData)) {
                    console.log('Reservations Data:', reservationData);
                    return reservationData.map(reservation => {
                        const reservationblocktime = new Date(reservation.reservationblocktime).getTime();
                        const currentDateTime = Date.now() + 8 * 60 * 60 * 1000;

                        if (reservation.reservationstatus === 'Pending' && currentDateTime > reservationblocktime) {
                            return { ...reservation, reservationstatus: 'expired' };
                        }
                        return reservation;
                    });
                } else {
                    console.error("Invalid data format received:", reservationData);
                    return [];
                }
            } catch (error) {
                console.error('Failed to fetch reservation details:', error);
                throw error;
            }
        },
        staleTime: 30 * 60 * 1000,
        refetchInterval: 1000,
    });
    
    // Fetch operators with React Query
    const { data: operators = [] } = useQuery({
        queryKey: ['operators'],
        queryFn: fetchOperators,
    });

    // Fetch administrator properties when needed
    const { data: administratorProperties = [], refetch: refetchProperties } = useQuery({
        queryKey: [
            'administratorProperties',
            localStorage.getItem('userid'),
            rejectedReservationID?.reservationid
        ],
        queryFn: async () => {
            const userid = localStorage.getItem('userid');
            const reservationid = rejectedReservationID?.reservationid;
        
            if (!userid || !reservationid) {
                console.error('Missing userid or reservationid');
                return [];
            }
        
            try {
                const response = await getOperatorProperties(userid, reservationid);
                return response.data;
            } catch (error) {
                console.error('Failed to fetch administrator properties:', error);
                return [];
            }
        },
        enabled: false, // Prevent automatic fetch
    });
    
    useEffect(() => {
        if (rejectedReservationID?.reservationid) {
            refetchProperties();
        }
    }, [rejectedReservationID, refetchProperties]);

    // Update reservation status mutation
    const updateStatusMutation = useMutation({
        mutationFn: ({ reservationId, newStatus }) =>
            updateReservationStatus(reservationId, newStatus),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['reservations'] });
        },
    });

    // Accept booking mutation
    const acceptBookingMutation = useMutation({
        mutationFn: (reservationId) => acceptBooking(reservationId),
    });

    // Suggest new room mutation
    const suggestRoomMutation = useMutation({
        mutationFn: ({ propertyId, reservationId }) =>
            suggestNewRoom(propertyId, reservationId),
    });

    // Send notification mutation
    const sendNotificationMutation = useMutation({
        mutationFn: ({ reservationId, operators }) =>
            sendSuggestNotification(reservationId, operators),
    });

    const handleApplyFilters = () => {
        setAppliedFilters({ status: selectedStatus });
    };

    const isPropertyOwner = (reservation) => {
        if (!currentUser.userid || !reservation) {
            console.log('Missing data:', { currentUser, reservation });
            return false;
        }

        const propertyOwnerID = reservation.userid;
        
        if (!propertyOwnerID) {
            console.log('Property owner userid missing in reservation:', reservation);
            return false;
        }

        const isOwner = Number(propertyOwnerID) === Number(currentUser.userid);
        
        console.log('Ownership Check:', {
            currentUserID: currentUser.userid,
            propertyOwnerID,
            userGroup: currentUser.userGroup,
            isOwner
        });
        return isOwner;
    };

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
                { value: 'Suggested', label: 'Suggested' },
                { value: 'Published', label: 'Published' },
            ],
        },
    ];

    const displayLabels = {
        reservationid: "Reservation ID",
        propertyaddress: "Property Name",
        checkindatetime: "Check-In Date Time",
        checkoutdatetime: "Check-Out Date Time",
        name: "Customer Name",
        request: "Request",
        totalprice: "Total Price",
        reservationstatus: "Status",
        images: "Images",
    };

    const formatDate = (datetime) => {
      if (!datetime) return '';
      const date = new Date(datetime);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
  };

    const filteredReservations = Array.isArray(reservationsData)
        ? reservationsData.filter(
            (reservation) =>
                (appliedFilters.status === 'All' || (reservation.reservationstatus ?? 'Pending').toLowerCase() === appliedFilters.status.toLowerCase()) &&
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

    const hasOverlappingReservation = (reservation) => {
        if (!Array.isArray(reservationsData)) return false;

        const newCheckIn = new Date(reservation.checkindatetime);
        const newCheckOut = new Date(reservation.checkoutdatetime);

        return reservationsData.some(existingReservation => {
            // Skip the current reservation
            if (existingReservation.reservationid === reservation.reservationid) {
                return false;
            }

            // Only check for overlaps with Accepted reservations
            if (existingReservation.reservationstatus !== 'Accepted') {
                return false;
            }

            const existingCheckIn = new Date(existingReservation.checkindatetime);
            const existingCheckOut = new Date(existingReservation.checkoutdatetime);

            // Check for overlap
            return (newCheckIn < existingCheckOut && newCheckOut > existingCheckIn);
        });
    };

    const handleAction = async (action, reservation) => {
        if (reservation.reservationstatus === 'expired') {
            displayToast('error', 'Action cannot be performed. This reservation has expired.');
            return;
        }

        if (action === 'view') {
            const essentialFields = {
                reservationid: reservation.reservationid || 'N/A',
                propertyaddress: reservation.propertyaddress || 'N/A',
                checkindatetime: formatDate(reservation.checkindatetime) || 'N/A',
                checkoutdatetime: formatDate(reservation.checkoutdatetime) || 'N/A',
                request: reservation.request || 'N/A',
                totalprice: reservation.totalprice || 'N/A',
                name: `${reservation.rcfirstname || ''} ${reservation.rclastname || ''}`.trim() || 'N/A',
                reservationstatus: reservation.reservationstatus || 'N/A',
                images: reservation.propertyimage || [],
        };
            setSelectedReservation(essentialFields);
        } else if (action === 'accept') {
            // Check for overlapping reservations before accepting
            if (hasOverlappingReservation(reservation)) {
                displayToast('error', 'Cannot accept reservation: There is an overlapping accepted reservation for these dates.');
                return;
            }

            try {
                const newStatus = 'Accepted';

                // First update the status
                await updateStatusMutation.mutateAsync({
                    reservationId: reservation.reservationid,
                    newStatus,
                    userid: currentUser.userid
                });

                try {
                    // Then try to accept the booking
                    await acceptBookingMutation.mutateAsync(reservation.reservationid);
                    displayToast('success', 'Reservation Accepted Successfully');
                } catch (bookingError) {
                    console.error('Failed to complete booking acceptance:', bookingError);
                    displayToast('warning', 'Reservation status updated but booking acceptance failed. Please try again.');
                }
            } catch (statusError) {
                console.error('Failed to update reservation status:', statusError);
                displayToast('error', 'Failed to update reservation status');
            }
        } else if (action === 'reject') {
            const rejectedID = {
                reservationid: reservation.reservationid || 'N/A',
            };

            setRejectedReservationID(rejectedID);
            
            setShowMessageBox(true);
        }
    };

    const handleMessageBoxSelect = async (mode) => {
        if (mode === 'suggest') {
            refetchProperties();
        }

        setMessageBoxMode(mode);
        setShowMessageBox(false);
    };

    const handlePropertySelect = (propertyid) => {
        setSelectedProperty(propertyid);
    };

    const handleConfirmSuggestion = async () => {
        if (selectedProperty && rejectedReservationID.reservationid) {
            try {
                const newStatus = 'Suggested';

                await updateStatusMutation.mutateAsync({
                    reservationId: rejectedReservationID.reservationid,
                    newStatus
                });

                await suggestRoomMutation.mutateAsync({
                    propertyId: selectedProperty,
                    reservationId: rejectedReservationID.reservationid
                });

                displayToast('success', 'New Room Suggestion Email Sent Successfully');
                setMessageBoxMode(null);
            } catch (error) {
                displayToast('error', 'Error Sending New Room Suggestion Email');
            }
        } else {
            displayToast('error', 'Please select a property to suggest');
        }
    };

    const handleOperatorSelect = (userid) => {
        setSelectedOperators((prevSelectedOperators) =>
            prevSelectedOperators.includes(userid)
                ? prevSelectedOperators.filter((id) => id !== userid)
                : [...prevSelectedOperators, userid]
        );
    };

    const handleConfirmNotification = async () => {
        if (selectedOperators.length > 0 && rejectedReservationID.reservationid) {
            try {
                const newStatus = 'Published';

                await updateStatusMutation.mutateAsync({
                    reservationId: rejectedReservationID.reservationid,
                    newStatus
                });

                await sendNotificationMutation.mutateAsync({
                    reservationId: rejectedReservationID.reservationid,
                    operators: selectedOperators
                });

                displayToast('success', 'Suggest Notification Sent Successfully');
                setMessageBoxMode(null);
            } catch (error) {
                displayToast('error', 'Error Sending Suggest Notification');
            }
        } else {
            displayToast('error', 'Please select at least one operator to notify');
        }
    };

    const reservationDropdownItems = (reservation) => {
        if (reservation.reservationstatus === 'Pending' && isPropertyOwner(reservation)) {
            return [
                { label: 'View Details', icon: <FaEye />, action: 'view' },
                { label: 'Accept', icon: <FaCheck />, action: 'accept' },
                { label: 'Reject', icon: <FaTimes />, action: 'reject' },
            ];
        }
        return [{ label: 'View Details', icon: <FaEye />, action: 'view' }];
    };

    const displayToast = (type, message) => {
        setToastType(type);
        setToastMessage(message);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 5000);
    };

    const columns = [
        { header: 'RID', accessor: 'reservationid' },
        {
            header: 'Image',
            accessor: 'propertyimage',
            render: (reservation) =>
                reservation.propertyimage && reservation.propertyimage.length > 0 ? (
                    <img
                        src={`data:image/jpeg;base64,${reservation.propertyimage[0]}`}
                        alt={`Property ${reservation.propertyaddress}`}
                        style={{ width: 80, height: 80 }}
                    />
                ) : (
                    <span>No Image</span>
                ),
        },
        {
            header: 'Name',
            accessor: 'name',
            render: (reservation) => (
                `${reservation.rcfirstname.trim()} ${reservation.rclastname.trim()}`
            ),
        },
        { header: 'Property Name', accessor: 'propertyaddress' },
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
                    items={reservationDropdownItems(reservation)}
                    onAction={(action) => handleAction(action, reservation)}
                />
            ),
        },
    ];

    const clearFilters = () => {
        setSuggestSearchKey('');
        setPriceRange({ min: '', max: '' });
        setSelectedUserGroup('All');
        setSelectedCluster('All');
    };

    const filteredProperties = administratorProperties.filter(property => {
        const matchesSearch = !suggestSearchKey || 
            property.propertyaddress.toLowerCase().includes(suggestSearchKey.toLowerCase());
        
        const matchesMinPrice = !priceRange.min || 
            parseFloat(property.normalrate) >= parseFloat(priceRange.min);
        
        const matchesMaxPrice = !priceRange.max || 
            parseFloat(property.normalrate) <= parseFloat(priceRange.max);
        
        return matchesSearch && matchesMinPrice && matchesMaxPrice;
    });

    const renderAmenities = (property) => {
        const facilitiesString = property.facilities || '';
        const facilitiesList = facilitiesString.split(',').map(f => f.trim()).filter(f => f);
        
        // Icon mapping for different facilities
        const amenityIcons = {
            'TV': <FaTv />,
            'Dryer': <FaWind />,
            'Kitchen': <FaUtensils />,
            'WiFi': <FaWifi />,
            'Wifi': <FaWifi />,
            'WIFI': <FaWifi />,
            'Parking': <FaCar />,
            'Car Park': <FaCar />,
            'Swimming Pool': <FaSwimmingPool />,
            'Pool': <FaSwimmingPool />,
            'Beach Access': <FaUmbrellaBeach />,
            'Beach': <FaUmbrellaBeach />,
            'BBQ': <FaFire />,
            'Barbecue': <FaFire />,
            'Gaming': <FaGamepad />,
            'Games': <FaGamepad />,
            'Bar': <FaWineGlass />,
            'Coffee': <FaCoffee />,
            'Bathroom': <FaShower />,
            'Shower': <FaShower />,
            'Bedroom': <FaBed />,
            'Bed': <FaBed />,
        };
        
        const amenities = facilitiesList.map(facility => ({
            icon: amenityIcons[facility] || <FaCheck />,
            label: facility
        }));
        
        return amenities.slice(0, 3); // Show max 3 amenities
    };

    const renderStars = (rating) => {
        const stars = [];
        const numRating = parseFloat(rating); // Default rating if not available
        
        for (let i = 1; i <= 5; i++) {
            stars.push(
                <FaStar 
                    key={i} 
                    className={i <= numRating ? 'star-filled' : 'star-empty'} 
                />
            );
        }
        return stars;
    };


    return (
        <div>
            {showToast && <Toast type={toastType} message={toastMessage} />}
            <div className="header-container">
                <h1 className="dashboard-page-title">Reservations</h1>
                <SearchBar value={searchKey} onChange={(newValue) => setSearchKey(newValue)} placeholder="Search reservations..." />
            </div>

            <Filter filters={filters} onApplyFilters={handleApplyFilters} />

            <div className="room-planner-container">
                <RoomPlannerCalendar />
            </div>

            <div className="table-controls">
                <button
                    className="toggle-table-btn"
                    onClick={() => setShowTable(!showTable)}
                >
                    {showTable ? 'Hide Reservations Table' : 'Show Reservations Table'}
                </button>
            </div>

            {showMessageBox && (
                <div className="custom-message-box-overlay">
                    <div className="custom-message-box">
                        <h2>Choose An Action</h2>
                        <p>Please Select An Action For The Rejection:</p>
                        <button onClick={() => setShowMessageBox(false)} className="form-close-button">×</button>

                        <div class="message-box-buttons">
                            <button onClick={() => handleMessageBoxSelect('suggest')}>Suggest</button>
                            <button onClick={() => handleMessageBoxSelect('notify')}>Notify Suggest</button>
                        </div>
                    </div>
                </div>
            )}

            {showTable && (
                reservationsLoading ? (
                    <div className="loader-box">
                        <Loader />
                    </div>
                ) : (
                    <PaginatedTable
                        data={filteredReservations}
                        columns={columns}
                        rowKey="reservationid"
                        enableCheckbox={false}
                    />
                )
            )}

            <Modal
                isOpen={!!selectedReservation}
                title={'Reservation Details'}
                data={selectedReservation || {}}
                labels={displayLabels}
                onClose={() => setSelectedReservation(null)}
            />

            {messageBoxMode === 'suggest' && (
                <div className="custom-message-box-overlay">
                    <div className="suggest-properties-modal">
                        <div className="suggest-header">
                            <div className="suggest-title-section">
                                <h2>Suggest Alternative Property</h2>
                                <p className="suggest-subtitle">Select a property to suggest as an alternative for the rejected reservation</p>
                            </div>
                            <button className="form-close-button" onClick={() => setMessageBoxMode('')}>
                                <FaTimesCircle />
                            </button>
                        </div>

                        <div className="suggest-filters">
                            <div className="filter-header">
                                <h3>Filter Properties</h3>
                                <button className="clear-filters-btn" onClick={clearFilters}>
                                    <FaTimesCircle /> Clear Filters
                                </button>
                            </div>
                            
                            <div className="filter-row">
                                <div className="search-container">
                                    <label>Search Properties</label>
                                    <input
                                        type="text"
                                        placeholder="Search by name or location..."
                                        value={suggestSearchKey}
                                        onChange={(e) => setSuggestSearchKey(e.target.value)}
                                        className="suggest-search-input"
                                    />
                                </div>
                            </div>
                            
                            <div className="filter-row">
                                <div className="price-filter-group">
                                    <div className="price-input-container">
                                        <label>Min Price (RM)</label>
                                        <input
                                            type="number"
                                            placeholder="0"
                                            value={priceRange.min}
                                            onChange={(e) => setPriceRange(prev => ({ ...prev, min: e.target.value }))}
                                            className="price-input"
                                        />
                                    </div>
                                    <div className="price-input-container">
                                        <label>Max Price (RM)</label>
                                        <input
                                            type="number"
                                            placeholder="1000"
                                            value={priceRange.max}
                                            onChange={(e) => setPriceRange(prev => ({ ...prev, max: e.target.value }))}
                                            className="price-input"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="property-grid">
                            {filteredProperties.length > 0 ? (
                                filteredProperties.map((property) => (
                                    <div 
                                        key={property.propertyid} 
                                        className={`property-card-modern ${selectedProperty === property.propertyid ? 'selected' : ''}`}
                                        onClick={() => handlePropertySelect(property.propertyid)}
                                    >
                                        <div className="property-image-section">
                                            <img
                                                src={`data:image/jpeg;base64,${property.images[0]}`}
                                                alt={property.propertyaddress}
                                                className="property-image-modern"
                                            />
                                            {/* <div className="property-type-badge">
                                                {property.propertyguestpaxno > 4 ? 'House' : 'Apartment'}
                                            </div> */}
                                        </div>
                                        
                                        <div className="property-content">
                                            <div className="property-header">
                                                <h4 className="property-name-modern">{property.propertyaddress}</h4>
                                                <div className="property-location">
                                                    📍 {property.propertyaddress}
                                                </div>
                                            </div>
                                            
                                            <div className="property-stats">
                                                <div className="guest-capacity">
                                                    👥 {property.propertyguestpaxno}
                                                </div>
                                                <div className="property-rating">
                                                    {renderStars(property.rating)}
                                                    <span className="rating-number">{property.rating}</span>
                                                </div>
                                            </div>
                                            
                                            <div className="property-price-section">
                                                <span className="price-amount">RM {property.normalrate}</span>
                                                <span className="price-period">per night</span>
                                            </div>
                                            
                                            <div className="property-amenities">
                                                {renderAmenities(property).map((amenity, index) => (
                                                    <div key={index} className="amenity-item">
                                                        {amenity.icon}
                                                        <span>{amenity.label}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        
                                        <input
                                            type="radio"
                                            name="property"
                                            value={property.propertyid}
                                            checked={selectedProperty === property.propertyid}
                                            onChange={() => handlePropertySelect(property.propertyid)}
                                            className="property-radio-hidden"
                                        />
                                    </div>
                                ))
                            ) : (
                                <div className="no-properties-message">
                                    <p>No properties match your search criteria</p>
                                </div>
                            )}
                            
                            <button className="confirm-suggestion-btn" onClick={handleConfirmSuggestion}>
                                Confirm Suggestion
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {messageBoxMode === 'notify' && (
                <div className="custom-message-box-overlay">
                    <div className="operators-selection-modal">
                        <div className="operators-modal-header">
                            <div className="operators-title-section">
                                <h2>Select Operators to Notify</h2>
                                <p className="operators-subtitle">Choose operators to notify about the rejected reservation</p>
                            </div>
                            <button className="form-close-button" onClick={() => setMessageBoxMode('')}>
                                <FaTimesCircle />
                            </button>
                        </div>

                        <div className="operators-selection-stats">
                            <div className="selection-count">
                                👥 {selectedOperators.length} selected
                            </div>
                            <div className="total-count">
                                📊 {(() => {
                                    const filteredOperators = operators.filter(operator => {
                                        const searchTerm = suggestSearchKey.toLowerCase();
                                        const matchesSearch = !searchTerm || 
                                            operator.ufirstname?.toLowerCase().includes(searchTerm) ||
                                            operator.ulastname?.toLowerCase().includes(searchTerm) ||
                                            operator.username?.toLowerCase().includes(searchTerm) ||
                                            operator.uemail?.toLowerCase().includes(searchTerm);
                                        
                                        const matchesUserGroup = selectedUserGroup === 'All' || 
                                            operator.usergroup === selectedUserGroup;
                                        
                                        const matchesCluster = selectedCluster === 'All' || 
                                            operator.clustername === selectedCluster;
                                        
                                        return matchesSearch && matchesUserGroup && matchesCluster;
                                    });
                                    return filteredOperators.length;
                                })()} of {operators.length} shown
                            </div>
                        </div>

                        <div className="operators-search-section">
                            <div className="operators-search-container">
                                <input
                                    type="text"
                                    placeholder="Search operators by name, username, or email..."
                                    value={suggestSearchKey}
                                    onChange={(e) => setSuggestSearchKey(e.target.value)}
                                    className="operators-search-input"
                                />
                            </div>
                        </div>

                        <div className="operators-filters-section">
                            <div className="operators-filter-row">
                                <select 
                                    className="operators-filter-select"
                                    value={selectedUserGroup}
                                    onChange={(e) => setSelectedUserGroup(e.target.value)}
                                >
                                    <option value="All">All Roles</option>
                                    <option value="Administrator">Administrator</option>
                                    <option value="Moderator">Moderator</option>
                                </select>
                                <select 
                                    className="operators-filter-select"
                                    value={selectedCluster}
                                    onChange={(e) => setSelectedCluster(e.target.value)}
                                >
                                    <option value="All">All Clusters</option>
                                    {[...new Set(operators.map(op => op.clustername).filter(Boolean))].map(clusterName => (
                                        <option key={clusterName} value={clusterName}>{clusterName}</option>
                                    ))}
                                </select>
                                <button className="clear-filters-btn" onClick={clearFilters}>
                                    🔄 Clear Filters
                                </button>
                            </div>
                        </div>

                        <div className="operators-select-all-section">
                            <label className="operators-select-all-checkbox">
                                <input
                                    type="checkbox"
                                    checked={(() => {
                                        const filteredOperators = operators.filter(operator => {
                                            const searchTerm = suggestSearchKey.toLowerCase();
                                            const matchesSearch = !searchTerm || 
                                                operator.ufirstname?.toLowerCase().includes(searchTerm) ||
                                                operator.ulastname?.toLowerCase().includes(searchTerm) ||
                                                operator.username?.toLowerCase().includes(searchTerm) ||
                                                operator.uemail?.toLowerCase().includes(searchTerm);
                                            
                                            const matchesUserGroup = selectedUserGroup === 'All' || 
                                                operator.usergroup === selectedUserGroup;
                                            
                                            const matchesCluster = selectedCluster === 'All' || 
                                                operator.clustername === selectedCluster;
                                            
                                            return matchesSearch && matchesUserGroup && matchesCluster;
                                        });
                                        return filteredOperators.length > 0 && 
                                               filteredOperators.every(op => selectedOperators.includes(op.userid));
                                    })()}
                                    onChange={(e) => {
                                        const checked = e.target.checked;
                                        const filteredOperators = operators.filter(operator => {
                                            const searchTerm = suggestSearchKey.toLowerCase();
                                            const matchesSearch = !searchTerm || 
                                                operator.ufirstname?.toLowerCase().includes(searchTerm) ||
                                                operator.ulastname?.toLowerCase().includes(searchTerm) ||
                                                operator.username?.toLowerCase().includes(searchTerm) ||
                                                operator.uemail?.toLowerCase().includes(searchTerm);
                                            
                                            const matchesUserGroup = selectedUserGroup === 'All' || 
                                                operator.usergroup === selectedUserGroup;
                                            
                                            const matchesCluster = selectedCluster === 'All' || 
                                                operator.clustername === selectedCluster;
                                            
                                            return matchesSearch && matchesUserGroup && matchesCluster;
                                        });
                                        
                                        if (checked) {
                                            // Add all filtered operators to selection
                                            const newSelections = [...new Set([...selectedOperators, ...filteredOperators.map(op => op.userid)])];
                                            setSelectedOperators(newSelections);
                                        } else {
                                            // Remove all filtered operators from selection
                                            const filteredIds = filteredOperators.map(op => op.userid);
                                            setSelectedOperators(selectedOperators.filter(id => !filteredIds.includes(id)));
                                        }
                                    }}
                                />
                                <span className="checkmark"></span>
                                Select all filtered operators ({(() => {
                                    const filteredOperators = operators.filter(operator => {
                                        const searchTerm = suggestSearchKey.toLowerCase();
                                        const matchesSearch = !searchTerm || 
                                            operator.ufirstname?.toLowerCase().includes(searchTerm) ||
                                            operator.ulastname?.toLowerCase().includes(searchTerm) ||
                                            operator.username?.toLowerCase().includes(searchTerm) ||
                                            operator.uemail?.toLowerCase().includes(searchTerm);
                                        
                                        const matchesUserGroup = selectedUserGroup === 'All' || 
                                            operator.usergroup === selectedUserGroup;
                                        
                                        const matchesCluster = selectedCluster === 'All' || 
                                            operator.clustername === selectedCluster;
                                        
                                        return matchesSearch && matchesUserGroup && matchesCluster;
                                    });
                                    return filteredOperators.length;
                                })()})
                            </label>
                        </div>

                        <div className="operators-list-container">
                            {operators.length > 0 ? (
                                <div className="operators-grid">
                                    {operators
                                        .filter(operator => {
                                            const searchTerm = suggestSearchKey.toLowerCase();
                                            const matchesSearch = !searchTerm || 
                                                operator.ufirstname?.toLowerCase().includes(searchTerm) ||
                                                operator.ulastname?.toLowerCase().includes(searchTerm) ||
                                                operator.username?.toLowerCase().includes(searchTerm) ||
                                                operator.uemail?.toLowerCase().includes(searchTerm);
                                            
                                            const matchesUserGroup = selectedUserGroup === 'All' || 
                                                operator.usergroup === selectedUserGroup;
                                            
                                            const matchesCluster = selectedCluster === 'All' || 
                                                operator.clustername === selectedCluster;
                                            
                                            return matchesSearch && matchesUserGroup && matchesCluster;
                                        })
                                        .map((operator) => (
                                            <div 
                                                key={operator.userid} 
                                                className={`operator-card ${selectedOperators.includes(operator.userid) ? 'selected' : ''}`}
                                                onClick={() => handleOperatorSelect(operator.userid)}
                                            >
                                                <div className="operator-checkbox-container">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedOperators.includes(operator.userid)}
                                                        onChange={() => handleOperatorSelect(operator.userid)}
                                                        className="operator-checkbox"
                                                    />
                                                </div>
                                                
                                                <div className="operator-avatar">
                                                    {operator.uimage ? (
                                                        <img 
                                                            src={`data:image/jpeg;base64,${operator.uimage}`} 
                                                            alt={`${operator.ufirstname} ${operator.ulastname}`}
                                                            className="operator-avatar-img"
                                                        />
                                                    ) : (
                                                        <div className="operator-avatar-placeholder">
                                                            {(operator.ufirstname?.[0] || '') + (operator.ulastname?.[0] || '')}
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                <div className="operator-info">
                                                    <div className="operator-name">
                                                        {operator.ufirstname} {operator.ulastname}
                                                    </div>
                                                    <div className="operator-username">
                                                        {operator.username}
                                                    </div>
                                                    <div className="operator-details">
                                                        <span className="operator-email">
                                                            ✉️ {operator.uemail}
                                                        </span>
                                                        <span className="operator-location">
                                                            📍 {operator.clustername || 'No Cluster'}
                                                        </span>
                                                    </div>
                                                </div>
                                                
                                                <div className="operator-role-badge">
                                                    {operator.usergroup}
                                                </div>
                                            </div>
                                        ))
                                    }
                                </div>
                            ) : (
                                <div className="no-operators-message">
                                    <p>No operators available to notify</p>
                                </div>
                            )}
                        </div>

                        <div className="operators-modal-footer">
                            <div className="operators-selection-summary">
                                {selectedOperators.length} operators selected
                            </div>
                            <div className="operators-action-buttons">
                                <button 
                                    className="operators-notify-btn" 
                                    onClick={handleConfirmNotification}
                                    disabled={selectedOperators.length === 0}
                                >
                                    Notify Selected Operators
                                </button>
                                <button 
                                    className="operators-cancel-btn" 
                                    onClick={() => setMessageBoxMode('')}
                                >
                                    Cancel
                                </button>
                                
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Reservations;


