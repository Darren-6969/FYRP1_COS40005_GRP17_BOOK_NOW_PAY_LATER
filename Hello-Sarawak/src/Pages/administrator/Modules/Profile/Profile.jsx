import React from 'react'
import '../../../../Component/MainContent/MainContent.css';
import BackUserProfile from '../../../../Component/BackUserProfile/BackUserProfile'


const Profile = () => {
  return (
    <div>
      <div className="header-container">
        <h1 className="dashboard-page-title">User Profile</h1>
      </div>
      <BackUserProfile />
    </div>
  )
}

export default Profile
