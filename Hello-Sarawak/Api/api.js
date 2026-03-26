const API_URL = import.meta.env.VITE_API_URL;

//Register
export const signupUser = async (userData) => {
  try {
    const response = await fetch(`${API_URL}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    return response;
  } catch (error) {
    console.error('API error:', error);
    throw error; 
  }
};

// Login
export const loginUser = async (userData) => {
  try {
    const response = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    return response;
  } catch (error) {
    console.error('API error:', error);
    throw error; 
  }
};

export const checkstatus = async (userid) => {
  try {
    const response = await fetch(`${API_URL}/checkStatus?userid=${userid}`, {
      method: 'GET'
    });
    return response;
  } catch (error) {
    console.error('API error:', error);
    throw error; 
  }
};

// Logout
export const logoutUser = async (userid) => {
  try {
    const response = await fetch(`${API_URL}/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userid }),
    });

    const responseData = await response.json();
    return responseData;
  }catch (error) {
    console.error('API error:', error);
    throw error;
  }
};

// Properties Listing
export const propertiesListing = async (propertyData) => {
  const usergroup = localStorage.getItem("usergroup");
  
  try {
    const response = await fetch(`${API_URL}/propertiesListing`, {
      method: 'POST',
      body: propertyData,
    });

    if(!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create property');
    }

    const responseData = await response.json();
    return responseData;
  }catch (error) {
    console.error('API error: ', error);
    throw error;
  }
};

// Fetch Properties (Product)
export const fetchProduct = async () => {
  try {
    const response = await fetch(`${API_URL}/product`);

    if (!response.ok) {
      throw new Error('Failed to fetch properties');
    }
    const data = await response.json();
    return data; 
  } catch (error) {
    console.error('Error fetching properties:', error);
    throw error; 
  }
};

// Fetch Properties (Dashboard)
export const fetchPropertiesListingTable = async () => {
  const username = localStorage.getItem('username'); 
  
  try {
    const response = await fetch(`${API_URL}/propertiesListingTable?username=${username}`);

    if (!response.ok) {
      throw new Error('Failed to fetch properties');
    }

    const data = await response.json();
    return data; 
  } catch (error) {
    console.error('Error fetching properties', error);
    throw error;
  }
};

