import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import './Modal.css';

const Modal = ({ isOpen, title, data, labels = {}, onClose }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [fadeClass, setFadeClass] = useState('fade-in');

  useEffect(() => {
    // Reset the image index when modal opens or data changes
    setCurrentImageIndex(0);
    setFadeClass('fade-in');
  }, [isOpen, data]);

  if (!isOpen) return null;

  const hasMultipleImages = data.images && data.images.length > 1;

  const handleImageTransition = (newIndex) => {
    if (isTransitioning) return;
    
    setIsTransitioning(true);
    setFadeClass('fade-out');
    
    setTimeout(() => {
      setCurrentImageIndex(newIndex);
      setFadeClass('fade-in');
      
      setTimeout(() => {
        setIsTransitioning(false);
      }, 300); // Match CSS transition duration
    }, 300); // Match CSS transition duration
  };

  const nextImage = () => {
    if (hasMultipleImages) {
      const newIndex = (currentImageIndex + 1) % data.images.length;
      handleImageTransition(newIndex);
    }
  };

  const prevImage = () => {
    if (hasMultipleImages) {
      const newIndex = (currentImageIndex - 1 + data.images.length) % data.images.length;
      handleImageTransition(newIndex);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="modal-close-icon" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {data.images && data.images.length > 0 ? (
            <div className="image-gallery">
              <div className="image-container">
                <img
                  src={`data:image/jpeg;base64,${data.images[currentImageIndex]}`}
                  alt={`${title} - Image ${currentImageIndex + 1}`}
                  className={`gallery-image ${fadeClass}`}
                />
                
                {hasMultipleImages && (
                  <>
                    <button 
                      className="gallery-nav gallery-prev" 
                      onClick={prevImage}
                      disabled={isTransitioning}
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <button 
                      className="gallery-nav gallery-next" 
                      onClick={nextImage}
                      disabled={isTransitioning}
                    >
                      <ChevronRight size={20} />
                    </button>
                    <div className="image-counter">
                      {currentImageIndex + 1} / {data.images.length}
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : data.images ? (
            <div className="no-image">
              <p>No Image Available</p>
            </div>
          ) : null}

          <div className="data-container">
            {Object.keys(data).map((key) =>
              key !== 'images' ? (
                <div key={key} className="data-item">
                  <div className="data-label">
                    {labels[key] || key.replace(/([A-Z])/g, ' $1')}
                  </div>
                  <div className="data-value">{data[key]}</div>
                </div>
              ) : null
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Modal;
