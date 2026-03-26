import React from 'react';
import '../../Component/Filter/Filter.css';

const Filter = ({ filters, onApplyFilters }) => {
    return (
        <div className="filter-layout">
            <div className="filters">
                {filters.map((filter, index) => (
                    <div className="filter-item" key={index}>
                        <label htmlFor={filter.name}>{filter.label}</label>
                        <select
                            id={filter.name}
                            value={filter.value}
                            onChange={(e) => filter.onChange(e.target.value)}
                        >
                            {filter.options.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>
                ))}
            </div>
            <button className="apply-filters-btn" onClick={onApplyFilters}>
                Apply Filters
            </button>
        </div>
    );
};

export default Filter;
