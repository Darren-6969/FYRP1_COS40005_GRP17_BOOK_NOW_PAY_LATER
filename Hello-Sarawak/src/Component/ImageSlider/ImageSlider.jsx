import React, { useRef, useEffect, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/pagination";
import "./ImageSlider.css";
import { Pagination } from "swiper/modules";

const ImageSlider = ({ images }) => {
  const swiperRef = useRef(null);
  const sliderRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  
  // Check if component is in viewport before loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    
    if (sliderRef.current) {
      observer.observe(sliderRef.current);
    }
    
    return () => {
      if (observer && sliderRef.current) {
        observer.disconnect();
      }
    };
  }, []);
  
  // Simple check for images array
  if (!images || !Array.isArray(images) || images.length === 0) {
    return <div className="tour-slider-empty">No images available</div>;
  }

  const handlePrev = (e) => {
    e.stopPropagation();
    if (swiperRef.current) {
      swiperRef.current.slidePrev();
    }
  };

  const handleNext = (e) => {
    e.stopPropagation();
    if (swiperRef.current) {
      swiperRef.current.slideNext();
    }
  };

  // Handler image loading errors
  const handleImageError = (e) => {
    e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f0f0f0'/%3E%3Ctext x='50%' y='50%' font-family='Arial' font-size='14' text-anchor='middle' dy='.3em'%3EImage unavailable%3C/text%3E%3C/svg%3E";
  };

  // Only render content when visible for better performance
  return (
    <div className="tour-slider" ref={sliderRef} aria-label="Image gallery">
      {isVisible ? (
        <>
          <Swiper
            pagination={{
              dynamicBullets: true,
              clickable: true,
            }}
            modules={[Pagination]}
            className="mySwiper"
            spaceBetween={10}
            onSwiper={(swiper) => (swiperRef.current = swiper)}
          >
            {images.slice(0, 5).map((image, index) => (
              <SwiperSlide key={index}>
                <img
                  src={`data:image/jpeg;base64,${image}`}
                  alt={`Image ${index + 1}`}
                  className="tour-property-image"
                  loading={index === 0 ? "eager" : "lazy"}
                  onError={handleImageError}
                  fetchPriority={index === 0 ? "high" : "auto"}
                />
              </SwiperSlide>
            ))}
          </Swiper>
          
          <button 
            className="custom-prev-btn" 
            onClick={handlePrev}
            aria-label="Previous image"
          >
            &#8249;
          </button>
          <button 
            className="custom-next-btn" 
            onClick={handleNext}
            aria-label="Next image"
          >
            &#8250;
          </button>
        </>
      ) : (
        // Render a lightweight placeholder when not in viewport
        <div className="tour-slider-placeholder" aria-hidden="true"></div>
      )}
    </div>
  );
};

export default ImageSlider;
