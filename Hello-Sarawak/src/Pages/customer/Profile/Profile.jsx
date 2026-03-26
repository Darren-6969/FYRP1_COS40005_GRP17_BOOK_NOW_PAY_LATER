import React, { useState, useEffect } from 'react';
import Navbar from '../../../Component/Navbar/navbar';
import Footer from '../../../Component/Footer/footer';
import FrontUserProfile from '../../../Component/FrontUserProfile/FrontUserProfile';
import { AuthProvider } from '../../../Component/AuthContext/AuthContext';

//Import css
import './Profile.css';

const Profile = () => {
  return (
    <div>
      <div className="Front_Profile_Main_Container">
          <AuthProvider>
            <Navbar />
              <FrontUserProfile />
            <Footer />
          </AuthProvider>
      </div>
    </div>
  )
}

export default Profile
