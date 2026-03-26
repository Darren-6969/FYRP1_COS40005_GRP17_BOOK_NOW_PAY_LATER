import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { FiLogOut, FiMenu } from 'react-icons/fi';
import { logoutUser } from '../../../Api/api';
import '../../Component/Sidebar/Sidebar.css';

const Sidebar = ({ title, links, isCollapsed, toggleSidebar }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_API_URL;

  useEffect(() => {
    const checkLoginStatus = async () => {
      const userid = localStorage.getItem('userid');
      if (userid) {
        try {
          const response = await fetch(`${API_URL}/checkStatus?userid=${userid}`);
          const data = await response.json();
          if (data.ustatus === 'login') {
            setIsLoggedIn(true);
          } else {
            setIsLoggedIn(false);
          }
        } catch (error) {
          console.error('Error fetching user status:', error);
        }
      } else {
        setIsLoggedIn(false);
      }
    };
    checkLoginStatus();
  }, []);

  const handleLogout = async () => {
    const userid = localStorage.getItem('userid');
    try {
      const response = await logoutUser(userid);
      if (response.success) {
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('userid');
        localStorage.removeItem('username');
        localStorage.removeItem('usergroup');
        setIsLoggedIn(false);
        navigate('/login'); // Redirect to login page
      } else {
        alert('Failed to logout');
      }
    } catch (error) {
      console.error('Error during logout:', error);
      alert('Error logging out');
    }
  };

  return (
    <>
      <button className="menu-toggle" onClick={toggleSidebar}>
        <FiMenu />
      </button>
      <div className={`sidebar-wrapper ${isCollapsed ? 'collapsed' : 'expanded'}`}>
        <h2 className="sidebar-title">{title}</h2>
        <nav>
          <ul className="sideMenus">
            {links.map((link) => (
              <NavLink 
                key={link.path} 
                to={link.path} 
                className={({ isActive }) => (isActive ? 'menu-item active' : 'menu-item')}
                onClick={() => {
                  if (window.innerWidth <= 768 && !isCollapsed) {
                    toggleSidebar();
                  }
                }}
              >
                <span className="menu-icon">{link.icon}</span> {link.label}
              </NavLink>
            ))}
          </ul>
        </nav>
        {isLoggedIn && (
          <div className="logout-container">
            <button onClick={handleLogout} className="logout-item">
              <FiLogOut className="logout-icon" /> Logout
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default Sidebar;