// Update Property
export const updateProperty = async (propertyData, propertyid) => {
  const creatorid = localStorage.getItem("userid");
  const creatorUsername = localStorage.getItem("username");
  
  if (!propertyid || propertyid === 'undefined') {
    throw new Error('propertyid invalid');
  }
  
  try {
    const response = await fetch(`${API_URL}/propertiesListing/${propertyid}?creatorid=${creatorid}&creatorUsername=${creatorUsername}`, {
      method: 'PUT',
      body: propertyData, 
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update property');
    }

    return await response.json();
  } catch (error) {
    console.error('API error:', error);
    throw error;
  }
};

// Update property status
export const updatePropertyStatus = async (propertyid, status) => {
  const creatorid = localStorage.getItem("userid");
  const creatorUsername = localStorage.getItem("username");
  
  try {
    const response = await fetch(`${API_URL}/updatePropertyStatus/${propertyid}?creatorid=${creatorid}&creatorUsername=${creatorUsername}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ propertyStatus: status }),
    });

    if (!response.ok) {
      throw new Error('Failed to update property status');
    }

    return await response.json();
  } catch (error) {
    console.error('API error:', error);
    throw error;
  }
};

// Delete Property
export const deleteProperty = async (propertyid) => {
  const creatorid = localStorage.getItem("userid");
  const creatorUsername = localStorage.getItem("username");
  
  try {
    const response = await fetch(`${API_URL}/removePropertiesListing/${propertyid}?creatorid=${creatorid}&creatorUsername=${creatorUsername}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to delete property');
    }

    return await response.json();
  } catch (error) {
    console.error('API error:', error);
    throw error;
  }
};

// Fetch Customers
export const fetchCustomers = async () => {
  const userid = localStorage.getItem("userid");
  
  try {
    const response = await fetch(`${API_URL}/users/customers?userid=${userid}`);

    if (!response.ok) {
      throw new Error('Failed to fetch customers');
    }

    return await response.json();
  } catch (error) {
    console.error('API error:', error);
    throw error;
  }
};

// Fetch Owners
export const fetchOwners = async () => {
  try {
    const response = await fetch(`${API_URL}/users/owners`);

    if (!response.ok) {
      throw new Error('Failed to fetch owners');
    }

    return await response.json();
  } catch (error) {
    console.error('API error:', error);
    throw error;
  }
};

// Fetch Moderators
export const fetchModerators = async () => {
  const userid = localStorage.getItem("userid");
  
  try {
    const response = await fetch(`${API_URL}/users/moderators?userid=${userid}`);

    if (!response.ok) {
      throw new Error('Failed to fetch moderators');
    }

    return await response.json();
  } catch (error) {
    console.error('API error:', error);
    throw error;
  }
};

// Fetch Operators
export const fetchOperators = async () => {
  try {
    const response = await fetch(`${API_URL}/users/operators`);

    if (!response.ok) {
      throw new Error('Failed to fetch operators');
    }

    return await response.json();
  } catch (error) {
    console.error('API error:', error);
    throw error;
  }
};

// Fetch Administrator
export const fetchAdministrators = async () => {
  try {
    const response = await fetch(`${API_URL}/users/administrators`);

    if (!response.ok) {
      throw new Error('Failed to fetch administrators');
    }

    return await response.json();
  } catch (error) {
    console.error('API error:', error);
    throw error;
  }
};

// Create Moderator
export const createModerator = async (userData) => {
  try {
    const response = await fetch(`${API_URL}/users/createModerator`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      throw new Error('Failed to create moderator');
    }

    return response;
  } catch (error) {
    console.error('API error:', error);
    throw error; 
  }
};

// Update User
export const updateUser = async (userData, userid) => {
  try {
    const url = `${API_URL}/users/updateUser/${userid}`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      try {
        const errorText = await response.text();
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
          throw new Error(errorData.error || errorData.message || `Failed to update user (${response.status})`);
        } catch (jsonError) {
          // console.error('Response is not valid JSON:', jsonError);
          throw new Error(`Server error (${response.status}): ${errorText || response.statusText}`);
        }
      } catch (parseError) {
        // console.error('Error parsing response:', parseError);
        throw new Error(`Failed to update user: ${response.status} ${response.statusText}`);
      }
    }

    // Attempt to parse response as JSON, if fails return an empty success object
    try {
      const data = await response.json();
      return data;
    } catch (jsonError) {
      console.warn('Success response is not valid JSON, returning generic success object:', jsonError);
      return { success: true, message: 'Update successful' };
    }
  } catch (error) {
    console.error('API error:', error);
    throw error;
  }
};

