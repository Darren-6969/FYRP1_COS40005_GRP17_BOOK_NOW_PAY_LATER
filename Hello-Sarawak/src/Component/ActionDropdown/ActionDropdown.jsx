import React, { useRef, useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import '../../Component/ActionDropdown/ActionDropdown.css';
import { FaEllipsisH } from 'react-icons/fa';

const ActionDropdown = ({ items, onAction, onClose }) => {
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);
  const [dropdownPosition, setDropdownPosition] = useState({});
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const toggleDropdown = (event) => {
    const buttonPosition = event.currentTarget.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const dropdownWidth = 150; 
    const dropdownHeight = items.length * 40; 

    let top = buttonPosition.bottom + 8;
    let left = buttonPosition.left + 8;

    if (left + dropdownWidth > viewportWidth) {
      left = buttonPosition.left - dropdownWidth - 8;
    }

    if (top + dropdownHeight > viewportHeight) {
      top = buttonPosition.top - dropdownHeight - 8;
    }

    setDropdownPosition({ top, left });
    setIsDropdownOpen(!isDropdownOpen);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(event.target) &&
        buttonRef.current && !buttonRef.current.contains(event.target)
      ) {
        setIsDropdownOpen(false);
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  return (
    <>
      <button ref={buttonRef} className="actions-button" onClick={toggleDropdown}>
        <FaEllipsisH />
      </button>
      {isDropdownOpen &&
        ReactDOM.createPortal(
          <div
            ref={dropdownRef}
            className="dropdown-menu-portal"
            style={{ ...dropdownPosition, position: 'fixed', zIndex: 1000 }}
          >
            {items.map((item, index) => (
              <div
                key={index}
                className="dropdown-item"
                onClick={() => {
                  onAction(item.action);
                  setIsDropdownOpen(false);
                  onClose();
                }}
              >
                <span className="dropdown-icon">{item.icon}</span>
                {item.label}
              </div>
            ))}
          </div>,
          document.body
        )}
    </>
  );
};

export default ActionDropdown;