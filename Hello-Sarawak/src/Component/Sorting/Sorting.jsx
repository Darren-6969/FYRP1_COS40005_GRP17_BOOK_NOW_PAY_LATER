import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FaSortAmountDown, FaSortAmountDownAlt, FaFilter } from 'react-icons/fa';
import { IoCloseOutline } from "react-icons/io5";
import { FaWifi, FaUtensils, FaBath, FaBell, FaKey, FaFireExtinguisher, FaFirstAid, FaCity, FaUmbrellaBeach, FaWater, FaSkiing, FaBabyCarriage, FaSnowflake, FaWind, FaDesktop, FaTv, FaBuilding, FaSwimmingPool } from "react-icons/fa";
import { GiWashingMachine, GiClothesline, GiDesert } from "react-icons/gi";
import { PiSecurityCamera } from "react-icons/pi";
import { SiLightning } from "react-icons/si";
import { TbPawFilled } from "react-icons/tb";
import { MdLandscape, MdOutlineKingBed, MdFireplace, MdSmokingRooms, MdKeyboardArrowDown, MdKeyboardArrowUp } from "react-icons/md";
import { FaParking, FaChargingStation, FaDumbbell, FaCoffee } from "react-icons/fa";
import { BsBuilding, BsHouse } from "react-icons/bs";
import { fetchProduct } from "../../../Api/api";
import './Sorting.css';