// Remove User
export const removeUser = async (userid) => {
  const creatorid = localStorage.getItem("userid");
  const creatorUsername = localStorage.getItem("username");
  
  try {
    const response = await fetch(`${API_URL}/users/removeUser/${userid}?creatorid=${creatorid}&creatorUsername=${creatorUsername}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to delete user');
    }

    return await response.json();
  } catch (error) {
    console.error('API error:', error);
    throw error;
  }
};

// Suspend User
export const suspendUser = async (userid) => {
  const creatorid = localStorage.getItem("userid");
  const creatorUsername = localStorage.getItem("username");
  
  try {
    const response = await fetch(`${API_URL}/users/suspendUser/${userid}?creatorid=${creatorid}&creatorUsername=${creatorUsername}`, {
      method: 'PUT',
    });

    if (!response.ok) {
      throw new Error('Failed to suspend user');
    }

    return await response.json();
  } catch (error) {
    console.error('API error:', error);
    throw error;
  }
};

// Activate User
export const activateUser = async (userid) => {
  const creatorid = localStorage.getItem("userid");
  const creatorUsername = localStorage.getItem("username");
  
  try {
    const response = await fetch(`${API_URL}/users/activateUser/${userid}?creatorid=${creatorid}&creatorUsername=${creatorUsername}`, {
      method: 'PUT',
    });

    if (!response.ok) {
      throw new Error('Failed to activate user');
    }

    return await response.json();
  } catch (error) {
    console.error('API error:', error);
    throw error;
  }
};

// Nodemailer For Contact Us
export const sendContactEmail = async (emailData) => {
  try {
    const response = await fetch(`${API_URL}/contact_us`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData),
    });

    return response.json();
  } catch (error) {
    console.error('API error:', error);
    throw error;
  }
};

// Booking Request Notification
export const requestBooking = async (reservationid) => {
  const creatorid = localStorage.getItem("userid");
  const creatorUsername = localStorage.getItem("username");
  
  try {
    const response = await fetch(`${API_URL}/requestBooking/${reservationid}?creatorid=${creatorid}&creatorUsername=${creatorUsername}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if(!response) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to send booking request notification');
    }

    return await response.json();
  }catch (error) {
    console.error('API error: ', error);
    throw error;
  }
};

// Booking Accepted Notification
export const acceptBooking = async (reservationid) => {
  const creatorid = localStorage.getItem("userid");
  const creatorUsername = localStorage.getItem("username");
  
  try {
    const response = await fetch(`${API_URL}/accept_booking/${reservationid}?creatorid=${creatorid}&creatorUsername=${creatorUsername}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to send booking accepted notification');
    }

    return await response.json();
  }catch (error) {
    console.error('API error: ', error);
    throw error;
  }
};

// Payment Reminder
export const sendPaymentReminders = async () => {
  try {
    const response = await fetch(`${API_URL}/send_payment_reminders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to send payment reminders');
    }

    return await response.json();
  } catch (error) {
    console.error('API error:', error);
    throw error;
  }
};

// Suggest New Room
export const suggestNewRoom = async (propertyid, reservationid) => {
  const creatorid = localStorage.getItem("userid");
  const creatorUsername = localStorage.getItem("username");
  
  try {
    const response = await fetch(`${API_URL}/suggestNewRoom/${propertyid}/${reservationid}?creatorid=${creatorid}&creatorUsername=${creatorUsername}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(responseData.message || 'Failed to send new room suggested notification');
    }

    return await response.json();
  } catch (error) {
    console.error('API error: ', error);
    throw error;
  }
};

// Property Listing Request Notification
export const propertyListingRequest = async (propertyid) => {
  const creatorid = localStorage.getItem("userid");
  const creatorUsername = localStorage.getItem("username");
  
  try {
    const response = await fetch(`${API_URL}/propertyListingRequest/${propertyid}?creatorid=${creatorid}&creatorUsername=${creatorUsername}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if(!response) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to send property listing request notification');
    }

    return await response.json();
  }catch (error) {
    console.error('API error: ', error);
    throw error;
  }
};

// Property Listing Request Accepted Notification
export const propertyListingAccept = async (propertyid) => {
  const creatorid = localStorage.getItem("userid");
  const creatorUsername = localStorage.getItem("username");
  
  try {
    const response = await fetch(`${API_URL}/propertyListingAccept/${propertyid}?creatorid=${creatorid}&creatorUsername=${creatorUsername}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if(!response) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to send property listing request accepted notification');
    }

    return await response.json();
  }catch (error) {
    console.error('API error: ', error);
    throw error;
  }
};

// Property Listing Request Rejected Notification
export const propertyListingReject = async (propertyid) => {
  const creatorid = localStorage.getItem("userid");
  const creatorUsername = localStorage.getItem("username");
  
  try {
    const response = await fetch(`${API_URL}/propertyListingReject/${propertyid}?creatorid=${creatorid}&creatorUsername=${creatorUsername}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if(!response) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to send property listing request rejected notification');
    }

    return await response.json();
  }catch (error) {
    console.error('API error: ', error);
    throw error;
  }
};

