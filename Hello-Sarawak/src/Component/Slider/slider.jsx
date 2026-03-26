import React, { useEffect } from 'react';
import {useNavigate } from 'react-router-dom';
import './slider.css';

import Bako from '../../public/Bako.png';
import Cave from '../../public/cave.png';
import Pool from '../../public/Pool.png';
import Monkey from '../../public/monkey.png';


const Slider = () => {

  const navigate = useNavigate();

  useEffect(() => {
    // Selecting the required elements
    const nextDom = document.getElementById('next');
    const prevDom = document.getElementById('prev');
    const carouselDom = document.querySelector('.carousel');
    const sliderDom = carouselDom.querySelector('.carousel .list');
    const thumbnailBorderDom = document.querySelector('.carousel .thumbnail');
    const thumbnailItemsDom = thumbnailBorderDom.querySelectorAll('.item');
    const timeRunning = 3000;
    const timeAutoNext = 7000;

    const handleSeeMoreClick = () => {
    navigate('/about_sarawak');
    };

    const handleBookClick = () => {
    navigate('/product');
    };

    // Initialize the first thumbnail item
    thumbnailBorderDom.appendChild(thumbnailItemsDom[0]);

    // Set up automatic navigation
    let runNextAuto = setTimeout(() => {
      nextDom.click();
    }, timeAutoNext);

    // Function to handle slider navigation
    function showSlider(type) {
      const sliderItemsDom = sliderDom.querySelectorAll('.carousel .list .item');
      const thumbnailItemsDom = document.querySelectorAll('.carousel .thumbnail .item');

      if (type === 'next') {
        sliderDom.appendChild(sliderItemsDom[0]);
        thumbnailBorderDom.appendChild(thumbnailItemsDom[0]);
        carouselDom.classList.add('next');
      } else {
        sliderDom.prepend(sliderItemsDom[sliderItemsDom.length - 1]);
        thumbnailBorderDom.prepend(thumbnailItemsDom[thumbnailItemsDom.length - 1]);
        carouselDom.classList.add('prev');
      }

      // Clear classes after transition time
      clearTimeout(runTimeOut);
      runTimeOut = setTimeout(() => {
        carouselDom.classList.remove('next');
        carouselDom.classList.remove('prev');
      }, timeRunning);

      // Reset auto-next timeout
      clearTimeout(runNextAuto);
      runNextAuto = setTimeout(() => {
        nextDom.click();
      }, timeAutoNext);
    }

    // Event listeners for navigation buttons
    nextDom.onclick = () => showSlider('next');
    prevDom.onclick = () => showSlider('prev');

    let runTimeOut;

    // Cleanup to prevent memory leaks
    return () => {
      nextDom.onclick = null;
      prevDom.onclick = null;
      clearTimeout(runTimeOut);
      clearTimeout(runNextAuto);
    };
  }, []);

  return (
    <div>

      {/* Hero Section */}
      <div className="carousel">

        {/* Carousel List */}
        <div className="list">

          <div className="item">
            <img src= {Cave}/>
            <div className="content">
              <div className="title">HELLO SARAWAK</div>
              <div className="topic">NIAH NATIONAL PARK</div>
              <div className="des">
                Known for its ancient cave system, Niah National Park is one of Southeast Asia's significant archaeological sites. 
                It is famous for evidence of human habitation dating back 40,000 years, as well as its massive caves and prehistoric 
                rock paintings, making it an exciting spot for history enthusiasts.
              </div>

                <div className="buttons">
                  <button onClick={() => navigate('/about_sarawak')}>SEE MORE</button>
                </div>

            </div>
          </div>

          <div className="item">
            <img src= {Bako}/>
            <div className="content">
              <div className="title">YOUR JOURNEY</div>
              <div className="topic">BAKO NATIONAL PARK</div>
              <div className="des">
               Sarawak's oldest national park offers stunning scenery with diverse ecosystems like mangroves, rainforests, and beautiful beaches. Bako is also home to various wildlife, including the rare proboscis monkey, silvered langurs, and monitor lizards. The park has numerous trekking trails for hiking enthusiasts.
              </div>

                <div className="buttons">
                  <button onClick={() => navigate('/about_sarawak')}>SEE MORE</button>
                </div>

            </div>
          </div>

          <div className="item">
            <img src= {Monkey}/>
            <div className="content">
              <div className="title">YOUR STORY</div>
              <div className="topic">SEMENGGOH WILDLIFE CENTRE</div>
              <div className="des">
               Located near Kuching, Semenggoh Wildlife Centre is dedicated to the conservation of Sarawak's orangutans. Here, visitors can observe rescued and rehabilitated orangutans up close and learn about their behavior. The center is open for viewing at designated feeding times, offering a rare chance to see these endangered creatures.
              </div>

                <div className="buttons">
                  <button onClick={() => navigate('/about_sarawak')}>SEE MORE</button>
                </div>
              
            </div>
          </div>

          <div className="item">
            <img src= {Pool}/>
            <div className="content">
              <div className="title">JOIN US</div>
              <div className="topic">BOOK NOW AND START YOUR JOURNEY</div>

                <div className="buttons">
                  <button onClick={() => navigate('/product')}>BOOK NOW</button>
                </div>

            </div>
          </div>

        </div>


        {/* Thumbnail */}
        <div className="thumbnail">

          <div className="item">
            <img src= {Cave}/>
            <div className="content">
              <div className="title">Niah National Park</div>
            </div>
          </div>

          <div className="item">
            <img src= {Bako}/>
            <div className="content">
              <div className="title">Bako National Park</div>
            </div>
          </div>

          <div className="item">
            <img src= {Monkey}/>
            <div className="content">
              <div className="title">Semenggoh Wildlife Centre</div>
            </div>
          </div>

          <div className="item">
            <img src= {Pool}/>
            <div className="content">
              <div className="title">Join Us</div>
            </div>
          </div>

        </div>

        {/* Navigation Arrows */}
        <div className="arrows">
          <button id="prev">&lt;</button>
          <button id="next">&gt;</button>
        </div>

        {/* Time Running */}
        <div className="time"></div>
      </div>
    </div>
  );
};

export default Slider;
