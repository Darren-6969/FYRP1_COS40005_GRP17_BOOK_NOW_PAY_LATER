import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Login.css';

// Import Assets
import video from '../../../public/Sarawak_2.mp4';
import logo from '../../../public/Sarawak_icon.png';

// Import Icons
import { FaMailBulk, FaUserCircle } from 'react-icons/fa';
import { RiLockPasswordFill } from 'react-icons/ri';
import { IoEyeSharp } from "react-icons/io5";
import { FaEyeSlash } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";
import { FaFacebook } from "react-icons/fa";
import { AiFillInstagram } from "react-icons/ai";

// Import API function
import { loginUser, forgotPassword, googleLogin } from '../../../../Api/api';
import { useGoogleLogin } from '@react-oauth/google';

// Import Toast
import Toast from '../../../Component/Toast/Toast';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastType, setToastType] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [email, setEmail] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const userData = { username, password };

    try {
      const response = await loginUser(userData);
      const data = await response.json();

      if (response.ok && data.success) {
        if (data.uactivation === 'Inactive') {
          displayToast('error', 'Your account is inactive.');
          return;
        }

        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('username', username);
        localStorage.setItem('usergroup', data.usergroup);
        localStorage.setItem('userid', data.userid);
        localStorage.setItem('uactivation', data.uactivation);
        localStorage.setItem('plainPassword', password);

        console.log('User Group:', data.usergroup);
        console.log('User Activation:', data.uactivation);

        if (data.usergroup === 'Customer') {
          displayToast('success', 'Login successful! Redirecting...');
          setTimeout(() => navigate('/home'), 2000);
        } else if (data.usergroup === 'Owner') {
          displayToast('success', 'Login successful! Redirecting...');
          setTimeout(() => navigate('/owner_dashboard'), 2000);
        } else if (data.usergroup === 'Moderator') {
          displayToast('success', 'Login successful! Redirecting...');
          setTimeout(() => navigate('/moderator_dashboard'), 2000);
        } else if (data.usergroup === 'Administrator') {
          displayToast('success', 'Login successful! Redirecting...');
          setTimeout(() => navigate('/administrator_dashboard'), 2000);
        } else {
          displayToast('error', 'Invalid user group.');
        }
      } else {
        displayToast('error', data.message || 'Invalid username or password.');
      }
    } catch (error) {
      console.error('Error during login:', error);
      displayToast('error', 'An unexpected error occurred. Please try again.');
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();

    try {
      const data = await forgotPassword(email);
      displayToast('success', 'New password has been sent to your email');
      setShowForgotPassword(false);
      setEmail('');
    } catch (error) {
      displayToast('error', error.message || 'Reset password failed');
    }
  };

  const displayToast = (type, message) => {
    setToastType(type);
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 5000);
  };

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

const googleLoginHandler = useGoogleLogin({
  flow: 'implicit',
  onSuccess: async (tokenResponse) => {
    
    try {
      // Store token in localStorage
      localStorage.setItem("googleAccessToken", tokenResponse.access_token);
      
      // Pass token to our API
      const data = await googleLogin(tokenResponse.access_token);
      
      if (data.uactivation === 'Inactive') {
        displayToast('error', 'Your account is inactive.');
        return;
      }
      
      localStorage.setItem("isLoggedIn", "true");
      localStorage.setItem("userid", data.userid);
      localStorage.setItem("username", data.username);
      localStorage.setItem("usergroup", data.usergroup);
      if (data.uimage) localStorage.setItem("uimage", data.uimage);
      
      displayToast("success", "Login successful! Redirecting...");
      
      // Redirect based on user group
      if (data.usergroup === 'Customer') {
        setTimeout(() => navigate('/home'), 2000);
      } else if (data.usergroup === 'Owner') {
        setTimeout(() => navigate('/owner_dashboard'), 2000);
      } else if (data.usergroup === 'Moderator') {
        setTimeout(() => navigate('/moderator_dashboard'), 2000);
      } else if (data.usergroup === 'Administrator') {
        setTimeout(() => navigate('/administrator_dashboard'), 2000);
      } else {
        displayToast('error', 'Invalid User Group.');
      }
    } catch (error) {
      console.error("Google login failed:", error);
      displayToast("error", error.message || "An unexpected error occurred. Please try again.");
    }
  },
  onError: (errorResponse) => {
    console.error("Google Sign-In Error:", errorResponse);
    displayToast("error", "Google sign-in failed. Please try again.");
  }
});

  return (
    <div className="loginPage flex">
      {showToast && <Toast type={toastType} message={toastMessage} />}

      <div className="container flex">
        <div className="videoDiv">
          <video src={video} autoPlay muted loop></video>
          <div className="textDiv">
            <h2 className="title_A">Hello Sarawak</h2>
            <h3 className="title_B">Your Journey Begins</h3>
          </div>
          <div className="footerDiv flex">
            <span className="text">Don't Have An Account?</span>
            <Link to={'/register'}>
              <button className="btn">Sign Up</button>
            </Link>
          </div>
        </div>

        <div className="formDiv flex">
          <div className="headerDiv">
        <div 
            className="your-header-class" 
            onClick={() => navigate('/')} 
            style={{ cursor: 'pointer' }}
          >
            <img src={logo} alt="Logo" />
            <div className="textDiv">
              <h3 className="title_C">
                Welcome To
                <br />
                Hello Sarawak
              </h3>
            </div>
            </div>
          </div>

          {showForgotPassword ? (
            <form onSubmit={handleForgotPassword} className="form grid">
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

              <br />

              <button type="submit" className="btn">Send New Password</button>
              <button type="button" className="btn" onClick={() => setShowForgotPassword(false)}>Back To Login</button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="form grid">
              <div className="inputDiv">
                <label htmlFor="username">Username or Email</label>
                <div className="input flex">
                  <FaUserCircle className="icon" />
                  <input
                    type="text"
                    id="username"
                    placeholder="Enter Username or Email"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
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
                    <IoEyeSharp className="icon_eye" onClick={togglePasswordVisibility} />
                  ) : (
                    <FaEyeSlash className="icon_eye" onClick={togglePasswordVisibility} />
                  )}
                </div>
              </div>

              <span className="forgotpassword">
                Forgot Password? <Link onClick={() => setShowForgotPassword(true)}>Click Here</Link>
              </span>

              <br />

              <button type="submit" className="btn"><span>Login</span></button>
              <button onClick={() => navigate('/register')} className="btn_responsive"><span>Sign Up</span></button>

              <div className="divider">Or</div>

              <div className="container_icon">
                <span className="social_button">
                  <FcGoogle className="icon_google" onClick={() => googleLoginHandler()} />
                </span>
                <span className="social_button">
                  <FaFacebook className='icon_facebook' />
                </span>
                <span className="social_button">
                  <AiFillInstagram className='icon_insta' />
                </span>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
