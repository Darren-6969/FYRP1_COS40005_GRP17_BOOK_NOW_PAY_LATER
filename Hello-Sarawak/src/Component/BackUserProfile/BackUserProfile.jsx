import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchGoogleUserData, fetchUserData, updateProfile, uploadAvatar } from '../../../Api/api';
import Toast from '../Toast/Toast';
import Loader from '../../Component/Loader/Loader';
import './BackUserProfile.css';
import { FaUser, FaLock, FaCamera, FaEye, FaEyeSlash, FaPaypal } from 'react-icons/fa';
import { CountryDropdown } from 'react-country-region-selector';

const BackUserProfile = () => {
    const navigate = useNavigate();
    const [userData, setUserData] = useState({});
    const [avatar, setAvatar] = useState(null);
    const [previewAvatar, setPreviewAvatar] = useState('');
    const [toastMessage, setToastMessage] = useState('');
    const [showToast, setShowToast] = useState(false);
    const [toastType, setToastType] = useState('');
    const [activeTab, setActiveTab] = useState('account');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [decryptedPassword, setDecryptedPassword] = useState('');
    const [passwordInput, setPasswordInput] = useState('');
    const [avatarKey, setAvatarKey] = useState(0); // Added missing state variable

    const userid = localStorage.getItem('userid');
    const googleAccessToken = localStorage.getItem('googleAccessToken');
    // const plainPassword = localStorage.getItem('plainPassword');

    const API_URL = import.meta.env.VITE_API_URL;

    const generateRandomNumber = () => Math.floor(100000 + Math.random() * 900000);

    const fetchDecryptedPassword = async () => {
        if (!userid || isNaN(userid)) {
            displayToast('error', 'Invalid or missing user ID');
            return;
        }

        try {
            const response = await fetch(`${API_URL}/users/getDecryptedPassword/${userid}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const data = await response.json();
            if (data.success && data.password) {
                setDecryptedPassword(data.password);
                setPasswordInput(data.password);
                localStorage.setItem('plainPassword', data.password);
            } else {
                setDecryptedPassword('');
                setPasswordInput('');
            }
        } catch (error) {
            console.error('Error fetching decrypted password:', error);
        }
    };

    const isPayPalEligible = () => {
        return userData.usergroup === 'Administrator' || userData.usergroup === 'Moderator';
    };

    useEffect(() => {
        const loadUserDetails = async () => {
            setIsLoading(true);
            if (!userid || isNaN(userid)) {
                displayToast('error', 'Invalid or missing user ID');
                setIsLoading(false);
                return;
            }

            try {
                const data = await fetchUserData(userid);

                if (!data.username) {
                    const randomNumber = generateRandomNumber();
                    data.username = data.ufirstname ? `${data.ufirstname}_${randomNumber}` : `user_${randomNumber}`;
                }

                if (data.udob) {
                    data.udob = new Date(data.udob).toISOString().split('T')[0];
                }

                let imageSrc = '../../public/avatar.png';
                if (data.uimage) {
                    imageSrc = data.uimage.startsWith('http') 
                        ? data.uimage 
                        : `data:image/jpeg;base64,${data.uimage}`;
                }

                const defaultData = {
                    ufirstname: data.ufirstname || 'Not Provided',
                    ulastname: data.ulastname || 'Not Provided',
                    uemail: data.uemail || 'Not Provided',
                    uphoneno: data.uphoneno || 'Not Provided',
                    uzipcode: data.uzipcode || 'Not Provided',
                    username: data.username || 'Not Provided',
                    ugender: data.ugender || 'Not Provided',
                    udob: data.udob || 'Not Provided',
                    utitle: data.utitle || 'Not Provided',
                    ucountry: data.ucountry || 'Not Provided',
                    paypalid: data.paypalid || 'Not Provided',
                    userGroup: data.usergroup || '',
                    ...data,
                    password: googleAccessToken ? '' : (decryptedPassword || ''),
                };

                setUserData(defaultData);
                setPreviewAvatar(imageSrc);
            } catch (error) {
                displayToast('error', 'Error fetching user data');
            }
            setIsLoading(false);
        };

        fetchDecryptedPassword();

        if (googleAccessToken) {
            fetchGoogleUserData(googleAccessToken)
                .then((profile) => {
                    setUserData((prevUserData) => {
                        const randomNumber = generateRandomNumber();
                        const updatedUserData = {
                            ...prevUserData,
                            ufirstname: profile.given_name || 'Not Provided',
                            ulastname: profile.family_name || 'Not Provided',
                            uemail: profile.email || 'Not Provided',
                        };

                        if (!prevUserData.username || prevUserData.username === 'Not Provided') {
                            updatedUserData.username = profile.given_name
                                ? `${profile.given_name}_${randomNumber}`
                                : `user_${randomNumber}`;
                        }

                        if (!prevUserData.uimage) {
                            updatedUserData.uimage = profile.picture;
                            setPreviewAvatar(profile.picture);
                        }

                        return updatedUserData;
                    });
                })
                .catch(() => displayToast('error', 'Error fetching Google profile'));
        }

        loadUserDetails();
    }, [userid, googleAccessToken, decryptedPassword]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setUserData((prevUserData) => ({
            ...prevUserData,
            [name]: value === 'Not Provided' ? '' : value
        }));
    };

    const handleFocus = (e) => {
        const { name, value } = e.target;
        if (value === 'Not Provided') {
            setUserData((prevUserData) => ({
                ...prevUserData,
                [name]: ''
            }));
        }
    };

    const handleBlur = (e) => {
        const { name, value } = e.target;
        if (!value.trim()) {
            setUserData((prevUserData) => ({
                ...prevUserData,
                [name]: 'Not Provided'
            }));
        }
    };

   const handleAvatarChange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            const img = new Image();
            const objectUrl = URL.createObjectURL(file);

            img.onload = async () => {
                URL.revokeObjectURL(objectUrl);

                const maxWidth = 300;
                const maxHeight = 300;
                let width = img.width;
                let height = img.height;

                if (width > maxWidth || height > maxHeight) {
                    if (width > height) {
                        height = Math.round(height * (maxWidth / width));
                        width = maxWidth;
                    } else {
                        width = Math.round(width * (maxHeight / height));
                        height = maxHeight;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const resizedImage = canvas.toDataURL('image/jpeg', 0.7);
                const base64String = resizedImage.split(',')[1];

                setPreviewAvatar(resizedImage);
                setUserData((prevData) => ({ ...prevData, uimage: base64String }));
                setAvatarKey(prev => prev + 1);

                try {
                    const response = await uploadAvatar(userid, base64String);
                    displayToast('success', 'Avatar updated successfully');

                    const updatedData = await fetchUserData(userid);
                    setUserData(updatedData);
                    let updatedAvatar = updatedData.uimage?.startsWith('http')
                        ? updatedData.uimage
                        : `data:image/jpeg;base64,${updatedData.uimage}` || '/avatar.png';
                    setPreviewAvatar(updatedAvatar);
                    localStorage.setItem("uimage", updatedAvatar);

                    if (typeof eventBus !== 'undefined' && eventBus.emit) {
                        eventBus.emit('avatarUpdated', updatedAvatar);
                    }
                } catch (error) {
                    displayToast('error', error.message || 'Failed to update avatar');
                }
            };

            img.src = objectUrl;
        }
    };
    
   const handleAvatarUpload = async () => {
        try {
            if (!userData.uimage) {
                throw new Error('No processed image data available');
            }

            setIsLoading(true);
        
            const pureBase64 = userData.uimage.includes(',') 
                ? userData.uimage.split(',')[1] 
                : userData.uimage;

            const response = await uploadAvatar(userid, pureBase64);
        
            if (response.success) {

                const updatedData = await fetchUserData(userid);
                setUserData(updatedData);

                const updatedAvatar = updatedData.uimage.startsWith('http') 
                    ? updatedData.uimage 
                    : `data:image/jpeg;base64,${updatedData.uimage}`;
            
                setPreviewAvatar(updatedAvatar);
                displayToast('success', 'Avatar updated successfully');
            
            }
        } catch (error) {
            displayToast('error', error.message || 'Avatar upload failed');
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdate = async () => {
        const nameRegex = /^[A-Za-z\s]*$/;
        const usernameRegex = /^[a-zA-Z0-9_]{6,15}$/;
        const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
        const phoneRegex = /^[0-9]{10,15}$/;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        try {

            const payload = Object.keys(userData).reduce((acc, key) => {
                acc[key] = userData[key] === 'Not Provided' ? '' : userData[key];
                return acc;
            }, {});
            
            payload.userid = userid;
            console.log('Full payload being sent:', payload);

            if (activeTab === 'account') {
                if (payload.ufirstname && !nameRegex.test(payload.ufirstname)) {
                    throw new Error('First name should only contain letters and spaces');
                }
                if (payload.ulastname && !nameRegex.test(payload.ulastname)) {
                    throw new Error('Last name should only contain letters and spaces');
                }
                if (payload.uphoneno && !phoneRegex.test(payload.uphoneno)) {
                    throw new Error('Phone number should contain 10-15 digits');
                }
                if (payload.uemail && !emailRegex.test(payload.uemail)) {
                    throw new Error('Please enter a valid email address');
                }
            } 
            
            else if (activeTab === 'security') {
                if (payload.username && !usernameRegex.test(payload.username)) {
                    throw new Error('Username must be 6-15 characters (letters, numbers, underscores)');
                }
                payload.password = passwordInput;
            }

            else if(activeTab == 'payment'){
                    if (isPayPalEligible() && payload.paypalid && !emailRegex.test(payload.paypalid)) {
                    throw new Error('Invalid PayPal email address');
                }
            }

            const response = await updateProfile(payload);

            if (!response.success) {
                throw new Error(response.message || 'Failed to update profile');
            }

            const originalData = await fetchUserData(userid); 
            const originalUsername = originalData.username || 'Not Provided';
            const originalPassword = originalData.password || ''; 

            const usernameChanged = payload.username && payload.username !== originalUsername && activeTab === 'security';
            const passwordChanged = payload.password && payload.password !== originalPassword && activeTab === 'security';

            let updateMessage = 'Profile updated successfully';
            let shouldLogout = false;

            if (usernameChanged || passwordChanged) {
                updateMessage = 'Profile updated successfully. You must login again to reflect your changes';
                shouldLogout = true;
            }

            displayToast('success', updateMessage);

            if (shouldLogout) {
                setTimeout(() => {
                    localStorage.clear();  
                    navigate('/login');    
                }, 5000); 
            }

        } catch (error) {
            console.error('Update Error:', error);
            displayToast('error', error.message);
        }
    };

    const displayToast = (type, message) => {
        setToastType(type);
        setToastMessage(message);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 5000);
    };

    const handleCountryChange = (val) => {
        setUserData((prevUserData) => ({
            ...prevUserData,
            ucountry: val === 'Not Provided' ? '' : val,
        }));
    };

    const isGoogleLogin = !!googleAccessToken;

    return (
        <div className="back-profile-container">
            {showToast && <Toast type={toastType} message={toastMessage} />}
            {isLoading ? (
                <div className="loader-box">
                    <Loader />
                </div>
            ) : (
                <div className="back-profile-grid">
                    <div className="back-profile-left-column">
                        <div className="back-profile-avatar-section">
                            <div className="back-profile-avatar-wrapper">
                                <img
                                    src={previewAvatar || '/avatar.png'}
                                    alt="User Avatar"
                                    className="back-profile-avatar-image"
                                />
                                <label htmlFor="avatar-upload" className="back-profile-camera-icon">
                                    <FaCamera />
                                    <input
                                        id="avatar-upload"
                                        type="file"
                                        accept="image/*"
                                        onChange={handleAvatarChange}
                                        style={{ display: 'none' }}
                                    />
                                </label>
                            </div>
                            <div className="back-user-name">
                                <h2>{userData.ufirstname === 'Not Provided' ? '' : userData.ufirstname} {userData.ulastname === 'Not Provided' ? '' : userData.ulastname}</h2>
                                {userData.userGroup && <p className="user-group-label">{userData.userGroup}</p>}
                            </div>
                            <button type="button" className="back-profile-save-avatar-button" onClick={handleAvatarUpload}>
                                Save Avatar
                            </button>
                        </div>
                    </div>

                    <div className="back-profile-right-column">
                        <div className="back-profile-tabs">
                            <button className={`back-profile-tab-button ${activeTab === 'account' ? 'active' : ''}`} onClick={() => setActiveTab('account')}>
                                <FaUser /> Account Settings
                            </button>
                            <button className={`back-profile-tab-button ${activeTab === 'security' ? 'active' : ''}`} onClick={() => setActiveTab('security')}>
                                <FaLock /> Security
                            </button>
                            {isPayPalEligible() && (
                                <button className={`back-profile-tab-button ${activeTab === 'payment' ? 'active' : ''}`} onClick={() => setActiveTab('payment')}>
                                    <FaPaypal /> Payment Info
                                </button>
                            )}
                        </div>

                        <div className="back-profile-tab-content">
                            {activeTab === 'account' && (
                                <form className="back-profile-form">
                                    <div className="back-profile-form-group">
                                        <label>First Name</label>
                                        <input 
                                            type="text" 
                                            name="ufirstname" 
                                            value={userData.ufirstname === 'Not Provided' ? '' : userData.ufirstname} 
                                            onChange={handleInputChange}
                                            onFocus={handleFocus}
                                            onBlur={handleBlur}
                                            placeholder="Not Provided"
                                        />
                                    </div>
                                    <div className="back-profile-form-group">
                                        <label>Last Name</label>
                                        <input 
                                            type="text" 
                                            name="ulastname" 
                                            value={userData.ulastname === 'Not Provided' ? '' : userData.ulastname} 
                                            onChange={handleInputChange}
                                            onFocus={handleFocus}
                                            onBlur={handleBlur}
                                            placeholder="Not Provided"
                                        />
                                    </div>
                                    <div className="back-profile-form-group">
                                        <label>Date of Birth</label>
                                        <input 
                                            type="date" 
                                            name="udob" 
                                            value={userData.udob === 'Not Provided' ? '' : userData.udob} 
                                            onChange={handleInputChange}
                                            onFocus={handleFocus}
                                            onBlur={handleBlur}
                                        />
                                    </div>
                                    <div className="back-profile-form-group">
                                        <label>Title</label>
                                        <select 
                                            name="utitle" 
                                            value={userData.utitle === 'Not Provided' ? '' : userData.utitle} 
                                            onChange={handleInputChange}
                                        >
                                            <option value="">Not Provided</option>
                                            <option value="Mr.">Mr.</option>
                                            <option value="Mrs.">Mrs.</option>
                                            <option value="Ms.">Ms.</option>
                                            <option value="Miss">Miss</option>
                                            <option value="Madam">Madam</option>
                                        </select>
                                    </div>
                                    <div className="back-profile-form-group">
                                        <label>Gender</label>
                                        <select 
                                            name="ugender" 
                                            value={userData.ugender === 'Not Provided' ? '' : userData.ugender} 
                                            onChange={handleInputChange}
                                        >
                                            <option value="">Not Provided</option>
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                    <div className="back-profile-form-group">
                                        <label>Email</label>
                                        <input 
                                            type="email" 
                                            name="uemail" 
                                            value={userData.uemail === 'Not Provided' ? '' : userData.uemail} 
                                            readOnly 
                                            placeholder="Not Provided"
                                        />
                                    </div>
                                    <div className="back-profile-form-group">
                                        <label>Phone Number</label>
                                        <input 
                                            type="text" 
                                            name="uphoneno" 
                                            value={userData.uphoneno === 'Not Provided' ? '' : userData.uphoneno} 
                                            onChange={handleInputChange}
                                            onFocus={handleFocus}
                                            onBlur={handleBlur}
                                            placeholder="Not Provided"
                                        />
                                    </div>
                                    <div className="back-profile-form-group">
                                        <label>Country</label>
                                        <CountryDropdown 
                                            value={userData.ucountry === 'Not Provided' ? '' : userData.ucountry} 
                                            onChange={handleCountryChange} 
                                            classes="country-dropdown"
                                            valueType="short"
                                        />
                                    </div>
                                    <div className="back-profile-form-group">
                                        <label>Zip Code</label>
                                        <input 
                                            type="text" 
                                            name="uzipcode" 
                                            value={userData.uzipcode === 'Not Provided' ? '' : userData.uzipcode} 
                                            onChange={handleInputChange}
                                            onFocus={handleFocus}
                                            onBlur={handleBlur}
                                            placeholder="Not Provided"
                                        />
                                    </div>
                                    <button type="button" className="back-profile-update-button" onClick={handleUpdate}>
                                        Update Profile
                                    </button>
                                </form>
                            )}

                            {activeTab === 'security' && (
                                <form className="back-profile-form">
                                    <div className="back-profile-form-group">
                                        <label>Username</label>
                                        <input 
                                            type="text" 
                                            name="username" 
                                            value={userData.username === 'Not Provided' ? '' : userData.username} 
                                            onChange={handleInputChange}
                                            onFocus={handleFocus}
                                            onBlur={handleBlur}
                                            placeholder="Not Provided"
                                        />
                                    </div>
                                    <div className="back-profile-form-group">
                                        <label>Password</label>
                                        <div className="back-password-input-wrapper">
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                name="password"
                                                value={passwordInput}
                                                onChange={e => setPasswordInput(e.target.value)}
                                                className="back-password-input"
                                                placeholder="Enter new password"
                                            />
                                            <span className="back-password-toggle-icon" onClick={() => setShowPassword(!showPassword)}>
                                                {showPassword ? <FaEye /> : <FaEyeSlash />}
                                            </span>
                                        </div>
                                    </div>
                                    <button type="button" className="back-profile-update-button" onClick={handleUpdate}>
                                        Update Profile
                                    </button>
                                </form>
                            )}

                            {activeTab === 'payment' && isPayPalEligible() && (
                                <form className="back-profile-form">
                                    <div className="back-profile-form-group">
                                        <label>PayPal Email</label>
                                        <div className="back-paypal-input-wrapper">
                                            <input 
                                                type="email" 
                                                name="paypalid" 
                                                value={userData.paypalid === 'Not Provided' ? '' : userData.paypalid} 
                                                onChange={handleInputChange}
                                                onFocus={handleFocus}
                                                onBlur={handleBlur}
                                                placeholder="example@example.com"
                                                className="back-paypal-input"
                                            />
                                        </div>
                                    </div>
                                    <div className="back-profile-payment-info">
                                        <h3>Payment Information</h3>
                                        <p>As a {userData.userGroup}, you are required to provide your PayPal account for receiving payments.</p>
                                    </div>
                                    <button type="button" className="back-profile-update-button" onClick={handleUpdate}>
                                        Update PayPal Information
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BackUserProfile;
