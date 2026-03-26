import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Register.css';

// Import Assets using ES Modules
import video from '../../../public/Sarawak_2.mp4';
import logo from '../../../public/Sarawak_icon.png';

// Import Icons
import { FaMailBulk, FaUserAlt, FaEyeSlash, FaPhoneAlt, FaUserCircle } from 'react-icons/fa';
import { RiLockPasswordFill, RiLockPasswordLine } from 'react-icons/ri';
import { IoEyeSharp } from "react-icons/io5";

// Import API function
import { signupUser } from '../../../../Api/api';

// Import Toast
import Toast from '../../../Component/Toast/Toast';
import VisualCaptcha from '../../../Component/VisualCaptcha/VisualCaptcha'; 

const Register = () => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isCaptchaValid, setIsCaptchaValid] = useState(false);
  const navigate = useNavigate();
  const userGroup = 'Customer';

  // Toast Function
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastType, setToastType] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Regex 
  const usernameRegex = /^[a-zA-Z0-9]*$/;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate username
    if (!usernameRegex.test(username)) {
      displayToast('error', 'Invalid Username. Use letters And Numbers.');
      return;
    }

    // Check if captcha is valid
    if (!isCaptchaValid) {
      displayToast('error', 'Please complete the verification code.');
      return;
    }

    // Validate email
    if (!emailRegex.test(email)) {
      displayToast('error', 'Invalid email format.');
      return;
    }

    // Validate password
    if (!passwordRegex.test(password)) {
      displayToast('error', 'Password must be 8+ chars, with letters & numbers.');
      return;
    }

    // Check if passwords match
    if (password !== confirmPassword) {
      displayToast('error', 'Passwords do not match.');
      return;
    }

    const userData = {
      firstName,
      lastName,
      username,
      email,
      password,
      uphoneno: phoneNumber,
      userGroup,
    };

    console.log(userData);
    console.log(phoneNumber);

    try {
      const response = await signupUser(userData);
      const data = await response.json(); 

      if (response.ok && data.success) {
        displayToast('success', 'Registration successful!');
        setTimeout(() => navigate('/login'), 1000);
      } else {
        displayToast('error', data.message || 'Error during registration.');
      }
    } catch (error) {
      console.error('Error during registration:', error);
      displayToast('error', 'An error occurred during registration.');
    }
  };

  // Function to display Toast
  const displayToast = (type, message) => {
    setToastType(type);
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  // Password Visibility Toggle
  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  return (
    <div className="registerPage flex">
      {showToast && <Toast type={toastType} message={toastMessage} />}

      <div className="container flex">
        <div className="videoDiv">
          <video src={video} autoPlay muted loop></video>
          <div className="textDiv">
            <h2 className="title_A">Hello Sarawak</h2>
            <h3 className="title_B">Your Journey Begins</h3>
          </div>
          <div className="footerDiv flex">
            <span className="text">Already Have Account?</span>
            <Link to={'/login'}>
              <button className="btn">Sign In</button>
            </Link>
          </div>
        </div>

        <div className="formDiv flex">
          <div className="headerDiv">
            <img src={logo} alt="Logo Image" />
            <div className="textDiv">
              <h3 className="title_C">
                Welcome To
                <br />
                Hello Sarawak
              </h3>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="form grid">
            <div className="inputDiv">
              <label htmlFor="firstName">First Name</label>
              <div className="input flex">
                <FaUserAlt className="icon" />
                <input
                  type="text"
                  id="firstName"
                  placeholder="Enter First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="inputDiv">
              <label htmlFor="lastName">Last Name</label>
              <div className="input flex">
                <FaUserAlt className="icon" />
                <input
                  type="text"
                  id="lastName"
                  placeholder="Enter Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="inputDiv">
              <label htmlFor="username">Username</label>
              <div className="input flex">
                <FaUserCircle className="icon" />
                <input
                  type="text"
                  id="username"
                  placeholder="Enter Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="inputDiv">
              <label htmlFor="email">Email</label>
              <div className="input flex">
                <FaMailBulk className="icon" />
                <input
                  type="email"
                  id="email"
                  placeholder="Enter Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="inputDiv">
              <label htmlFor="phoneNumber">Phone Number</label>
              <div className="input flex">
                <FaPhoneAlt className="icon" />
                <input
                  type="tel"
                  id="phoneNumber"
                  placeholder="Enter Phone Number"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="inputDiv">
              <label htmlFor="password">Password</label>
              <div className="input flex">
                <RiLockPasswordFill className="icon" />
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  placeholder="Enter Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                  {showPassword ? (
                   <IoEyeSharp
                    className="icon_eye" 
                    onClick={togglePasswordVisibility} />
                  ) : (
                   <FaEyeSlash
                    className="icon_eye" 
                    onClick={togglePasswordVisibility} />
                  )}
              </div>
            </div>

            <div className="inputDiv">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <div className="input flex">
                <RiLockPasswordLine className="icon" />
                <input
                  type={showPassword ? "text" : "password"}
                  id="confirmPassword"
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                  {showPassword ? (
                   <IoEyeSharp
                    className="icon_eye" 
                    onClick={togglePasswordVisibility} />
                  ) : (
                   <FaEyeSlash
                    className="icon_eye" 
                    onClick={togglePasswordVisibility} />
                  )}
              </div>
            </div>

            <VisualCaptcha onValidationChange={setIsCaptchaValid} />

          <div className="container_button">
            <button type="submit" className="btn"><span>Sign Up</span></button>
              <Link to={'/login'}>
                <button type="button" className="btn_responsive" style={{ marginTop: '10px' }}><span>Login</span></button>
              </Link>
          </div>

          </form>
        </div>
      </div>
    </div>
  );
};

export default Register;