// Send Suggest Notification 
export const sendSuggestNotification = async (reservationid, selectedOperators) => {
  const creatorid = localStorage.getItem("userid");
  const creatorUsername = localStorage.getItem("username");
  
  try {
    const response = await fetch(`${API_URL}/sendSuggestNotification/${reservationid}?creatorid=${creatorid}&creatorUsername=${creatorUsername}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userids: selectedOperators,  
    }),
    });

    if(!response) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to send suggest notification');
    }

    return await response.json();
  } catch (error) {
    console.error('API error: ', error);
    throw error;
  }
};

// Send Picked Up Notification To Original Reservation Owner
export const sendPickedUpNotification = async (reservationid) => {
  const creatorid = localStorage.getItem("userid");
  const creatorUsername = localStorage.getItem("username");
  
  try {
    const response = await fetch(`${API_URL}/sendPickedUpNotification/${reservationid}?creatorid=${creatorid}&creatorUsername=${creatorUsername}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if(!response) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to send picked up notification');
    }

    return await response.json();
  } catch (error) {
    console.error('API error: ', error);
    throw error;
  }
};

// Send Suggested Room Rejected Message To Operators
export const rejectSuggestedRoom = async (propertyid) => {
  const creatorid = localStorage.getItem("userid");
  const creatorUsername = localStorage.getItem("username");
  
  try {
    const response = await fetch(`${API_URL}/reject_suggested_room/${propertyid}?creatorid=${creatorid}&creatorUsername=${creatorUsername}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(responseData.message || 'Failed to send suggested room rejected notification');
    }

    return await response.json();
  } catch (error) {
    console.error('API error: ', error);
    throw error;
  }
};

// Store Reservation Data
export const createReservation = async (reservationData) => {
  const userid = localStorage.getItem('userid');
  const creatorid = localStorage.getItem("userid");
  const creatorUsername = localStorage.getItem("username");
  
  try {
    if (!userid) {
      throw new Error('User not logged in. Please log in to create a reservation.');
    }

    const reservationWithuserid = { ...reservationData, userid };
    
    const response = await fetch(`${API_URL}/reservation/${userid}?creatorid=${creatorid}&creatorUsername=${creatorUsername}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reservationWithuserid),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('server error:', {
        status: response.status,
        statusText: response.statusText,
        errorData: errorData,
        url: response.url
      });
      throw new Error(errorData.error || 'Failed to create reservation');
    }

    const result = await response.json();
    if (!result || !result.reservationid) {
      throw new Error('No valid reservation ID received from server');
    }

    return result;
  } catch (error) {
    console.error('API error:', error);
    throw error;
  }
};

// Fetch all Reservations
export const fetchReservation = async () => {
  const username = localStorage.getItem('username');
  
  try {
    if (!username) {
      throw new Error('Username is not found in localStorage. Please log in.');
    }

    const response = await fetch(`${API_URL}/reservationTable?username=${encodeURIComponent(username)}`);

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.reservations;
  } catch (error) {
    console.error('API error:', error);
    throw error;
  }
};

