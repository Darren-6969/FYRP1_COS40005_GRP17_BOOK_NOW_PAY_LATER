import React, { useState, useEffect } from 'react';
import { fetchUserData, fetchGoogleUserData, uploadAvatar, updateProfile } from '../../../Api/api';
import Toast from '../Toast/Toast';
import { FaUser, FaLock, FaCamera, FaEye, FaEyeSlash } from 'react-icons/fa';
import './FrontUserProfile.css';
import eventBus from '../EventBus/Eventbus';
import Loader from '../../Component/Loader/Loader';
import { CountryDropdown } from 'react-country-region-selector';

const FrontUserProfile = () => {
    const [userData, setUserData] = useState({});
    const [previewAvatar, setPreviewAvatar] = useState('/avatar.png');
    const [toastMessage, setToastMessage] = useState('');
    const [showToast, setShowToast] = useState(false);
    const [toastType, setToastType] = useState('');
    const [activeTab, setActiveTab] = useState('personal');
    const [editingField, setEditingField] = useState(null);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [avatarKey, setAvatarKey] = useState(0);
    const [originalUserData, setOriginalUserData] = useState({});
    const [loading, setLoading] = useState(false);

    const userid = localStorage.getItem('userid');
    const usergroup = localStorage.getItem('usergroup');
    const googleAccessToken = localStorage.getItem('googleAccessToken');

    const handleCountryChange = (val) => {
        setUserData(prev => ({
            ...prev,
            ucountry: val
        }));
    };


    // Function to check user group and fetch user data only if the user is a Customer
    const fetchUserData_Customer = async () => {
        if (usergroup === 'Customer') {
            try {
                setLoading(true);
                const data = await fetchUserData(userid);
                setUserData(data);
                setOriginalUserData(data);

                let imageSrc;
                if (data.uimage) {
                    imageSrc = data.uimage.startsWith('http') ? data.uimage : `data:image/jpeg;base64,${data.uimage}`;
                } else if (googleAccessToken) {
                    const googleData = await fetchGoogleUserData(googleAccessToken);
                    imageSrc = googleData.picture;
                } else {
                    imageSrc = '/avatar.png';
                }

                setPreviewAvatar(imageSrc);
                localStorage.setItem("uimage", imageSrc);
            }

            catch (error) {
                displayToast('error', 'Error fetching user data');
            }

            finally {
                setLoading(false);
            }
        }

        else {
            setLoading(false);
            displayToast('error', 'User Not Logged In');
            return;
        }
    };

    useEffect(() => {
        fetchUserData_Customer();  // Only fetch if usergroup is Customer
    }, [userid, usergroup, googleAccessToken]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setUserData((prevUserData) => ({
            ...prevUserData,
            [name]: value
        }));
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
                    setOriginalUserData(updatedData);
                    let updatedAvatar = updatedData.uimage?.startsWith('http')
                        ? updatedData.uimage
                        : `data:image/jpeg;base64,${updatedData.uimage}` || '/avatar.png';
                    setPreviewAvatar(updatedAvatar);
                    localStorage.setItem("uimage", updatedAvatar);

                    eventBus.emit('avatarUpdated', updatedAvatar);
                } catch (error) {
                    displayToast('error', error.message || 'Failed to update avatar');
                }
            };

            img.src = objectUrl;
        }
    };

    const handleUpdate = async () => {
        const nameRegex = /^[A-Za-z\s]*$/;
        const usernameRegex = /^[a-zA-Z0-9]*$/;
        const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
        const phoneRegex = /^[0-9]*$/;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        try {
            // Field-specific validations
            if (editingField === 'name') {
                if (!userData.ufirstname?.trim() || !userData.ulastname?.trim()) {
                    throw new Error('First and last name cannot be empty');
                }
                if (!nameRegex.test(userData.ufirstname) || !nameRegex.test(userData.ulastname)) {
                    throw new Error('Name should only contain letters and spaces');
                }
            }

            if (editingField === 'phone') {
                if (!userData.uphoneno?.trim()) throw new Error('Phone cannot be empty');
                if (!phoneRegex.test(userData.uphoneno)) throw new Error('Phone number should contain only numbers');
            }

            if (editingField === 'username') {
                if (!usernameRegex.test(userData.username)) {
                    throw new Error('Username must be 6 - 15 characters (letters, numbers, underscores)');
                }
            }

            if (editingField === 'password') {
                if (password !== confirmPassword) throw new Error('Passwords do not match');
                if (!passwordRegex.test(password)) {
                    throw new Error('Password must be 6-20 characters with at least 1 letter and 1 number');
                }
                // Update password in userData
                setUserData((prev) => ({ ...prev, password })); // Update password directly
            }

            if (editingField === 'email') {
                if (!userData.uemail?.trim()) throw new Error('Email cannot be empty');
                if (!emailRegex.test(userData.uemail)) throw new Error('Please enter a valid email address');
            }

            if (editingField === 'dob') {
                if (!userData.udob?.trim()) throw new Error('Date of birth cannot be empty');
            }

            if (editingField === 'country') {
                if (!userData.ucountry?.trim()) throw new Error('Country cannot be empty');
            }

            const dataToUpdate = { ...userData };
            if (editingField === 'password') {
                dataToUpdate.password = password;
            }

            const response = await updateProfile(dataToUpdate);
            if (!response.success) throw new Error('Failed to update profile');

            displayToast('success', 'Profile updated successfully');
            setEditingField(null);
            setPassword('');
            setConfirmPassword('');

            const updatedData = await fetchUserData(userid);
            setUserData(updatedData);
            setOriginalUserData(updatedData);

        } catch (error) {
            displayToast('error', error.message);
        }
    };

    const cancelEditing = () => {
        setEditingField(null);
        setPassword('');
        setConfirmPassword('');
        setUserData(originalUserData);
    };

    

    const displayToast = (type, message) => {
        setToastType(type);
        setToastMessage(message);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 5000);
    };

    return (
        <div className="front-profile-container">
            {showToast && <Toast type={toastType} message={toastMessage} />}

            {loading ? (
                <div className="loader-box">
                    <Loader />
                </div>
            ) : (
                <div className="front-profile-layout">
                    <div className="front-sidebar-card">
                        <div className={`front-tab ${activeTab === 'personal' ? 'active' : ''}`}
                            onClick={() => setActiveTab('personal')}>
                            <FaUser className="front-tab-icon" /> Personal details
                        </div>
                        <div className={`front-tab ${activeTab === 'security' ? 'active' : ''}`}
                            onClick={() => setActiveTab('security')}>
                            <FaLock className="front-tab-icon" /> Security settings
                        </div>
                    </div>

                    <div className="front-content-card">
                        {activeTab === 'personal' && (
                            <>
                                <h2>Personal details</h2>
                                <div className="front-profile-field">
                                    <span className="front-field-label">Avatar</span>
                                    <div className="front-field-value">
                                        <img src={previewAvatar} alt="User Avatar" className="front-avatar-image" />
                                    </div>
                                    <span className="front-edit-link"
                                        onClick={() => document.getElementById('avatar-upload').click()}>
                                        Edit
                                    </span>
                                    <input id="avatar-upload" type="file" accept="image/*"
                                        onChange={handleAvatarChange} style={{ display: 'none' }} />
                                </div>

                                {/* Name Field */}
                                <div className="front-profile-field">
                                    <span className="front-field-label">Name</span>
                                    <span className="front-field-value">
                                        {(userData.ufirstname || userData.ulastname)
                                            ? `${userData.ufirstname || ''} ${userData.ulastname || ''}`.trim()
                                            : 'Not provided'}
                                    </span>

                                    <span className="front-edit-link"
                                        onClick={() => editingField === 'name' ? cancelEditing() : setEditingField('name')}>
                                        {editingField === 'name' ? 'Cancel' : 'Edit'}
                                    </span>
                                </div>
                                {editingField === 'name' && (
                                    <div className="front-edit-section">
                                        <input type="text" name="ufirstname" placeholder="First Name"
                                            value={userData.ufirstname || ''} onChange={handleInputChange} />
                                        <input type="text" name="ulastname" placeholder="Last Name"
                                            value={userData.ulastname || ''} onChange={handleInputChange} />
                                        <button onClick={handleUpdate}>Save</button>
                                    </div>
                                )}

                                {/* Email Field */}
                                <div className="front-profile-field">
                                    <span className="front-field-label">Email Address</span>
                                    <span className="front-field-value">{userData.uemail || 'Not provided'}</span>
                                    <span className="front-edit-link"
                                        onClick={() => editingField === 'email' ? cancelEditing() : setEditingField('email')}>
                                        {editingField === 'email' ? 'Cancel' : 'Edit'}
                                    </span>
                                </div>
                                {editingField === 'email' && (
                                    <div className="front-edit-section">
                                        <input type="email" name="uemail" placeholder="Email Address"
                                            value={userData.uemail || ''} onChange={handleInputChange} />
                                        <button onClick={handleUpdate}>Save</button>
                                    </div>
                                )}

                                {/* Title Field */}
                                <div className="front-profile-field">
                                    <span className="front-field-label">Title</span>
                                    <span className="front-field-value">
                                        {userData.utitle || 'Not provided'}
                                    </span>
                                    <span
                                        className="front-edit-link"
                                        onClick={() => editingField === 'title' ? cancelEditing() : setEditingField('title')}
                                    >
                                        {editingField === 'title' ? 'Cancel' : 'Edit'}
                                    </span>
                                </div>
                                {editingField === 'title' && (
                                    <div className="front-edit-section">
                                        <select
                                            name="utitle"
                                            value={userData.utitle || ''}
                                            onChange={handleInputChange}
                                            className="front-select-dropdown"
                                        >
                                            <option value="">Select Title</option>
                                            <option value="Mr.">Mr.</option>
                                            <option value="Mrs.">Mrs.</option>
                                            <option value="Ms.">Ms.</option>
                                            <option value="Miss">Miss</option>
                                            <option value="Madam">Madam</option>
                                        </select>
                                        <button onClick={handleUpdate}>Save</button>
                                    </div>
                                )}

                                {/* Gender Field */}
                                <div className="front-profile-field">
                                    <span className="front-field-label">Gender</span>
                                    <span className="front-field-value">
                                        {userData.ugender || 'Not provided'}
                                    </span>
                                    <span
                                        className="front-edit-link"
                                        onClick={() => editingField === 'gender' ? cancelEditing() : setEditingField('gender')}
                                    >
                                        {editingField === 'gender' ? 'Cancel' : 'Edit'}
                                    </span>
                                </div>
                                {editingField === 'gender' && (
                                    <div className="front-edit-section">
                                        <select
                                            name="ugender"
                                            value={userData.ugender || ''}
                                            onChange={handleInputChange}
                                            className="front-select-dropdown"
                                        >
                                            <option value="">Select Gender</option>
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                            <option value="Other">Other</option>
                                        </select>
                                        <button onClick={handleUpdate}>Save</button>
                                    </div>
                                )}


                                {/* Phone Field */}
                                <div className="front-profile-field">
                                    <span className="front-field-label">Phone Number</span>
                                    <span className="front-field-value">{userData.uphoneno || 'Not provided'}</span>
                                    <span className="front-edit-link"
                                        onClick={() => editingField === 'phone' ? cancelEditing() : setEditingField('phone')}>
                                        {editingField === 'phone' ? 'Cancel' : 'Edit'}
                                    </span>
                                </div>
                                {editingField === 'phone' && (
                                    <div className="front-edit-section">
                                        <input type="text" name="uphoneno" placeholder="Phone Number"
                                            value={userData.uphoneno || ''} onChange={handleInputChange} />
                                        <button onClick={handleUpdate}>Save</button>
                                    </div>
                                )}

                                {/* Date of Birth Field */}
                                <div className="front-profile-field">
                                    <span className="front-field-label">Date of Birth</span>
                                    <span className="front-field-value">{userData.udob || 'Not provided'}</span>
                                    <span className="front-edit-link"
                                        onClick={() => editingField === 'dob' ? cancelEditing() : setEditingField('dob')}>
                                        {editingField === 'dob' ? 'Cancel' : 'Edit'}
                                    </span>
                                </div>
                                {editingField === 'dob' && (
                                    <div className="front-edit-section">
                                        <input type="date" name="udob"
                                            value={userData.udob || ''} onChange={handleInputChange} />
                                        <button onClick={handleUpdate}>Save</button>
                                    </div>
                                )}

                                {/* Country Field */}
                                <div className="front-profile-field">
                                    <span className="front-field-label">Country</span>
                                    <span className="front-field-value">{userData.ucountry || 'Not provided'}</span>
                                    <span
                                        className="front-edit-link"
                                        onClick={() => editingField === 'country' ? cancelEditing() : setEditingField('country')}
                                    >
                                        {editingField === 'country' ? 'Cancel' : 'Edit'}
                                    </span>
                                </div>
                                {editingField === 'country' && (
                                    <div className="front-edit-section">
                                        <CountryDropdown className='country-dropdown'
                                            value={userData.ucountry || ''}
                                            onChange={handleCountryChange}
                                        />
                                        <button onClick={handleUpdate}>Save</button>
                                    </div>
                                )}
                            </>
                        )}

                        {activeTab === 'security' && (
                            <>
                                <h2>Security settings</h2>

                                {/* Username Field */}
                                <div className="front-profile-field">
                                    <span className="front-field-label">Username</span>
                                    <span className="front-field-value">{userData.username || 'Not provided'}</span>
                                    <span className="front-edit-link"
                                        onClick={() => editingField === 'username' ? cancelEditing() : setEditingField('username')}>
                                        {editingField === 'username' ? 'Cancel' : 'Edit'}
                                    </span>
                                </div>
                                {editingField === 'username' && (
                                    <div className="front-edit-section">
                                        <input type="text" name="username" placeholder="Username"
                                            value={userData.username || ''} onChange={handleInputChange} />
                                        <button className="front-save-button" onClick={handleUpdate}>Save</button>
                                    </div>
                                )}

                                {/* Password Field */}
                                <div className="front-profile-field">
                                    <span className="front-field-label">Password</span>
                                    <span className="front-field-value">
                                        {editingField !== 'password' ? '********' : 'Enter new password'}
                                    </span>
                                    <span className="front-edit-link"
                                        onClick={() => editingField === 'password' ? cancelEditing() : setEditingField('password')}>
                                        {editingField === 'password' ? 'Cancel' : 'Edit'}
                                    </span>
                                </div>
                                {editingField === 'password' && (
                                    <div className="front-edit-section">
                                        <div className="front-password-field">
                                            <input type={showPassword ? 'text' : 'password'}
                                                placeholder="New Password"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)} />
                                            {showPassword ? (
                                                <FaEye className="front-eye-icon" onClick={() => setShowPassword(false)} />
                                            ) : (
                                                <FaEyeSlash className="front-eye-icon" onClick={() => setShowPassword(true)} />
                                            )}
                                        </div>
                                        <div className="front-password-field">
                                            <input type={showConfirmPassword ? 'text' : 'password'}
                                                placeholder="Confirm Password"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)} />
                                            {showConfirmPassword ? (
                                                <FaEye className="front-eye-icon" onClick={() => setShowConfirmPassword(false)} />
                                            ) : (
                                                <FaEyeSlash className="front-eye-icon" onClick={() => setShowConfirmPassword(true)} />
                                            )}
                                        </div>
                                        <button onClick={handleUpdate}>Save</button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default FrontUserProfile;
