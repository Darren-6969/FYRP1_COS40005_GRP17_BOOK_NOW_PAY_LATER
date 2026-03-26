import React, { useState, useEffect } from 'react';
import './Dashboard.css';
import '../../../../Component/MainContent/MainContent.css';
import DashboardCard from '../../../../Component/DashboardCard/DashboardCard';
import PaginatedTable from '../../../../Component/PaginatedTable/PaginatedTable';
import ActionDropdown from '../../../../Component/ActionDropdown/ActionDropdown';
import Status from '../../../../Component/Status/Status';
import UserActivityCell from '../../../../Component/UserActivityCell/UserActivityCell';
import Modal from '../../../../Component/Modal/Modal';
import Toast from '../../../../Component/Toast/Toast';
import { FaBell, FaEye, FaCheck, FaTimes, FaTimesCircle, FaTv, FaWind, FaSwimmingPool, FaGamepad, FaWineGlass, FaCoffee, FaShower, FaBed, FaStar } from 'react-icons/fa';
import { publishedReservations, updateReservationStatus, getOperatorProperties, fetchOperators, sendSuggestNotification, suggestNewRoom } from '../../../../../Api/api';
import { useMutation } from '@tanstack/react-query';

const Dashboard = () => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [pickupData, setPickupData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [messageBoxMode, setMessageBoxMode] = useState(null);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [suggestSearchKey, setSuggestSearchKey] = useState('');
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });
  const [administratorProperties, setAdministratorProperties] = useState([]);
  const [operators, setOperators] = useState([]);
  const [selectedOperators, setSelectedOperators] = useState([]);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [rejectedReservationID, setRejectedReservationID] = useState(null);

  const displayLabels = {
    propertyaddress: "Property Name",
    checkindate: "Check-in date",
    checkoutdate: "Check-out date",
    status: "Status",
    propertyid: "Property ID",
    totalprice: "Total Price",
    request: "Request"
  };

  const getCurrentUserId = () => {
    return localStorage.getItem('userid'); 
  };

  const fetchPickupData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const userId = getCurrentUserId();
      if (!userId) {
        throw new Error('User ID not found');
      }

      const data = await publishedReservations(userId);
      
      // Transform the API response to match your component's expected format
      const transformedData = data.map((reservation) => ({
        id: reservation.reservationid,
        propertyname: reservation.propertyaddress,
        checkindate: formatDate(reservation.checkindatetime),
        checkoutdate: formatDate(reservation.checkoutdatetime),
        status: reservation.reservationstatus,
        propertyid: reservation.propertyid,
        totalprice: reservation.totalprice,
        request: reservation.request
      }));

      setPickupData(transformedData);
    } catch (err) {
      console.error('Error fetching pickup data:', err);
      setError(err.message || 'Failed to fetch pickup data');
      setPickupData([]);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    
    try {
      const date = new Date(dateString);
      return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD format
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid Date';
    }
  };

  const toggleNotifications = () => {
    setShowNotifications(!showNotifications);
    
    // Optionally refresh data when notifications are opened
    if (!showNotifications) {
      fetchPickupData();
    }
  };

  const closeNotifications = () => {
    setShowNotifications(false);
  };

  const updateStatusMutation = useMutation({
    mutationFn: ({ reservationId, newStatus }) =>
      updateReservationStatus(reservationId, newStatus),
  });

  const suggestRoomMutation = useMutation({
    mutationFn: ({ propertyId, reservationId }) =>
      suggestNewRoom(propertyId, reservationId),
  });

  const sendNotificationMutation = useMutation({
    mutationFn: ({ reservationId, operators }) =>
      sendSuggestNotification(reservationId, operators),
  });

  const handleAction = (action, pickup) => {
    if (action === 'view') {
      const essentialFields = {
        propertyname: pickup.propertyname || 'N/A',
        checkindate: pickup.checkindate || 'N/A',
        checkoutdate: pickup.checkoutdate || 'N/A',
        status: pickup.status || 'N/A',
        propertyid: pickup.propertyid || 'N/A',
        totalprice: pickup.totalprice || 'N/A',
        request: pickup.request || 'N/A',

      };
      setSelectedReservation(essentialFields);
      setMessageBoxMode(null);
    } else if (action === 'pick') {
      setMessageBoxMode('suggest');
      setSelectedReservation(null);
      const rejectedID = {
        reservationid: pickup.id || 'N/A',
      };
      setRejectedReservationID(rejectedID);
      fetchAdministratorProperties(pickup.id);
    }
  };

  const fetchAdministratorProperties = async (reservationId) => {
    try {
      const userId = getCurrentUserId();
      if (!userId || !reservationId) {
        console.error('Missing userid or reservationid');
        return;
      }

      const response = await getOperatorProperties(userId, reservationId);
      setAdministratorProperties(response.data || []);
    } catch (error) {
      console.error('Failed to fetch administrator properties:', error);
      setAdministratorProperties([]);
    }
  };

  const handlePropertySelect = (propertyId) => {
    setSelectedProperty(propertyId);
  };

  const clearFilters = () => {
    setSuggestSearchKey('');
    setPriceRange({ min: '', max: '' });
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
        setSelectedProperty(null);
        fetchPickupData();
      } catch (error) {
        displayToast('error', 'Error Sending New Room Suggestion Email');
      }
    } else {
      displayToast('error', 'Please select a property to suggest');
    }
  };

  const filteredProperties = administratorProperties.filter(property => {
    const matchesSearch = !suggestSearchKey || 
      property.propertyname.toLowerCase().includes(suggestSearchKey.toLowerCase());
    
    const matchesMinPrice = !priceRange.min || 
      parseFloat(property.normalrate) >= parseFloat(priceRange.min);
    
    const matchesMaxPrice = !priceRange.max || 
      parseFloat(property.normalrate) <= parseFloat(priceRange.max);
    
    return matchesSearch && matchesMinPrice && matchesMaxPrice;
  });

  const renderStars = (rating) => {
    const stars = [];
    const numRating = parseFloat(rating) || 0;
    
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

  const renderAmenities = (property) => {
    const facilitiesString = property.facilities || '';
    const facilitiesList = facilitiesString.split(',').map(f => f.trim()).filter(f => f);
    
    const amenityIcons = {
      'TV': <FaTv />,
      'Dryer': <FaWind />,
      'Swimming Pool': <FaSwimmingPool />,
      'Pool': <FaSwimmingPool />,
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
    
    return amenities.slice(0, 3);
  };

  // Refresh data function (can be called from UI)
  const handleRefresh = () => {
    fetchPickupData();
  };

  const pickupDropdownItems = [
    { label: 'View Details', icon: <FaEye />, action: 'view' },
    { label: 'Pick Up', icon: <FaCheck />, action: 'pick' },
  ];

  const columns = [
    {
      header: 'Property',
      accessor: 'propertyname',
      render: (pickup) => (
        <span className="date-cell">{pickup.propertyname}</span>
      ),
    },
    { 
      header: 'Check in date', 
      accessor: 'checkindate',
      render: (pickup) => (
        <span className="date-cell">{pickup.checkindate}</span>
      )
    },
    { 
      header: 'Check out date', 
      accessor: 'checkoutdate',
      render: (pickup) => (
        <span className="date-cell">{pickup.checkoutdate}</span>
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (pickup) => (
        <Status value={pickup.status} />
      ),
    },
    {
      header: 'Actions',
      accessor: 'actions',
      render: (pickup) => (
        <ActionDropdown
          items={pickupDropdownItems}
          onAction={(action) => handleAction(action, pickup)}
          onClose={() => {}}
        />
      ),
    },
  ];

  useEffect(() => {
    const fetchOperatorsData = async () => {
      try {
        const operatorsData = await fetchOperators();
        setOperators(operatorsData);
      } catch (error) {
        console.error('Failed to fetch operators:', error);
      }
    };
    fetchOperatorsData();
  }, []);

  const displayToast = (type, message) => {
    setToastType(type);
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 5000);
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
        setSelectedOperators([]);
        fetchPickupData();
      } catch (error) {
        displayToast('error', 'Error Sending Suggest Notification');
      }
    } else {
      displayToast('error', 'Please select at least one operator to notify');
    }
  };

  useEffect(() => {
    fetchPickupData(); 
  }, []);

  useEffect(() => {
    if (showNotifications) {
      fetchPickupData();
    }
  }, [showNotifications]);

  return (
    <div>
      {showToast && (
        <Toast type={toastType} message={toastMessage} />
      )}

      <div className="header-container">
        <h1 className="dashboard-page-title">Dashboard</h1>
        <div className="notification-container">
          <div className="notification-badge">
            <FaBell 
              className='notification_icon'
              onClick={toggleNotifications}
            />
            {!loading && (
              <span className="badge-count">{pickupData.length}</span>
            )}
          </div>
          
          {showNotifications && (
            <div className="notification-overlay">
              <div className="notification-content">
                <div className="notification-header">
                  <h3>
                    Pickup Requests 
                    {loading ? ' (Loading...)' : ` (${Array.isArray(pickupData) ? pickupData.length : 0})`}
                  </h3>
                  <div className="notification-actions">
                    <div className="form-close-button" onClick={closeNotifications}>×</div>
                  </div>
                </div>
                
                <div className="pickup-table-container">
                  {loading ? (
                    <div className="loading-state">
                      <p>Loading pickup requests...</p>
                    </div>
                  ) : error ? (
                    <div className="error-state">
                      <p className="error-message">Error: {error}</p>
                      <button 
                        className="retry-button" 
                        onClick={handleRefresh}
                      >
                        Try Again
                      </button>
                    </div>
                  ) : pickupData.length === 0 ? (
                    <div className="empty-state">
                      <p>No pickup requests found.</p>
                    </div>
                  ) : (
                    <PaginatedTable
                      data={pickupData}
                      columns={columns}
                      rowKey="id"
                      enableCheckbox={false}
                      itemsPerPage={5}
                    />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {showNotifications && (
        <div 
          className="overlay-backdrop"
          onClick={closeNotifications}
        ></div>
      )}
      
      <DashboardCard />

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
                        alt={property.propertyname}
                        className="property-image-modern"
                      />
                    </div>
                    
                    <div className="property-content">
                      <div className="property-header">
                        <h4 className="property-name-modern">{property.propertyaddress || ''}</h4>
                        <div className="property-location">
                           {property.propertyaddress}
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
          <div className="suggest-properties custom-message-box">
            <div className="form-close-button" onClick={() => setMessageBoxMode('')}>×</div>
            <h2>Select Operators To Notify</h2>
            <div className="operator-list">
              <div className="select-all-checkbox">
                <input
                  type="checkbox"
                  id="select-all-operators"
                  checked={selectedOperators.length === operators.length && operators.length > 0}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setSelectedOperators(checked ? operators.map(operator => operator.userid) : []);
                  }}
                />
                <label htmlFor="select-all-operators">Select All</label>
              </div>

              {operators.length > 0 ? (
                operators.map((operator) => (
                  <div key={operator.userid} className="operator-option">
                    <input
                      type="checkbox"
                      id={`operator-${operator.userid}`}
                      value={operator.userid}
                      checked={selectedOperators.includes(operator.userid)}
                      onChange={() => handleOperatorSelect(operator.userid)}
                    />
                    <label htmlFor={`operator-${operator.userid}`}>
                      {operator.ufirstname} {operator.ulastname} ({operator.username}) - {operator.usergroup}
                    </label>
                  </div>
                ))
              ) : (
                <p>No operator available to notify</p>
              )}
            </div>
            <button onClick={handleConfirmNotification}>Confirm Selection</button>
          </div>
        </div>
      )}

      <Modal
        isOpen={!!selectedReservation}
        title={'Reservation Details'}
        data={selectedReservation || {}}
        labels={displayLabels}
        onClose={() => setSelectedReservation(null)}
      />
    </div>
  );
};

export default Dashboard;