// Update reservation status
export const updateReservationStatus = async (reservationid, status) => {
  const userid = localStorage.getItem("userid");
  
  try {
    const response = await fetch(`${API_URL}/updateReservationStatus/${reservationid}?userid=${userid}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reservationStatus: status }),
    });

    if (!response.ok) {
      throw new Error('Failed to update reservation status');
    }

    return await response.json();
  } catch (error) {
    console.error('API error:', error);
    throw error;
  }
};

// Cart
export const fetchCart = async () => {
  const userid = localStorage.getItem('userid');
  
  try {
      const response = await fetch(`${API_URL}/cart?userid=${userid}`);
    
      if (!response.ok) {
          throw new Error('Failed to fetch reservations');
      }

      const data = await response.json();
      
      return data.reservations;
  } catch (error) {
      console.error('API error:', error);
      throw error;
  }
};

// Get property owner's PayPal ID
export const getPropertyOwnerPayPalId = async (propertyId) => {
  try {
    const response = await fetch(`${API_URL}/property/owner-paypal/${propertyId}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch property owner PayPal ID');
    }
    
    const data = await response.json();

    return {
      payPalId: data.payPalId,
      ownerName: data.ownerName
    };
  } catch (error) {
    console.error('API error fetching PayPal ID:', error);
    throw error;
  }
};

// Remove Reservation
export const removeReservation = async (reservationid) => {
  const creatorid = localStorage.getItem("userid");
  const creatorUsername = localStorage.getItem("username");
  
  try {
    const response = await fetch(`${API_URL}/removeReservation/${reservationid}?creatorid=${creatorid}&creatorUsername=${creatorUsername}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to delete reservation');
    }

    return await response.json();
  } catch (error) {
    console.error('API error:', error);
    throw error;
  }
};

//Book & Pay Log
export const fetchBookLog = async (userid) => {
  try {
    const response = await fetch(`${API_URL}/users/booklog?userid=${userid}`);

    if (!response.ok) {
      throw new Error('Failed to fetch book logs');
    }

    const data = await response.json();


    return data; 
  } catch (error) {
    console.error('API error fetching book logs:', error);
    throw error;
  }
};

// Fetch Finance 
export const fetchFinance = async (userid) => {
  try {
      const response = await fetch(`${API_URL}/users/finance?userid=${userid}`);
      const data = await response.json();
      return data; 
  } catch (error) {
      console.error('API error:', error);
      throw error;
  }
};

// Fetch Occupancy Rate
export const fetchOccupancyRate = async (userid) => {
  try {
      const response = await fetch(`${API_URL}/users/occupancy_rate?userid=${userid}`);
      const data = await response.json();
      return data; 
  } catch (error) {
      console.error('API error:', error);
      throw error;
  }
};

// Fetch Reservation per Available Room
export const fetchRevPAR = async (userid) => {
  try {
      const response = await fetch(`${API_URL}/users/RevPAR?userid=${userid}`);
      const data = await response.json();
      return data; 
  } catch (error) {
      console.error('API error:', error);
      throw error;
  }
};

// Fetch Cancellation Rate
export const fetchCancellationRate = async (userid) => {
  try {
      const response = await fetch(`${API_URL}/users/cancellation_rate?userid=${userid}`);
      const data = await response.json();
      return data; 
  } catch (error) {
      console.error('API error:', error);
      throw error;
  }
};

// Fetch Customer Retention Rate
export const fetchCustomerRetentionRate = async (userid) => {
  try {
      const response = await fetch(`${API_URL}/users/customer_retention_rate?userid=${userid}`);
      const data = await response.json();
      return data; 
  } catch (error) {
      console.error('API error:', error);
      throw error;
  }
};

// Fetch Guest Satisfaction Score
export const fetchGuestSatisfactionScore = async (userid) => {
  try {
      const response = await fetch(`${API_URL}/users/guest_satisfaction_score?userid=${userid}`);
      const data = await response.json();
      return data; 
  } catch (error) {
      console.error('API error:', error);
      throw error;
  }
};

// Fetch Average Length of Stay
export const fetchALOS = async (userid) => {
  try {
      const response = await fetch(`${API_URL}/users/alos?userid=${userid}`);
      const data = await response.json();
      return data; 
  } catch (error) {
      console.error('API error:', error);
      throw error;
  }
};

// Get Properties Of Administrator For "Suggest"
export const getOperatorProperties = async (userid, reservationid) => {
  try {
    const response = await fetch(`${API_URL}/operatorProperties/${userid}/${reservationid}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if(!response) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to get properties');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('API error: ', error);
    throw error;
  }
};

// Fetch normal user data
export const fetchUserData = async (userid) => {
  try {
    const response = await fetch(`${API_URL}/users/${userid}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch user data');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching user data:', error);
    throw error;
  }
};

// Fetch google user data
export const fetchGoogleUserData = async (accessToken) => {
  try {
      const response = await fetch(`https://www.googleapis.com/oauth2/v1/userinfo?access_token=${accessToken}`, {
          headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/json',
          },
      });

      if (!response.ok) {
          throw new Error('Failed to fetch Google user data');
      }

      const profile = await response.json();
      return profile;
  } catch (error) {
      console.error("Error fetching Google user data:", error);
      return null;
  }
};

