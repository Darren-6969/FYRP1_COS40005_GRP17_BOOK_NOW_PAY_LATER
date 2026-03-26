import React from 'react';
import './Role.css';

const Role = ({ role }) => {
  const roleClass = role?.toLowerCase() || 'default';
  return (
    <span className={`role-badge ${roleClass}`}>
      {role || 'Unknown'}
    </span>
  );
};

export default Role;
