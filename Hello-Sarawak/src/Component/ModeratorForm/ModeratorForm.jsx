import React, { useState, useEffect } from "react";
import { createModerator, updateUser } from "../../../Api/api"; 
import { FaUserCircle, FaUserAlt, FaMailBulk } from 'react-icons/fa';
import { RiLockPasswordFill, RiLockPasswordLine, RiGlobalLine } from 'react-icons/ri';
import { MdCall } from 'react-icons/md';
import Toast from "../Toast/Toast";
import "./ModeratorForm.css";

const ModeratorForm = ({ initialData, onSubmit, onClose }) => {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [phoneNo, setPhoneNo] = useState('');
    const [country, setCountry] = useState('');
    const [title, setTitle] = useState('');
    const [toastMessage, setToastMessage] = useState('');
    const [showToast, setShowToast] = useState(false);
    const [toastType, setToastType] = useState('');

    useEffect(() => {
       
        console.log('initialData:', initialData);

        if (initialData) {
            setFirstName(initialData.ufirstname || '');
            setLastName(initialData.ulastname || '');
            setUsername(initialData.username || '');
            setEmail(initialData.uemail || '');
            setPhoneNo(initialData.uphoneno || '');
            setCountry(initialData.ucountry || '');
            setTitle(initialData.utitle || '');
            setPassword(''); 
            setConfirmPassword(''); 
        } else {
            setFirstName('');
            setLastName('');
            setUsername('');
            setEmail('');
            setPhoneNo('');
            setCountry('');
            setTitle('');
            setPassword('');
            setConfirmPassword('');
        }
    }, [initialData]);

    const displayToast = (type, message) => {
        setToastType(type);
        setToastMessage(message);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 5000);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            displayToast('error', 'Passwords do not match!');
            return;
        }

        const creatorid = localStorage.getItem("userid");
        const creatorUsername = localStorage.getItem("username");

        const userData = {
            firstName,
            lastName,
            username,
            email,
            password,
            phoneNo,
            country,
            title,
            usergroup: "Moderator",
            uactivation: "Active",
            creatorid,
            creatorUsername,
        };

        try {
            let response;
            if (initialData) {
                response = await updateUser(userData, initialData.userid);
            } else {
                response = await createModerator(userData);
            }

            if (response && response.message) {
                displayToast('success', response.message);
            }

            if (onSubmit) {
                onSubmit();
            }
        } catch (error) {
            displayToast('error', `Error: ${error.message}`);
        }
    };

    return (
        <div className="moderator-form-overlay">
            <div className="moderator-form-content">
                <h1>{initialData ? 'Edit User' : 'Create Moderator'}</h1>
                <button onClick={onClose} className="moderator-form-close-button">×</button>
                <form onSubmit={handleSubmit} className="form">
                    <div className="inputDiv">
                        <label htmlFor="firstName">First Name</label>
                        <div className="input">
                            <FaUserCircle className="icon" />
                            <input
                                type="text"
                                name="firstName"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                required
                            />
                        </div>
                    </div>
                    <div className="inputDiv">
                        <label htmlFor="lastName">Last Name</label>
                        <div className="input">
                            <FaUserCircle className="icon" />
                            <input
                                type="text"
                                name="lastName"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                required
                            />
                        </div>
                    </div>
                    <div className="inputDiv">
                        <label htmlFor="username">Username</label>
                        <div className="input">
                            <FaUserAlt className="icon" />
                            <input
                                type="text"
                                name="username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                readOnly={!!initialData}
                                required
                            />
                        </div>
                    </div>
                    <div className="inputDiv">
                        <label htmlFor="email">Email</label>
                        <div className="input">
                            <FaMailBulk className="icon" />
                            <input
                                type="email"
                                name="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                    </div>
                    <div className="inputDiv">
                        <label htmlFor="password">Password</label>
                        <div className="input">
                            <RiLockPasswordFill className="icon" />
                            <input
                                type="password"
                                name="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                readOnly={!!initialData}
                                required={!initialData}
                            />
                        </div>
                    </div>
                    <div className="inputDiv">
                        <label htmlFor="confirmPassword">Confirm Password</label>
                        <div className="input">
                            <RiLockPasswordLine className="icon" />
                            <input
                                type="password"
                                name="confirmPassword"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                readOnly={!!initialData}
                                required={!initialData}
                            />
                        </div>
                    </div>
                    <div className="inputDiv">
                        <label htmlFor="phoneNo">Phone No</label>
                        <div className="input">
                            <MdCall className="icon" />
                            <input
                                type="text"
                                name="phoneNo"
                                value={phoneNo}
                                onChange={(e) => setPhoneNo(e.target.value)}
                                required
                            />
                        </div>
                    </div>
                    <div className="inputDiv">
                        <label htmlFor="country">Country</label>
                        <div className="input">
                            <RiGlobalLine className="icon" />
                            <input
                                type="text"
                                name="country"
                                value={country}
                                onChange={(e) => setCountry(e.target.value)}
                                required
                            />
                        </div>
                    </div>
                    <button type="submit" className="moderator-form-submit-button">
                        Submit
                    </button>
                </form>
                {showToast && <Toast type={toastType} message={toastMessage} />}
            </div>
        </div>
    );
};

export default ModeratorForm;