// Update user profile
export const updateProfile = async (userData) => {
    const creatorid = localStorage.getItem("userid");
    const creatorUsername = localStorage.getItem("username");
    
    try {
        // Validate user ID
        if (!userData.userid) {
            throw new Error('User ID is missing');
        }
      
        const response = await fetch(`${API_URL}/users/updateProfile/${userData.userid}?creatorid=${creatorid}&creatorUsername=${creatorUsername}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(userData),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to update user profile');
        }

        return await response.json();
    } catch (error) {
        console.error('API error:', error);
        throw error;
    }
};

//Upload Avatar
export const uploadAvatar = async (userid, base64String) => {
    const creatorid = localStorage.getItem("userid");
    const creatorUsername = localStorage.getItem("username");
  
    try {
      if (!userid) {
        throw new Error('User ID is missing');
      }
  
      const response = await fetch(`${API_URL}/users/uploadAvatar/${userid}?creatorid=${creatorid}&creatorUsername=${creatorUsername}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uimage: base64String }), 
      });
  
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to upload avatar');
      }
  
      return data; 
    } catch (error) {
      console.error('API error:', error);
      throw error;
    }
  };

// Forgot Password
export const forgotPassword = async (email) => {
    try {
        const response = await fetch(`${API_URL}/forgot-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Reset password failed');
        }

        return data; 
    } catch (error) {
        console.error('Reset password request error:', error);
        throw error; 
    }
};


//Google Login
export const googleLogin = async (token) => {
    try {
        const response = await fetch(`${API_URL}/google-login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Server error response:", errorData);
            throw new Error(errorData.message || "Google Login Failed");
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Error in Google Login:", error);
        throw error;
    }
};

// Google Map
export const getCoordinates = async (location) => {
  const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=AIzaSyCe27HezKpItahXjMFcWXf3LwFcjI7pZFk`);
  const data = await response.json();
  if (data.results && data.results.length > 0) {
    const { lat, lng } = data.results[0].geometry.location;
    return { lat, lng };
  }
  throw new Error('Location not found');
};

// Assign Role
export const assignRole = async (userid, role) => {
  const creatorid = localStorage.getItem("userid");
  const creatorUsername = localStorage.getItem("username");

  const res = await fetch(
    `${API_URL}/users/assignRole/${userid}/${role}?creatorid=${creatorid}&creatorUsername=${creatorUsername}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }
  );

  const text = await res.text();
  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Server returned unexpected response:\n${text}`);
  }

  if (!res.ok) {
    throw new Error(data.message || JSON.stringify(data));
  }

  return data;
};

// Fetch Audit Trails
export const auditTrails = async (userid) => {
  try {
    const response = await fetch(`${API_URL}/auditTrails?userid=${userid}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if(!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to fetch audit trails');
    }

    const data = await response.json();
    return data.auditTrails;
  }catch (error) {
    console.error('API error: ', error);
    throw error;
  }
};

