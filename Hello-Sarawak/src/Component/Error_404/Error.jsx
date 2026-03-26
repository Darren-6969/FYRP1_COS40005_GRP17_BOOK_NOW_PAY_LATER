import './Error.css';
import React from 'react';

//Import GIF
import error from '../../public/error.gif';

const Error = () => {

  return (
<div className="Error_404_Container">
      <h1 className='Error_404'>404</h1>
      <img alt='Error_GIF' src={error} />
      <div className="Error_Text">
        <h2>Looks like you're lost</h2>
        <p>The page you are looking for is not available</p>
        <button className = "button_Error_404" onClick={() => (window.location.href = "/")}>Go To Home</button>
      </div>
    </div>
  );
};

export default Error;