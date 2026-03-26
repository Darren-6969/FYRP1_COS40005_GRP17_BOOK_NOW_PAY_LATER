import './NoAccess.css';
import React from 'react';

//Import GIF
import error from '../../public/Access_denied.gif';

const NoAccess = () => {

  return (
<div className="No_access">
      <img alt='No_Access_GIF' src={error} />
      <div className="No_Access_Text">
        <h2>Your Login Session Is Expired</h2>
        <p>Please Login Again</p>
        <button className = "button_No_Access" onClick={() => (window.location.href = "/login")}>Login</button>
      </div>
    </div>
  );
};

export default NoAccess;