const Sorting = ({ 
  showFilters, 
  setShowFilters,
  priceRange, 
  setPriceRange,
  sortOrder, 
  setSortOrder,
  selectedFacilities, 
  setSelectedFacilities,
  selectedPropertyTypes, 
  setSelectedPropertyTypes,
  selectedBookingOptions, 
  setSelectedBookingOptions,
  handleCheckAvailability
}) => {
  const [showMoreAmenities, setShowMoreAmenities] = useState(false);
  const [showPropertyTypes, setShowPropertyTypes] = useState(false);
  const [showBookingOptions, setShowBookingOptions] = useState(false);

  const { data: fetchedProperties } = useQuery({
    queryKey: ['properties'],
    queryFn: fetchProduct,
  });

  // Set higher maximum value to match the image (RM1000+)
  useEffect(() => {
    // Set initial price range if not set
    if (priceRange.max === 1000) {
      setPriceRange(prev => ({
        min: 0,
        max: 1000
      }));
    }
  }, []);

  // Hide/show navbar when filter overlay shows and lock body scroll
  useEffect(() => {
    const navbar = document.querySelector('.navbar');
    
    if (showFilters) {
      // Hide navbar
      if (navbar) {
        navbar.style.display = 'none';
      }
      
      // Save the current scroll position and body styles
      const scrollY = window.scrollY;
      const originalStyle = {
        overflow: document.body.style.overflow,
        position: document.body.style.position,
        top: document.body.style.top,
        width: document.body.style.width,
        paddingRight: document.body.style.paddingRight
      };
      
      // Prevent background scrolling - lock the body in place
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      
      // Add padding to prevent layout shift
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
      
      // Store original styles for cleanup
      document.body.dataset.originalStyle = JSON.stringify(originalStyle);
      document.body.dataset.scrollY = scrollY;
      
    } else {
      // Show navbar
      if (navbar) {
        navbar.style.display = '';
      }
      
      // Restore body styles and scroll position if we have saved data
      if (document.body.dataset.originalStyle) {
        const originalStyle = JSON.parse(document.body.dataset.originalStyle);
        const scrollY = parseFloat(document.body.dataset.scrollY || '0');
        
        document.body.style.overflow = originalStyle.overflow || '';
        document.body.style.position = originalStyle.position || '';
        document.body.style.top = originalStyle.top || '';
        document.body.style.width = originalStyle.width || '';
        document.body.style.paddingRight = originalStyle.paddingRight || '';
        
        // Restore scroll position
        window.scrollTo(0, scrollY);
        
        // Clean up data attributes
        delete document.body.dataset.originalStyle;
        delete document.body.dataset.scrollY;
      }
    }
    
    return () => {
      // Reset on unmount
      if (navbar) {
        navbar.style.display = '';
      }
      
      // Restore body styles and scroll position if we have saved data
      if (document.body.dataset.originalStyle) {
        const originalStyle = JSON.parse(document.body.dataset.originalStyle);
        const scrollY = parseFloat(document.body.dataset.scrollY || '0');
        
        document.body.style.overflow = originalStyle.overflow || '';
        document.body.style.position = originalStyle.position || '';
        document.body.style.top = originalStyle.top || '';
        document.body.style.width = originalStyle.width || '';
        document.body.style.paddingRight = originalStyle.paddingRight || '';
        
        // Restore scroll position
        window.scrollTo(0, scrollY);
        
        // Clean up data attributes
        delete document.body.dataset.originalStyle;
        delete document.body.dataset.scrollY;
      }
    };
  }, [showFilters]);

  // Common facilities for filtering
  const facilities = [
    "Wi-Fi", 
    "Kitchen", 
    "Washer", 
    "Dryer", 
    "Air conditioning", 
    "Heating",
    "Dedicated workspace", 
    "TV"
  ];

  const features = [
    "Free parking",
    "Pool",
    "Bath tub",
    "EV charger",
    "Baby Crib",
    "King bed",
    "Gym",
    "Breakfast",
    "Indoor fireplace",
    "Smoking allowed"
  ];

  const locations = [
    "City View",
    "Beachfront",
    "Waterfront",
    "Countryside",
    "Ski-in/ski-out",
    "Desert"
  ];

  const safety = [
    "Security alarm",
    "Fire extinguisher",
    "First aid kit",
    "Security Camera"
  ];

  const propertyTypes = [
    "Apartment",
    "Guesthouse",
    "Hotel",
    "Inn",
    "Hostel",
    "Resort",
  ];

  const bookingOptions= [
    "Instant Book",
    "Self check-in",
    "Pets Allowed",
  ];

  const handleRangeInputChange = (e) => {
    const { name, value } = e.target;
    const numValue = parseInt(value, 10);

    setPriceRange(prev => {
      if (name === 'min') {
        return { ...prev, min: Math.min(numValue, prev.max) };
      }
      if (name === 'max') {
        return { ...prev, max: Math.max(numValue, prev.min) };
      }
      return prev;
    });
  };

  // Handle price range change
  const handlePriceRangeChange = (e) => {
    const { name, value } = e.target;
    const numValue = parseInt(value, 10);

    setPriceRange(prev => {
      if (name === 'min') {
        return { ...prev, min: Math.min(numValue, prev.max) };
      }
      if (name === 'max') {
        return { ...prev, max: Math.max(numValue, prev.min) };
      }
      return prev;
    });
  };

  const updateRangeSliderStyle = (range) => {
    const sliderContainer = document.querySelector('.range-slider-container');
    if (!sliderContainer) return;
    
    const min = 0;
    const max = 1000;
    const rangeWidth = max - min;
    
    const leftPercent = ((range.min - min) / rangeWidth) * 100;
    const rightPercent = 100 - ((range.max - min) / rangeWidth) * 100;
    
    sliderContainer.style.setProperty('--left-percent', `${leftPercent}%`);
    sliderContainer.style.setProperty('--right-percent', `${rightPercent}%`);
  };

  // Calculate price distribution for histogram based on actual property rates
 const generatePriceHistogram = () => {
    if (!fetchedProperties) return null;
    
    // Get all prices from fetched properties
    const prices = fetchedProperties.map(prop => parseFloat(prop.normalrate));
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    
    // Create price bins
    const numBins = 100;
    const binSize = (maxPrice - minPrice) / numBins;
    const bins = Array(numBins).fill(0);
    
    // Fill histogram data
    prices.forEach(price => {
      const binIndex = Math.min(Math.floor((price - minPrice) / binSize), numBins - 1);
      bins[binIndex]++;
    });
    
    const maxFreq = Math.max(...bins);
    
    return (
      <div className="price-histogram">
        {bins.map((count, i) => {
          const height = count > 0 ? Math.max(5, (count / maxFreq) * 50) : 1;
          const isInRange = (minPrice + i * binSize >= priceRange.min) && 
                           (minPrice + i * binSize <= priceRange.max);
          
          return (
            <div 
              key={i} 
              className={`histogram-bar ${isInRange ? 'in-range' : 'out-range'}`}
              style={{ height: `${height}px` }}
            />
          );
        })}
      </div>
    );
  };
  
  // Handle facility selection
  const toggleFacility = (facility) => {
    setSelectedFacilities(prev => 
      prev.includes(facility) 
        ? prev.filter(f => f !== facility) 
        : [...prev, facility]
    );
  };

  // Toggle show more amenities
  const toggleShowMoreAmenities = () => {
    setShowMoreAmenities(!showMoreAmenities);
  };
  
  // Toggle property type dropdown
  const togglePropertyTypes = () => {
    setShowPropertyTypes(!showPropertyTypes);
  };
  
  // Handle property type selection
  const togglePropertyType = (type) => {
    setSelectedPropertyTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type) 
        : [...prev, type]
    );
  };

    // Toggle property type dropdown
    const toggleBookingOptions = () => {
      setShowBookingOptions(!showBookingOptions);
    };
    
    // Handle property type selection
    const toggleBookingOption = (type) => {
      setSelectedBookingOptions(prev => 
        prev.includes(type) 
          ? prev.filter(t => t !== type) 
          : [...prev, type]
      );
    };
  
  // Render amenity items with proper icons
  const renderAmenityItems = (items) => {
    return items.map((item) => (
      <div 
        key={item}
        className={`amenity-item ${selectedFacilities.includes(item) ? 'selected' : ''}`}
        onClick={() => toggleFacility(item)}
      >
        <span className="amenity-icon">
          {/* Essentials */}
          {item === "Wi-Fi" && <FaWifi />}
          {item === "Kitchen" && <FaUtensils />}
          {item === "Washer" && <GiWashingMachine />}
          {item === "Dryer" && <GiClothesline />}
          {item === "Air conditioning" && <FaSnowflake />}
          {item === "Heating" && <FaWind />}
          {item === "Dedicated workspace" && <FaDesktop />}
          {item === "TV" && <FaTv />}
          
          {/* Features */}
          {item === "Free parking" && <FaParking />}
          {item === "Pool" && <FaSwimmingPool />}
          {item === "Bath tub" && <FaBath />}
          {item === "EV charger" && <FaChargingStation />}
          {item === "Baby Crib" && <FaBabyCarriage />}
          {item === "King bed" && <MdOutlineKingBed />}
          {item === "Gym" && <FaDumbbell />}
          {item === "Breakfast" && <FaCoffee />}
          {item === "Indoor fireplace" && <MdFireplace />}
          {item === "Smoking allowed" && <MdSmokingRooms />}
          
          {/* Location */}
          {item === "City View" && <FaCity />}
          {item === "Beachfront" && <FaUmbrellaBeach />}
          {item === "Waterfront" && <FaWater  />}
          {item === "Countryside" && <MdLandscape />}
          {item === "Ski-in/ski-out" && <FaSkiing />}
          {item === "Desert" && <GiDesert />}
          
          {/* Safety */}
          {item === "Security alarm" && <FaBell />}
          {item === "Fire extinguisher" && <FaFireExtinguisher />}
          {item === "First aid kit" && <FaFirstAid />}
          {item === "Security Camera" && <PiSecurityCamera />}
        </span>
        <span className="amenity-text">{item}</span>
      </div>
    ));
  };

  // Render filter button
  const renderFilterButton = () => (
    <div className="filter-button-container">
      <button 
        className="filter-button"
        onClick={() => setShowFilters(true)}
      >
        <FaFilter /> Filters
      </button>
      
      {sortOrder !== 'none' && (
        <div className="sort-indicator">
          {sortOrder === 'asc' ? 'Price: Low to High' : 'Price: High to Low'}
        </div>
      )}
    </div>
  );

  // Render filter overlay
  const renderFilterOverlay = () => {
    if (!showFilters) return null;

    return (
      <div className="filter-overlay">
        <div className="filter-overlay-content">
          <div className="filter-header">
            <h3>Filters</h3>
            <button 
              className="cls-button"
              onClick={() => setShowFilters(false)}
            >
              <IoCloseOutline size={24} />
            </button>
          </div>
          
          <div className="filter-content-scrollable">
            <div className="filter-price-section">
              <h4>Price range</h4>
              <p className="price-subtitle">Trip price, includes all fees</p>
              
              <div className="price-range-visual">
                {generatePriceHistogram()}
                
                <div className="range-slider-container">
                  <div className="range-slider-track"></div>
                  <div className="slider-boundary min-boundary">
                    <span className="boundary-dot"></span>
                  </div>
                  <div className="slider-boundary max-boundary">
                    <span className="boundary-dot"></span>
                  </div>
                  <input
                    type="range"
                    name="min"
                    min={0}
                    max={1000}
                    step={10}
                    value={priceRange.min}
                    onChange={handleRangeInputChange}
                    className="range-slider min-slider"
                  />
                  <input
                    type="range"
                    name="max"
                    min={0}
                    max={1000}
                    step={10}
                    value={priceRange.max}
                    onChange={handleRangeInputChange}
                    className="range-slider max-slider"
                  />
                </div>
              </div>
              
              <div className="price-range-inputs">
                <div className="price-input-group">
                  <label>Minimum</label>
                  <div className="currency-input">
                    <span className="currency-symbol">RM</span>
                    <input
                      type="number"
                      name="min"
                      value={priceRange.min}
                      onChange={handlePriceRangeChange}
                      min="1"
                      step="10"
                    />
                  </div>
                </div>
                <div className="price-input-group">
                  <label>Maximum</label>
                  <div className="currency-input">
                    <span className="currency-symbol">RM</span>
                    <input
                      type="number"
                      name="max"
                      value={priceRange.max}
                      onChange={handlePriceRangeChange}
                      min="1"
                      step="10"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="filter-section">
              <h4>Sort by Price</h4>
              <div className="sort-options">
                <button 
                  className={`sort-button ${sortOrder === 'none' ? 'active' : ''}`}
                  onClick={() => setSortOrder('none')}
                >
                  None
                </button>
                <button 
                  className={`sort-button ${sortOrder === 'asc' ? 'active' : ''}`}
                  onClick={() => setSortOrder('asc')}
                >
                  <FaSortAmountDown /> Low to High
                </button>
                <button 
                  className={`sort-button ${sortOrder === 'desc' ? 'active' : ''}`}
                  onClick={() => setSortOrder('desc')}
                >
                  <FaSortAmountDownAlt /> High to Low
                </button>
              </div>
            </div>
            
            <div className="filter-section">
              <h4>Facilities</h4>
              <div className="essentials-section">
                <h5>Essentials</h5>
                <div className="amenities-grid">
                  {renderAmenityItems(facilities)}
                </div>
              </div>
              
              {!showMoreAmenities && (
                <button className="show-more-button" onClick={toggleShowMoreAmenities}>
                  Show more <MdKeyboardArrowDown />
                </button>
              )}
              
              {showMoreAmenities && (
                <>
                  <div className="features-section">
                    <h5>Features</h5>
                    <div className="amenities-grid">
                      {renderAmenityItems(features)}
                    </div>
                  </div>
                  
                  <div className="location-section">
                    <h5>Location</h5>
                    <div className="amenities-grid">
                      {renderAmenityItems(locations)}
                    </div>
                  </div>
                  
                  <div className="safety-section">
                    <h5>Safety</h5>
                    <div className="amenities-grid">
                      {renderAmenityItems(safety)}
                    </div>
                  </div>
                  
                  <button className="show-less-button" onClick={toggleShowMoreAmenities}>
                    Show less <MdKeyboardArrowUp />
                  </button>
                </>
              )}
            </div>
            
            <div className="filter-section">
              <div 
                className={`property-type-header ${showBookingOptions ? 'active' : ''}`}
                onClick={toggleBookingOptions}
              >
                <h4>Booking options</h4>
                <span className="property-type-icon">
                  {showBookingOptions ? <MdKeyboardArrowUp /> : <MdKeyboardArrowDown />}
                </span>
              </div>
              
              {showBookingOptions && (
                <div className="property-type-grid">
                  {bookingOptions.map(type => (
                    <div 
                      key={type}
                      className={`property-type-item ${selectedBookingOptions.includes(type) ? 'selected' : ''}`}
                      onClick={() => toggleBookingOption(type)}
                    >
                      <div className="property-type-icon">
                        {type === "Instant Book" && <SiLightning/>}
                        {type === "Self check-in" && <FaKey />}
                        {type === "Pets Allowed" && <TbPawFilled/>}
                      </div>
                      <span>{type}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="filter-section">
              <div 
                className={`property-type-header ${showPropertyTypes ? 'active' : ''}`}
                onClick={togglePropertyTypes}
              >
                <h4>Property type</h4>
                <span className="property-type-icon">
                  {showPropertyTypes ? <MdKeyboardArrowUp /> : <MdKeyboardArrowDown />}
                </span>
              </div>
              
              {showPropertyTypes && (
                <div className="property-type-grid">
                  {propertyTypes.map(type => (
                    <div 
                      key={type}
                      className={`property-type-item ${selectedPropertyTypes.includes(type) ? 'selected' : ''}`}
                      onClick={() => togglePropertyType(type)}
                    >
                      <div className="property-type-icon">
                        {type === "Apartment" && <BsBuilding />}
                        {type === "Guesthouse" && <BsHouse />}
                        {type === "Hotel" && <BsBuilding />}
                        {type === "Inn" && <FaBuilding />}
                        {type === "Hostel" && <FaBuilding />}
                        {type === "Resort" && <FaBuilding />}
                      </div>
                      <span>{type}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div className="filter-actions">
            <button 
              className="reset-button"
              onClick={() => {
                setPriceRange({ min: 0, max: 1000 });
                setSortOrder('none');
                setSelectedFacilities([]);
                setSelectedPropertyTypes([]);
                updateRangeSliderStyle({ min: 0, max: 1000 });
              }}
            >
              Reset Filters
            </button>
            <button 
              className="apply-button"
              onClick={handleCheckAvailability}
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Update the histogram when price range changes
  useEffect(() => {
    // Find all histogram bars
    const histogramBars = document.querySelectorAll('.histogram-bar');
    if (!histogramBars.length) return;
    
    const min = 0;
    const max = 1000;
    const numBins = histogramBars.length;
    const binSize = (max - min) / numBins;
    
    // Update each bar's class based on whether it's in the selected price range
    histogramBars.forEach((bar, i) => {
      const binPrice = min + (i * binSize);
      if (binPrice >= priceRange.min && binPrice <= priceRange.max) {
        bar.classList.add('in-range');
        bar.classList.remove('out-range');
      } else {
        bar.classList.add('out-range');
        bar.classList.remove('in-range');
      }
    });
  }, [priceRange]);

  return (
    <>
      {renderFilterButton()}
      {renderFilterOverlay()}
    </>
  );
};

export default Sorting;
