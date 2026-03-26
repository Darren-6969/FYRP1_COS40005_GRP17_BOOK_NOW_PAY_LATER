import React, { useState, useEffect } from 'react';
import { IoMdClose } from "react-icons/io";
import { FaStar } from "react-icons/fa";
import { fetchReviews } from '../../../Api/api';
import ReviewForm from '../ReviewForm/ReviewForm';
import './Reviews.css';

const Reviews = ({ isOpen, onClose, propertyId }) => {
  const [sortOption, setSortOption] = useState('Most recent');
  const [reviewFormOpen, setReviewFormOpen] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [filteredReviews, setFilteredReviews] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [propertyData, setPropertyData] = useState({
    rating: 0,
    ratingno: 0
  });
  
  // Add useEffect to manage body overflow
  useEffect(() => {
    if (isOpen) {
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
      
      // Cleanup function to restore original style when component unmounts or modal closes
      return () => {
        document.body.style.overflow = originalStyle.overflow;
        document.body.style.position = originalStyle.position;
        document.body.style.top = originalStyle.top;
        document.body.style.width = originalStyle.width;
        document.body.style.paddingRight = originalStyle.paddingRight;
        
        // Restore scroll position
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);
  
  // Fetch reviews and property data for the property
  useEffect(() => {
    if (isOpen && propertyId) {
      fetchReviews(propertyId)
        .then(data => {
          console.log('Fetched review data:', data);
          
          if (data.reviews) {
            setReviews(data.reviews);
            setFilteredReviews(data.reviews);
          }
          
          // Extract property rating data
          if (data.property) {
            setPropertyData({
              rating: data.property.rating || 0,
              ratingno: data.property.ratingno || 0
            });
          }
        })
        .catch(err => {
          console.error('Error fetching reviews:', err);
          setError('Failed to load reviews. Please try again later.');
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen, propertyId]);

  // Filter reviews when search term changes
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredReviews(reviews);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = reviews.filter(review => 
        review.comment.toLowerCase().includes(term) || 
        (review.name && review.name.toLowerCase().includes(term))
      );
      setFilteredReviews(filtered);
    }
  }, [searchTerm, reviews]);

  if (!isOpen) return null;

  const handleSortChange = (e) => {
    setSortOption(e.target.value);
    const option = e.target.value;
    
    let sorted = [...filteredReviews];
    
    if (option === 'Most recent') {
      sorted = sorted.sort((a, b) => {
        const dateA = new Date(a.datePosted);
        const dateB = new Date(b.datePosted);
        return dateB - dateA;
      });
    } else if (option === 'Most past') {
      sorted = sorted.sort((a, b) => {
        const dateA = new Date(a.datePosted);
        const dateB = new Date(b.datePosted);
        return dateA - dateB;
      });
    }
    
    setFilteredReviews(sorted);
  };
  
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };
  
  const handleOpenReviewForm = () => {
    setReviewFormOpen(true);
  };
  
  const handleCloseReviewForm = () => {
    setReviewFormOpen(false);
    // Optionally refresh reviews after submission
    if (propertyId) {
      setIsLoading(true);
      fetchReviews(propertyId)
        .then(data => {
          if (data.reviews) {
            setReviews(data.reviews);
            setFilteredReviews(data.reviews);
            setSearchTerm('');
          }
          
          // Extract property rating data
          if (data.property) {
            setPropertyData({
              rating: data.property.rating || 0,
              ratingno: data.property.ratingno || 0
            });
          }
        })
        .catch(err => {
          console.error('Error fetching reviews:', err);
          setError('Failed to load reviews. Please try again later.');
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  };

  // Create a custom close handler to handle both state and body overflow
  const handleClose = () => {
    onClose();
  };

  return (
    <>
      <div className="reviews-overlay">
        <div className="reviews-overlay-content">
          <div className="reviews-header">
            <h3>Reviews</h3>
            <button className="cls-button" onClick={handleClose}>
              <IoMdClose />
            </button>
          </div>
          
          <div className="reviews-content-scrollable">
            <div className="reviews-content">
              <div className="reviews-summary">
                <div className="reviews-average">
                  <div className="rating-display">
                    <span className="average-rating">
                      {Number.isInteger(propertyData.rating) 
                        ? propertyData.rating.toFixed(1)
                        : propertyData.rating.toFixed(2).replace(/\.?0+$/, '')}
                        
                    </span>
                    <span className="star-icon"> <FaStar /></span>
                    <span className="total-reviews">{propertyData.ratingno} reviews</span>
                  </div>
                </div>
                
                <div className="sort-dropdown">
                  <select value={sortOption} onChange={handleSortChange}>
                    <option value="Most recent">Most recent</option>
                    <option value="Most past">Most past</option>
                  </select>
                </div>
              </div>
              
              <div className="reviews-search-container">
                <div className="reviews-search">
                  <input 
                    type="text" 
                    placeholder="Search reviews" 
                    className="reviews-search-input"
                    value={searchTerm}
                    onChange={handleSearchChange}
                  />
                </div>
                
                <button 
                  className="submit-button" 
                  onClick={handleOpenReviewForm}
                >
                  Write a review
                </button>
              </div>
              
              {isLoading ? (
                <div className="loading">Loading reviews...</div>
              ) : error ? (
                <div className="error-message">{error}</div>
              ) : filteredReviews.length === 0 ? (
                <div className="no-results">
                  {searchTerm ? `No reviews found for "${searchTerm}"` : "No reviews yet"}
                </div>
              ) : (
                <div className="reviews-list">
                  {filteredReviews.map(review => (
                    <div key={review.id} className="review-item">
                      <div className="reviewer-info">
                        <img 
                          src={review.avatar ? 
                               (review.avatar.startsWith && review.avatar.startsWith('http') ? 
                                review.avatar : 
                                `data:image/jpeg;base64,${review.avatar}`) : 
                               `https://randomuser.me/api/portraits/${Math.random() > 0.5 ? 'men' : 'women'}/${Math.floor(Math.random() * 99)}.jpg`}
                          alt={review.name} 
                          className="reviewer-avatar" 
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = `https://randomuser.me/api/portraits/${Math.random() > 0.5 ? 'men' : 'women'}/${Math.floor(Math.random() * 99)}.jpg`;
                          }}
                        />
                        <div className="reviewer-details">
                          <div className="reviewer-name">{review.name}</div>
                          <div className="reviewer-status">{review.datePosted}</div>
                        </div>
                      </div>
                      
                      <div className="review-content">
                        <p className="review-text">{review.comment}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <ReviewForm 
        isOpen={reviewFormOpen} 
        onClose={handleCloseReviewForm} 
        propertyId={propertyId}
      />
    </>
  );
};

export default Reviews;