// Submit a review for a property
export const submitReview = async (reviewData) => {
  const creatorUsername = localStorage.getItem("username");
  
  try {
    const response = await fetch(`${API_URL}/reviews?creatorUsername=${creatorUsername}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reviewData),
    });

    console.log('Response status:', response.status);
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Server error response:', errorData);
      throw new Error(errorData.message || 'Failed to submit review');
    }

    return await response.json();
  } catch (error) {
    console.error('API error:', error);
    throw error;
  }
};

// Fetch reviews for a specific property
export const fetchReviews = async (propertyid) => {
  try {
    const response = await fetch(`${API_URL}/reviews/${propertyid}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch property reviews');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching property reviews:', error);
    throw error;
  }
};

export const fetchClusters = async () => {
  try {
    const response = await fetch(`${API_URL}/clusters`);
    return response.json();
  } catch (error) {
    console.error('Error fetching clusters:', error);
    throw error;
  }
};

// Fetch unique cluster names from the database
export const fetchClusterNames = async () => {
  try {
    const response = await fetch(`${API_URL}/clusters/names`);
    return response.json();
  } catch (error) {
    console.error('Error fetching cluster names:', error);
    throw error;
  }
};

// Fetch Suggested Reservations
export const suggestedReservations = async (userid) => {
  try {
    const response = await fetch(`${API_URL}/suggestedReservations/${userid}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to fetch suggested reservations');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('API error: ', error);
    throw error;
  }
};

// Fetch Published Reservations
export const publishedReservations = async (userid) => {
  try {
    const response = await fetch(`${API_URL}/publishedReservations/${userid}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to fetch published reservations');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('API error: ', error);
    throw error;
  }
};

// Add a new cluster
export const addCluster = async (clusterData) => {
  try {
    const response = await fetch(`${API_URL}/clusters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(clusterData),
    });

    return await response.json();
  } catch (error) {
    console.error('Error adding cluster:', error);
    throw error;
  }
};

// Update an existing cluster
export const updateCluster = async (clusterID, clusterData) => {
  try {
    const response = await fetch(`${API_URL}/clusters/${clusterID}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(clusterData),
    });

    return await response.json();
  } catch (error) {
    console.error('Error updating cluster:', error);
    throw error;
  }
};

// Delete a cluster
export const deleteCluster = async (clusterID) => {
  try {
    const response = await fetch(`${API_URL}/clusters/${clusterID}`, {
      method: 'DELETE',
    });

    return await response.json();
  } catch (error) {
    console.error('Error deleting cluster:', error);
    throw error;
  }
};

// Fetch Categories
export const fetchCategories = async () => {
  try {
    const response = await fetch(`${API_URL}/categories`);

    if (!response.ok) {
      throw new Error('Failed to fetch categories');
    }

    const data = await response.json();
    return data; 
  } catch (error) {
    console.error('Error fetching categories:', error);
    throw error; 
  }
};

// Payment Successful Notification
export const paymentSuccess = async (reservationid) => {
  const creatorid = localStorage.getItem("userid");
  const creatorUsername = localStorage.getItem("username");
  
  try {
    const response = await fetch(`${API_URL}/payment_success/${reservationid}?creatorid=${creatorid}&creatorUsername=${creatorUsername}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to send payment successful notification');
    }

    return await response.json();
  }catch (error) {
    console.error('API error: ', error);
    throw error;
  }
};

// add for checking date overlapping
export const checkDateOverlap = async (propertyId, checkIn) => {
  const creatorid = localStorage.getItem("userid");
  const creatorUsername = localStorage.getItem("username");

  try {
    const response = await fetch(`${API_URL}/check-date-overlap/${propertyId}?creatorid=${creatorid}&creatorUsername=${creatorUsername}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ checkIn }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to check date overlap');
    }

    const data = await response.json();
    return data.overlap;
  } catch (error) {
    console.error('API error:', error);
    throw error;
  }
};
