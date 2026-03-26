// SearchBar.js
import React from 'react';
import { FaSearch } from 'react-icons/fa';
import '../SearchBar/SearchBar.css';

const SearchBar = ({ value = '', onChange = () => {}, placeholder = 'Search...' }) => {
    const handleInputChange = (e) => {
        const newValue = e.target.value;
        onChange(newValue);
    };

    return (
        <div className="search-input-wrapper">
            <FaSearch className="search-icon" />
            <input
                type="text"
                className="search-input"
                value={value}
                onChange={handleInputChange}
                placeholder={placeholder}
            />
        </div>
    );
};

export default SearchBar;
