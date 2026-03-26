import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Import Components
import Navbar from '../../../Component/Navbar/navbar';
import Footer from '../../../Component/Footer/footer';
import Back_To_Top_Button from '../../../Component/Back_To_Top_Button/Back_To_Top_Button';
import Toast from '../../../Component/Toast/Toast';
import ImageSlider from '../../../Component/ImageSlider/ImageSlider';
import TawkMessenger from '../../../Component/TawkMessenger/TawkMessenger';
import { AuthProvider } from '../../../Component/AuthContext/AuthContext';
import Sorting from '../../../Component/Sorting/Sorting';

// Import API
import { fetchProduct } from '../../../../Api/api';

// Import React Icons and CSS
import { FaStar, FaSearch } from 'react-icons/fa';
import { HiUsers} from "react-icons/hi2";
import { CiCalendarDate } from "react-icons/ci";
import { IoLocationSharp } from "react-icons/io5";
import './product.css';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

const Product = () => {
  const location = useLocation();
  const passedRegion = location.state?.filterRegion || '';

  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastType, setToastType] = useState('');
  const [selectedCluster, setSelectedCluster] = useState(passedRegion);
  const [bookingData, setBookingData] = useState({
    checkIn: "",
    checkOut: "",
    adults: 1,
    children: 0,
  });
  
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 480);
  const [activeTab, setActiveTab] = useState(null);
  const [allProperties, setAllProperties] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [priceRange, setPriceRange] = useState({ min: 0, max: 1000 });
  const [sortOrder, setSortOrder] = useState("none"); 
  const [selectedFacilities, setSelectedFacilities] = useState([]);
  const [selectedPropertyTypes, setSelectedPropertyTypes] = useState([]);
  const [selectedBookingOptions, setSelectedBookingOptions] = useState([]);
  const [isDateOverlapping, setIsDateOverlapping] = useState({});

  // ==========================================
  // PAGINATION STATE
  // ==========================================
  const [page, setPage] = useState(1);
  const itemsPerPage = 8;
  const listHeaderRef = useRef(null); 

  const clusters = [
    "Kuching", "Miri", "Sibu", "Bintulu", "Limbang", "Sarikei", "Sri Aman",
    "Kapit", "Mukah", "Betong", "Samarahan", "Serian", "Lundu", "Lawas",
    "Marudi", "Simunjan", "Tatau", "Belaga", "Debak", "Kabong", "Pusa",
    "Sebuyau", "Saratok", "Selangau", "Tebedu",
  ];
  
  const navigate = useNavigate();

  // Use React Query to fetch properties
  const { data: fetchedProperties, isLoading, error } = useQuery({
    queryKey: ['properties'],
    queryFn: fetchProduct,
  });

  // Set all properties when data is fetched
  useEffect(() => {
    if (fetchedProperties) {
      // CRASH FIX: Ensure fetched data is always an array
      const propertiesArray = Array.isArray(fetchedProperties) 
          ? fetchedProperties 
          : (fetchedProperties.data || fetchedProperties.properties || []);
          
      // ENHANCEMENT: Only show properties that have been approved by Admin
      const availableOnly = propertiesArray.filter(
          (prop) => prop.propertystatus === 'Available'
      );

      setAllProperties(availableOnly);
      setPage(1);
    }
  }, [fetchedProperties]);

  // Show error toast if fetching fails
  useEffect(() => {
    if (error) {
      displayToast('error', 'Failed to load properties');
    }
  }, [error]);

  // Handle passed region from map
  useEffect(() => {
    if (location.state?.filterRegion) {
      setSelectedCluster(location.state.filterRegion);
    }
  }, [location.state]);

  // Automatically trigger search if landing from the interactive map
  useEffect(() => {
    if (fetchedProperties && location.state?.filterRegion) {
      handleCheckAvailability(null, location.state.filterRegion); 
    }
  }, [fetchedProperties, location.state]);

  // Create refs for search segments
  const locationRef = useRef(null);
  const checkinRef = useRef(null);
  const checkoutRef = useRef(null);
  const guestsRef = useRef(null);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 480);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (activeTab && 
          !locationRef.current?.contains(event.target) && 
          !checkinRef.current?.contains(event.target) && 
          !checkoutRef.current?.contains(event.target) && 
          !guestsRef.current?.contains(event.target) &&
          !event.target.closest('.expanded-panel')) {
        setActiveTab(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeTab]);
  
  const displayToast = (type, message) => {
    setToastType(type);
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 5000);
  };

  const handleViewDetails = (property) => {
    navigate(`/product/${property.propertyid}`, { 
      state: { propertyDetails: property }
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setBookingData((prev) => {
      const updatedData = { ...prev, [name]: value };
      if (
        (name === "checkIn" && new Date(value) >= new Date(prev.checkOut)) ||
        (name === "checkOut" && new Date(prev.checkIn) >= new Date(value))
      ) {
        updatedData.checkOut = "";
      }
      return updatedData;
    });
  };

  // ENHANCEMENT: Accepts an overrideCluster to trigger search instantly
  const handleCheckAvailability = async (e, overrideCluster = undefined) => {
    if (e) e.stopPropagation();
  
    const checkIn = new Date(bookingData.checkIn);
    const checkOut = new Date(bookingData.checkOut);
    const totalGuests = bookingData.adults + bookingData.children;
    
    // Uses the override cluster if provided, otherwise uses the state
    const targetCluster = overrideCluster !== undefined ? overrideCluster : selectedCluster;
  
    try {
      const fetchedProps = fetchedProperties || await queryClient.fetchQuery({
        queryKey: ['properties'],
        queryFn: fetchProduct
      });

      // CRASH FIX: Ensure fetched data is an array
      const safePropsArray = Array.isArray(fetchedProps) 
            ? fetchedProps 
            : (fetchedProps.data || fetchedProps.properties || []);
  
      let availableProperties = safePropsArray.filter((property) => {
        // ENHANCEMENT: Hide non-available properties from search results
        if (property.propertystatus !== 'Available') return false;

        const existingCheckin = new Date(property.checkindatetime);
        const existingCheckout = new Date(property.checkoutdatetime);
        const propertyPrice = parseFloat(property.normalrate);

        if (propertyPrice < priceRange.min || propertyPrice > priceRange.max) return false;
        if (property.propertyguestpaxno < totalGuests) return false;
        
        const hasOverlap = checkIn < existingCheckout && checkOut > existingCheckin;
        setIsDateOverlapping(prev => ({
          ...prev,
          [property.propertyid]: hasOverlap
        }));
        
        // Checks against targetCluster instead of selectedCluster
        if (targetCluster && property.clustername !== targetCluster) return false;
        
        if (selectedPropertyTypes.length > 0 && !selectedPropertyTypes.includes(property.categoryname)) {
          return false;
        }
        
        if (selectedFacilities.length > 0) {
          const propertyFacilities = property.facilities ? 
            property.facilities.split(',').map(facility => facility.trim()) : [];
          for (const facility of selectedFacilities) {
            if (!propertyFacilities.includes(facility)) {
              return false;
            }
          }
        }
        return true; 
      });
      
      if (sortOrder === "asc") {
        availableProperties.sort((a, b) => parseFloat(a.normalrate) - parseFloat(b.normalrate));
      } else if (sortOrder === "desc") {
        availableProperties.sort((a, b) => parseFloat(b.normalrate) - parseFloat(a.normalrate));
      }
  
      if (availableProperties.length === 0) {
        displayToast('error', 'No available properties match your criteria');
      } else {
        displayToast('success', `Found ${availableProperties.length} available properties`);
      }
  
      setAllProperties(availableProperties);
      setPage(1); 
      setShowFilters(false);
      
    } catch (error) {
      console.error('Error filtering properties:', error);
      displayToast('error', 'Failed to filter properties');
    }
  };  
  
  const handleTabClick = (tab) => {
    setActiveTab(activeTab === tab ? null : tab);
  };

  const getPanelStyle = () => {
    if (!activeTab) return {};
    let ref;
    switch (activeTab) {
      case 'location': ref = locationRef.current; break;
      case 'checkin': ref = checkinRef.current; break;
      case 'checkout': ref = checkoutRef.current; break;
      case 'guests': ref = guestsRef.current; break;
      default: return {};
    }
    if (!ref) return {};
    const rect = ref.getBoundingClientRect();
    if (activeTab === 'guests') return { right: '8px', left: 'auto' };
    return { 
      left: `${ref.offsetLeft}px`,
      width: isMobile ? '90%' : `${Math.max(280, rect.width)}px`
    };
  };

  const renderSearchSection = () => {
    return (
      <section className="home" id="home">
        <div className="container_for_product">
          <div className="search-bar">
            <div 
              ref={locationRef}
              className={`search-segment ${activeTab === 'location' ? 'active' : ''}`}
              onClick={() => handleTabClick('location')}
            >
              <IoLocationSharp className='search_bar_icon'/>
              <div className="search-content">
                <span className="search-label">Where</span>
                <span className="search-value">
                  {selectedCluster || 'Search destinations'}
                </span>
              </div>
            </div>
            
            <div className="search-divider"></div>
            
            <div 
              ref={checkinRef}
              className={`search-segment ${activeTab === 'checkin' ? 'active' : ''}`}
              onClick={() => handleTabClick('checkin')}
            >
              <CiCalendarDate className='search_bar_icon'/>
              <div className="search-content">
                <span className="search-label">Check in</span>
                <span className="search-value">
                  {bookingData.checkIn || 'Add dates'}
                </span>
              </div>
            </div>
            
            <div className="search-divider"></div>
            
            <div 
              ref={checkoutRef}
              className={`search-segment ${activeTab === 'checkout' ? 'active' : ''}`}
              onClick={() => handleTabClick('checkout')}
            >
              <CiCalendarDate className='search_bar_icon'/>
              <div className="search-content">
                <span className="search-label">Check out</span>
                <span className="search-value">
                  {bookingData.checkOut || 'Add dates'}
                </span>
              </div>
            </div>
            
            <div className="search-divider"></div>
            
            <div 
              ref={guestsRef}
              className={`search-segment ${activeTab === 'guests' ? 'active' : ''}`}
              onClick={() => handleTabClick('guests')}
            >
              <HiUsers className='search_bar_icon'/>
              <div className="search-content">
                <span className="search-label">Who</span>
                <span className="search-value">
                  {bookingData.adults + bookingData.children > 0 
                    ? `${bookingData.adults} adults, ${bookingData.children} children` 
                    : 'Add guests'}
                </span>
              </div>
              <button 
                className="search-button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCheckAvailability(e);
                }}
              >
                <FaSearch className='Check_icon'/>
              </button>
            </div>
          </div>
          
          {activeTab && (
            <div 
              className={`expanded-panel ${activeTab}-panel`}
              style={getPanelStyle()}
            >
              {activeTab === 'location' && (
                <div>
                  <h3>Popular destinations</h3>
                  <ClusterSelector 
                    selectedCluster={selectedCluster}
                    setSelectedCluster={setSelectedCluster}
                    clusters={clusters}
                    closeTab={() => setActiveTab(null)}
                    triggerSearch={(clusterName) => handleCheckAvailability(null, clusterName)}
                  />
                </div>
              )}
              {activeTab === 'checkin' && (
                <div>
                  <h3>Select check-in date</h3>
                  <input 
                    id="check-in"
                    type="date"
                    name="checkIn"
                    value={bookingData.checkIn}
                    onChange={handleInputChange}
                    min={new Date().toISOString().split("T")[0]}
                    className="date-input"
                  />
                </div>
              )}
              
              {activeTab === 'checkout' && (
                <div>
                  <h3>Select check-out date</h3>
                  <input 
                    id="check-out"
                    type="date"
                    name="checkOut"
                    value={bookingData.checkOut}
                    onChange={handleInputChange}
                    min={bookingData.checkIn ? new Date(new Date(bookingData.checkIn).setDate(new Date(bookingData.checkIn).getDate() + 1)).toISOString().split("T")[0] : ""}
                    disabled={!bookingData.checkIn} 
                    className="date-input"
                  />
                </div>
              )}
              
              {activeTab === 'guests' && (
                <div>
                  <h3>Who's coming?</h3>
                  <div className="guest-row">
                    <div className="guest-info">
                      <p className="title">Adults</p>
                      <p className="subtitle">Ages 13+</p>
                    </div>
                    <div className="counter-controls">
                      <button 
                        className="counter-button"
                        onClick={() => setBookingData({...bookingData, adults: Math.max(1, bookingData.adults - 1)})}
                      >
                        -
                      </button>
                      <span className="counter-value">{bookingData.adults}</span>
                      <button 
                        className="counter-button"
                        onClick={() => setBookingData({...bookingData, adults: bookingData.adults + 1})}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="guest-row">
                    <div className="guest-info">
                      <p className="title">Children</p>
                      <p className="subtitle">Ages 2-12</p>
                    </div>
                    <div className="counter-controls">
                      <button 
                        className="counter-button"
                        onClick={() => setBookingData({...bookingData, children: Math.max(0, bookingData.children - 1)})}
                      >
                        -
                      </button>
                      <span className="counter-value">{bookingData.children}</span>
                      <button 
                        className="counter-button"
                        onClick={() => setBookingData({...bookingData, children: bookingData.children + 1})}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    );
  };

  const ClusterSelector = ({ selectedCluster, setSelectedCluster, clusters, closeTab, triggerSearch }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
      <div className="cluster-selector">
        <div 
          className="cluster-selector-header"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="cluster-label">
            {selectedCluster || "Select Your Destination"}
          </span>
          <i className="cluster-icon">
            {isOpen ? "↑" : "↓"}
          </i>
        </div>
        {isOpen && (
          <div className="cluster-options">
            
            <div
              className={`cluster-option ${!selectedCluster ? 'selected' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedCluster(''); 
                setIsOpen(false);
                if (closeTab) closeTab();
                if (triggerSearch) triggerSearch(''); 
              }}
            >
              <span className="cluster-name">All Destinations</span>
              {!selectedCluster && <span className="check-icon">✓</span>}
            </div>

            {clusters.map((cluster, index) => (
              <div
                key={index}
                className={`cluster-option ${selectedCluster === cluster ? 'selected' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedCluster(cluster);
                  setIsOpen(false);
                  if (closeTab) closeTab();
                  if (triggerSearch) triggerSearch(cluster); 
                }}
              >
                <span className="cluster-name">{cluster}</span>
                {selectedCluster === cluster && (
                  <span className="check-icon">✓</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const SkeletonPropertyCard = () => {
    return (
      <div className="tour-property-item skeleton-item"> 
        <div className="tour-property-image-box skeleton-image-box">
          <div className="skeleton-pulse"></div>
        </div>
        <div className="tour-property-info">
          <div className="property-location skeleton-location">
            <div className="skeleton-pulse skeleton-title"></div>
            <div className="tour-property-rating skeleton-rating">
              <div className="skeleton-pulse skeleton-rating-pill"></div>
            </div>
          </div>
          <div className="skeleton-pulse skeleton-cluster"></div>
          <div className="property-details-row">
            <div className="property-price skeleton-price">
              <div className="skeleton-pulse skeleton-price-amount"></div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ==========================================
  // PAGINATION LOGIC (CRASH-PROOF)
  // ==========================================
  const safeProperties = Array.isArray(allProperties) ? allProperties : [];
  
  const totalPages = Math.ceil(safeProperties.length / itemsPerPage);
  
  const currentProperties = safeProperties.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
      
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 50); 
    }
  };

  return (
    <div>
      <div className="Product_Main_Container">
        <AuthProvider>
        {!showFilters && <Navbar />}
        <br /><br /><br />
    
        <div className="property-container_for_product">
          {renderSearchSection()}
          <div className="header-container" ref={listHeaderRef}>
            <h2>Available Properties</h2>
            <Sorting
              showFilters={showFilters}
              setShowFilters={setShowFilters}
              priceRange={priceRange}
              setPriceRange={setPriceRange}
              sortOrder={sortOrder}
              setSortOrder={setSortOrder}
              selectedFacilities={selectedFacilities}
              setSelectedFacilities={setSelectedFacilities}
              selectedPropertyTypes={selectedPropertyTypes}
              setSelectedPropertyTypes={setSelectedPropertyTypes}
              selectedBookingOptions ={selectedBookingOptions }
              setSelectedBookingOptions={setSelectedBookingOptions}
              handleCheckAvailability={handleCheckAvailability}
            />
          </div>
    
          {isLoading ? (
            <div className="scrollable-container_for_product">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((index) => (
                <SkeletonPropertyCard key={`skeleton-${index}`} />
              ))}
            </div>
          ) : (
            <>
              <div className="scrollable-container_for_product">
                {currentProperties.length > 0 ? (
                  currentProperties.map((property, index) => {
                    if (currentProperties.length === index + 1) {
                      return (
                        <div 
                          className="tour-property-item" 
                          key={property.propertyid} 
                          onClick={() => handleViewDetails(property)}
                        > 
                          <div className="tour-property-image-box">
                            {property.propertyimage && property.propertyimage.length > 0 ? (
                              <ImageSlider 
                                images={property.propertyimage}
                                onClick={(e) => {
                                  e.stopPropagation();
                                }} 
                              />
                            ) : (
                              <p>No images available</p>
                            )}
                          </div>
                          <div className="tour-property-info">
                            <div className="property-location">
                              <h4>{property.propertyaddress}</h4>
                              <div className="tour-property-rating">
                                {property.rating ? (
                                  <>
                                    <span className="rating-number">
                                      {Number.isInteger(property.rating) 
                                        ? property.rating.toFixed(1)
                                        : property.rating.toFixed(2).replace(/\.?0+$/, '')}
                                    </span>
                                    <FaStar />
                                  </>
                                ) : (
                                  <span className="no-reviews">No reviews</span>
                                )}
                              </div>
                            </div>
                            <span className="property-cluster">{property.clustername}</span>
                            <div className="property-details-row">
                              <div className="property-price">
                                <span className="price-amount">${property.normalrate}</span>
                                <span className="price-period">/night</span>
                              </div>
                                {isDateOverlapping[property.propertyid] && (
                                  <span className="status-label">FULL</span>
                                )}
                            </div>
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <div 
                          className="tour-property-item" 
                          key={property.propertyid} 
                          onClick={() => handleViewDetails(property)}
                        > 
                          <div className="tour-property-image-box">
                            {property.propertyimage && property.propertyimage.length > 0 ? (
                              <ImageSlider 
                                images={property.propertyimage}
                                onClick={(e) => {
                                  e.stopPropagation();
                                }} 
                              />
                            ) : (
                              <p>No images available</p>
                            )}
                          </div>
                          <div className="tour-property-info">
                            <div className="property-location">
                              <h4>{property.propertyaddress}</h4>
                              <div className="tour-property-rating">
                                {property.rating ? (
                                  <>
                                    <span className="rating-number">
                                      {Number.isInteger(property.rating) 
                                        ? property.rating.toFixed(1)
                                        : property.rating.toFixed(2).replace(/\.?0+$/, '')}
                                    </span>
                                    <FaStar />
                                  </>
                                ) : (
                                  <span className="no-reviews">No reviews</span>
                                )}
                              </div>
                            </div>
                            <span className="property-cluster">{property.clustername}</span>
                            <div className="property-details-row">
                              <div className="property-price">
                                <span className="price-amount">${property.normalrate}</span>
                                <span className="price-period">/night</span>
                                {isDateOverlapping[property.propertyid] && (
                                  <span className="status-label">FULL</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }
                  })
                ) : (
                  <p className="no-properties-message">No properties available.</p>
                )}
              </div>

              {/* PAGINATION CONTROLS */}
              {totalPages > 1 && (
                <div className="pagination-controls">
                  <button 
                    onClick={() => handlePageChange(page - 1)} 
                    disabled={page === 1} 
                    className="page-btn"
                  >
                    Previous
                  </button>
                  
                  {[...Array(totalPages)].map((_, i) => (
                    <button 
                      key={i} 
                      className={`page-btn ${page === i + 1 ? 'active' : ''}`} 
                      onClick={() => handlePageChange(i + 1)}
                    >
                      {i + 1}
                    </button>
                  ))}
                  
                  <button 
                    onClick={() => handlePageChange(page + 1)} 
                    disabled={page === totalPages} 
                    className="page-btn"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
          </div>
    
          {showToast && <Toast type={toastType} message={toastMessage} />}
          <br /><br /><br /><br /><br /><br />
        <Back_To_Top_Button />
        <TawkMessenger />
        <Footer />
        </AuthProvider>
        </div>
      </div>
    );
};

export default Product;