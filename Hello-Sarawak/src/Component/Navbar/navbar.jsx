import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { FaBars, FaTimes, FaUserCircle, FaBell } from "react-icons/fa";
import { logoutUser, fetchUserData, suggestedReservations, rejectSuggestedRoom, updateReservationStatus } from '../../../Api/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import DefaultAvatar from '../../../src/public/avatar.png';
import eventBus from '../EventBus/Eventbus';
import { useAuth } from '../AuthContext/AuthContext';
import ImageSlider from '../ImageSlider/ImageSlider';
import Toast from '../Toast/Toast';
import './navbar.css';

function Navbar() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const location = useLocation();
    const { isLoggedIn, userAvatar, userID, logout, updateAvatar } = useAuth();
    const [isScrolled, setIsScrolled] = useState(false);
    const [scrollPosition, setScrollPosition] = useState(0);
    const [suggestedReservation, setSuggestedReservation] = useState([]);

    // Notification states
    const [showNotifications, setShowNotifications] = useState(false);
    const [selectedNotification, setSelectedNotification] = useState(null);

    // Toast states
    const [toastMessage, setToastMessage] = useState('');
    const [toastType, setToastType] = useState('');
    const [showToast, setShowToast] = useState(false);

    // Ref for the notification container to detect outside clicks
    const notificationRef = React.useRef(null);

    // React Query for user data with polling
    const { data: userData, isLoading: isUserLoading } = useQuery({
        queryKey: ['userData', userID],
        queryFn: () => fetchUserData(userID),
        enabled: !!isLoggedIn && !!userID,
        staleTime: 0, // Don't cache the data
        refetchInterval: 5000, // Check every 5 seconds
        refetchIntervalInBackground: true, // Continue checking even when tab is not active
    });

    // Derived state
    const isCustomer = userData?.usergroup === "Customer";

    // Notification functions
    const toggleNotifications = () => {
        setShowNotifications(!showNotifications);
    };

    const closeNotifications = () => {
        setShowNotifications(false);
    };

    // Function to display toast messages
    const displayToast = (type, message) => {
        setToastType(type);
        setToastMessage(message);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 5000); // Hide toast after 5 seconds
    };

    // Effect to close notifications when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (notificationRef.current && !notificationRef.current.contains(event.target)) {
                closeNotifications();
            }
        };

        if (showNotifications) {
            // Attach the event listener
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            // Remove the event listener if the dropdown is already closed
            document.removeEventListener('mousedown', handleClickOutside);
        }

        // Cleanup function to remove the event listener
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showNotifications]); // Re-run the effect when showNotifications changes

    // Effect for scroll locking when property details overlay is open
    useEffect(() => {
        if (selectedNotification) {
            // Save the current scroll position
            const scrollY = window.scrollY;
            document.body.style.position = 'fixed';
            document.body.style.top = `-${scrollY}px`;
            document.body.style.width = '100%';
            document.body.style.overflow = 'hidden';
            
            // Add padding to prevent layout shift if a scrollbar was present
            const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
            if (scrollbarWidth > 0) {
              document.body.style.paddingRight = `${scrollbarWidth}px`;
            }

            return () => {
                // Restore scroll position and body styles
                const scrollY = document.body.style.top ? parseInt(document.body.style.top, 10) * -1 : 0;
                document.body.style.position = '';
                document.body.style.top = '';
                document.body.style.width = '';
                document.body.style.overflow = '';
                document.body.style.paddingRight = '';
                window.scrollTo(0, scrollY);
            };
        }
    }, [selectedNotification]);

    useEffect(() => {
        const getSuggestedReservations = async () => {
            try {
                if (!userID) {
                    return;
                }
                const suggestedReservationsData = await suggestedReservations(userID);
                if (suggestedReservationsData && Array.isArray(suggestedReservationsData)) {
                    setSuggestedReservation(suggestedReservationsData);
                } else {
                    setSuggestedReservation([]);
                }
            } catch (err) {
                setSuggestedReservation([]);
            }
        };

        if (isLoggedIn && userID) {
            getSuggestedReservations();
        }
    }, [userID, isLoggedIn]);

    // Check for inactive user and handle logout
    useEffect(() => {
        const checkInactiveStatus = async () => {
            if (userData?.uactivation === "Inactive" && isLoggedIn) {
                try {
                    await handleLogout();
                } catch (error) {
                }
            }
        };

        checkInactiveStatus();
    }, [userData?.uactivation, isLoggedIn]);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 10);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        const offcanvasElement = document.getElementById('offcanvasNavbar');

        if (!offcanvasElement) return;

        const handleShow = () => {
            // Storing Scroll Position
            const currentPosition = window.pageYOffset;
            setScrollPosition(currentPosition);

            // Add No Scroll
            document.body.classList.add('no-scroll');

            document.body.style.top = `-${currentPosition}px`;
            document.body.style.position = 'fixed';
            document.body.style.width = '100%';
        };

        //Remove No Scroll When Close The Menu
        const handleHide = () => {
            const savedPosition = scrollPosition;

            document.body.classList.remove('no-scroll');
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.width = '';

            window.scrollTo(0, savedPosition);
        };

        offcanvasElement.addEventListener('show.bs.offcanvas', handleShow);
        offcanvasElement.addEventListener('hide.bs.offcanvas', handleHide);

        return () => {
            offcanvasElement.removeEventListener('show.bs.offcanvas', handleShow);
            offcanvasElement.removeEventListener('hide.bs.offcanvas', handleHide);
        };
    }, [scrollPosition]);

    useEffect(() => {
        const initOffcanvas = () => {
            if (typeof bootstrap !== 'undefined') {
                const offcanvasElement = document.getElementById('offcanvasNavbar');
                if (offcanvasElement) {
                    const bsOffcanvas = new bootstrap.Offcanvas(offcanvasElement, {
                        backdrop: true,
                        scroll: false
                    });
                }
            }
        };

        const bootstrapReady = setInterval(() => {
            if (typeof bootstrap !== 'undefined') {
                initOffcanvas();
                clearInterval(bootstrapReady);
            }
        }, 100);

        return () => clearInterval(bootstrapReady);
    }, []);

    useEffect(() => {
        const handleAvatarUpdate = (newAvatar) => {
            updateAvatar(newAvatar);
            queryClient.invalidateQueries(['userData', userID]);
        };

        eventBus.on('avatarUpdated', handleAvatarUpdate);

        return () => {
            eventBus.off('avatarUpdated', handleAvatarUpdate);
        };
    }, [updateAvatar, userID, queryClient]);

    useEffect(() => {
        if (userData?.uimage) {
            const avatarUrl = `data:image/jpeg;base64,${userData.uimage}`;
            updateAvatar(avatarUrl);
        }
    }, [userData, updateAvatar]);

    const handleLogout = async () => {
        try {
            const googleToken = localStorage.getItem('googleAccessToken');

            if (googleToken) {
                await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${googleToken}`, { method: 'POST' });
            }

            const response = await logoutUser(userID);

            if (response.success) {
                logout();
                navigate('/');
            } else {
            }
        } catch (error) {
        }
    };

    const handleImageError = (e) => {
        e.target.src = DefaultAvatar;
    };

    const closeOffcanvas = () => {
        if (typeof bootstrap !== 'undefined') {
            const offcanvasElement = document.getElementById('offcanvasNavbar');
            if (offcanvasElement) {
                const bsOffcanvas = bootstrap.Offcanvas.getInstance(offcanvasElement);
                if (bsOffcanvas) bsOffcanvas.hide();
            }
        }
    };

    // Check if the current path matches the nav link
    const isActive = (path) => {
        return location.pathname === path;
    };


    return (
        <div>
            <Helmet>
                <link
                    rel="stylesheet"
                    href="https://cdn.jsdelivr.net/npm/bootstrap/dist/css/bootstrap.min.css"
                />
                <script
                    src="https://cdn.jsdelivr.net/npm/bootstrap/dist/js/bootstrap.bundle.min.js"
                    defer
                />
            </Helmet>

            <div className="container_navbar">
                <nav className="navbar navbar-expand-lg">
                    <Link to="/" className="navbar-brand-link">
                        <h1 className="navbar_brand">Hello Sarawak</h1>
                    </Link>

                    <div className="offcanvas offcanvas-end" tabIndex="-1" id="offcanvasNavbar" aria-labelledby="offcanvasNavbarLabel">
                        <div className="offcanvas-header">
                            <h2 className="offcanvas-title" id="offcanvasNavbarLabel">Hello Sarawak</h2>
                            <button type="button" className="close-btn" data-bs-dismiss="offcanvas" aria-label="Close">
                                <FaTimes className="icon_close" />
                            </button>
                        </div>
                        <div className="offcanvas-body">
                            <ul className="navbar-nav">
                                <li className="nav-item">
                                    <Link
                                        className={`nav-link ${isActive(isLoggedIn ? '/home' : '/') ? 'active' : ''}`}
                                        to={isLoggedIn ? '/home' : '/'}
                                        onClick={closeOffcanvas}
                                    >
                                        Home
                                    </Link>
                                </li>
                                <li className="nav-item">
                                    <Link
                                        className={`nav-link ${isActive('/product') ? 'active' : ''}`}
                                        to="/product"
                                        onClick={closeOffcanvas}
                                    >
                                        Rooms
                                    </Link>
                                </li>
                                <li className="nav-item">
                                    <Link
                                        className={`nav-link ${isActive('/Cart') ? 'active' : ''}`}
                                        to="/Cart"
                                        onClick={closeOffcanvas}
                                    >
                                        Cart
                                    </Link>
                                </li>
                                <li className="nav-item">
                                    <Link
                                        className={`nav-link ${isActive('/about_us') ? 'active' : ''}`}
                                        to="/about_us"
                                        onClick={closeOffcanvas}
                                    >
                                        About Us
                                    </Link>
                                </li>
                                <li className="nav-item">
                                    <Link
                                        className={`nav-link ${isActive('/about_sarawak') ? 'active' : ''}`}
                                        to="/about_sarawak"
                                        onClick={closeOffcanvas}
                                    >
                                        About Sarawak
                                    </Link>
                                </li>

                                {/* Mobile login/profile/logout options */}
                                {isLoggedIn && isCustomer ? (
                                    <>
                                        <li className="nav-item mobile-auth-item">
                                            <Link
                                                className={`nav-link ${isActive('/profile') ? 'active' : ''}`}
                                                to="/profile"
                                                onClick={closeOffcanvas}
                                            >
                                                My Profile
                                            </Link>
                                        </li>
                                        <li className="nav-item mobile-auth-item">
                                            <span
                                                className="nav-link mobile-auth-link"
                                                onClick={() => {
                                                    closeOffcanvas();
                                                    handleLogout();
                                                }}
                                            >
                                                Logout
                                            </span>
                                        </li>
                                    </>
                                ) : (
                                    <li className="nav-item mobile-auth-item">
                                        <Link
                                            className={`nav-link ${isActive('/login') ? 'active' : ''}`}
                                            to="/login"
                                            onClick={closeOffcanvas}
                                        >
                                            Login
                                        </Link>
                                    </li>
                                )}
                            </ul>
                        </div>
                    </div>

                    <div className="nav-actions">
                        {isLoggedIn && isCustomer && !isUserLoading ? (
                            <>
                                {/* Notification Bell Icon */}
                                <div className="nav-notification-container">
                                    <FaBell className='nav-notification_icon' onClick={toggleNotifications} />
                                    {/* Notification count badge */}
                                    {suggestedReservation.length > 0 && (
                                        <span className="notification-count-badge">
                                            {suggestedReservation.length}
                                        </span>
                                    )}

                                    {showNotifications && (
                                        <div className="nav-notification-overlay" ref={notificationRef}>
                                            <div className="nav-notification-content">
                                                <div className="nav-notification-header">
                                                    <h3>Notifications</h3>
                                                    <button className="Notify-close-btn" onClick={closeNotifications}>×</button>
                                                </div>

                                                <div className="nav-notification-list">
                                                    {suggestedReservation.length === 0 ? (
                                                        <div className="nav-notification-item">
                                                            <div className="nav-notification-text">
                                                                <p>No new suggestions</p>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        suggestedReservation.map((res) => (
                                                            <div 
                                                                className="nav-notification-item" 
                                                                key={res.reservationid}
                                                                onClick={() => {
                                                                    setSelectedNotification(res);
                                                                    closeNotifications();
                                                                }}
                                                            >
                                                                <div className="nav-notification-dot"></div>
                                                                <div className="nav-notification-text">
                                                                    <p>You have received a new suggested room: {res.propertyaddress}</p>
                                                                    <span className="nav-notification-time">
                                                                        Check-in: {new Date(res.checkindatetime).toLocaleDateString()}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>

                                                <div className="nav-notification-footer">
                                                    <button 
                                                        className="nav-view-all-btn"
                                                        onClick={() => {
                                                            closeNotifications(); // Close the dropdown menu
                                                            navigate('/cart');    // Send the user to the Cart/Reservations page
                                                        }}
                                                    >
                                                        View All
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* User Avatar */}
                                <button
                                    className="user-icon-button"
                                    onClick={() => navigate('/profile')}
                                    aria-label="User Profile"
                                >
                                    {userAvatar ? (
                                        <img
                                            src={userAvatar}
                                            alt="User Avatar"
                                            onError={handleImageError}
                                            key={userAvatar}
                                        />
                                    ) : (
                                        <FaUserCircle className="default-avatar" />
                                    )}
                                </button>
                            </>
                        ) : null}

                        {isLoggedIn && isCustomer ? (
                            <button onClick={handleLogout} className="auth-button logout-button">
                                Logout
                            </button>
                        ) : (
                            <Link to="/login" className="auth-button login-button">
                                Login
                            </Link>
                        )}

                        <button
                            className="navbar-toggler"
                            type="button"
                            data-bs-toggle="offcanvas"
                            data-bs-target="#offcanvasNavbar"
                            aria-controls="offcanvasNavbar"
                            aria-label="Toggle navigation"
                        >
                            <FaBars className="icon_navbar" />
                        </button>
                    </div>
                </nav>
            </div>

            {selectedNotification && (
                <div className="property-details-overlay">
                    <div className="property-details-modal">
                        <div className="property-details-header">
                            <h2>Suggested Property Details</h2>
                            <button 
                                className="property-details-close-btn"
                                onClick={() => setSelectedNotification(null)}
                            >
                                ×
                            </button>
                        </div>
                        <div className="property-details-content">
                            <div className="tour-property-item" style={{ boxShadow: 'none', cursor: 'default' }}>
                                <div className="tour-property-image-box">
                                    {selectedNotification.propertyimage && selectedNotification.propertyimage.length > 0 ? (
                                        <ImageSlider 
                                            images={selectedNotification.propertyimage}
                                            onClick={e => e.stopPropagation()}
                                        />
                                    ) : (
                                        <p>No images available</p>
                                    )}
                                </div>
                                <div className="tour-property-info">
                                    <div className="property-location">
                                        <h4>{selectedNotification.propertyaddress}</h4>
                                    </div>
                                    <div className="property-details-row">
                                        <div className="property-price">
                                            <span className="price-amount">RM {selectedNotification.totalprice}</span>
                                        </div>
                                    </div>
                                    <div className="property-dates">
                                        <div className="date-item">
                                            <span className="date-value">Check-in: {new Date(selectedNotification.checkindatetime).toLocaleDateString()}</span>
                                        </div>
                                        <div className="date-item">
                                            <span className="date-value">Check-out: {new Date(selectedNotification.checkoutdatetime).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
<div className="property-details-footer">
                      {/* NEW: View Details Button */}
                            <button 
                                className="property-details-action-btn view-details-btn"
                                onClick={() => {
                                    // 1. Close the popup
                                    setSelectedNotification(null);
                                    
                                    // 2. Redirect AND pass the data wrapped in 'propertyDetails'
                                    navigate(`/product/${selectedNotification.propertyid}`, { 
                                        state: { propertyDetails: selectedNotification } 
                                    }); 
                                }}
                            >
                                View Details
                            </button>

                            {/* Reject Button */}
                            <button 
                                className="property-details-action-btn reject-btn"
                                onClick={async () => {
                                    if (!selectedNotification || !selectedNotification.propertyid || !selectedNotification.reservationid) {
                                        displayToast('error', 'Missing information for rejection');
                                    } else {
                                        try {
                                            // Fixed: Only rejecting the reservation, NOT the actual property
                                            await updateReservationStatus(selectedNotification.reservationid, 'Rejected');

                                            displayToast('success', 'Suggested room rejected successfully');
                                            setTimeout(() => {
                                                setSelectedNotification(null);
                                                navigate('/cart');
                                              }, 3000);
                                        } catch (error) {
                                            displayToast('error', 'Failed to reject suggested room');
                                        }
                                    }
                                }}
                            >
                                Reject
                            </button>

                            {/* Accept Button */}
                            <button 
                                className="property-details-action-btn accept-btn"
                                onClick={async () => {
                                    if (selectedNotification && selectedNotification.reservationid) {
                                        try {
                                            await updateReservationStatus(selectedNotification.reservationid, 'Accepted');
                                            displayToast('success', 'Reservation accepted successfully');
                                            setTimeout(() => {
                                                setSelectedNotification(null);
                                                navigate('/cart');
                                              }, 3000);
                                        } catch (error) {
                                            displayToast('error', 'Failed to accept reservation');
                                        }
                                    }
                                }}
                            >
                                Accept
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Render Toast component */}
            {showToast && <Toast type={toastType} message={toastMessage} />}
        </div>
    );
}

export default Navbar;
