import React, { useEffect, useRef } from 'react';
import { useNavigate } from "react-router-dom";

import './Destination.css';

// Import Images
import wind_cave from '../../public/WindCave.png';
import wind_cave2 from '../../public/WindCave2.png';
import Damai_1 from '../../public/Bako.png';
import Damai_2 from '../../public/Damai.png';
import Culture from '../../public/Culture.png';
import Kubah from '../../public/Kubah National Park.png';
import WaterFront from '../../public/Waterfront.jpg';
import Gunung from '../../public/Gunung.png';
import LongHouse from '../../public/LongHouse.png';
import Similajau from '../../public/Similajau.jpg';

// Import Icon
import { MdLocationPin } from "react-icons/md";

const Destination = () => {
  const imagesRef = useRef([]);
  const sectionRefs = useRef([]);
  const navigate = useNavigate();

  useEffect(() => {
    // 3D rotation effect
    imagesRef.current.forEach((item) => {
      if (!item) return; // Guard clause for null refs
      
      const handleMouseMove = (e) => {
        const rect = item.getBoundingClientRect();
        const positionX = ((e.clientX - rect.left) / rect.width) * 100;
        const positionY = ((e.clientY - rect.top) / rect.height) * 100;

        item.style.setProperty('--rX', 0.5 * (50 - positionY) + 'deg');
        item.style.setProperty('--rY', -0.5 * (50 - positionX) + 'deg');
      };

      const handleMouseOut = () => {
        item.style.setProperty('--rX', '0deg');
        item.style.setProperty('--rY', '0deg');
      };

      item.addEventListener('mousemove', handleMouseMove);
      item.addEventListener('mouseout', handleMouseOut);

      return () => {
        item.removeEventListener('mousemove', handleMouseMove);
        item.removeEventListener('mouseout', handleMouseOut);
      };
    });

    // IntersectionObserver for fade-in effect
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('fade-in');
          }
        });
      },
      { threshold: 0.2, rootMargin: "0px 0px -50px 0px" }
    );

    // Observe all elements in sectionRefs (including .t-card elements)
    sectionRefs.current.forEach((section) => {
      if (section) observer.observe(section);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="destination-container">
      {/* Destination */}
      <div className="destination">
        <h1>Popular Destinations</h1>

        <div className="Main_description" ref={(el) => (sectionRefs.current[1] = el)}>
          <p>Tours give you the opportunity to see a lot within a time frame</p>
        </div>

        <div className="destinations-wrapper">
          <div className="first-des" ref={(el) => (sectionRefs.current[2] = el)}>
            <div className="des-text">
              <h2>Wind Cave Nature Reserve</h2>
              <p className="location">
                <MdLocationPin className="icon_location" /> Bau, Sarawak
              </p>

              <p className="location_description">
                Located near the town of Bau, Wind Cave offers a fascinating glimpse into Sarawak's natural wonders.
                The cave gets its name from the cool, gentle breeze that flows through its narrow passages, providing
                a refreshing atmosphere even in the heart of the jungle.
              </p>

              <div className="buttons_destination">
                <button onClick={() => navigate('/about_sarawak')}>SEE MORE</button>
              </div>
            </div>

            <div className="image" ref={(el) => (imagesRef.current[0] = el)}>
              <img alt="Wind Cave" src={wind_cave} />
              <img alt="Wind Cave 2" src={wind_cave2} />
            </div>
          </div>

          <div className="first-des" ref={(el) => (sectionRefs.current[3] = el)}>
            <div className="des-text">
              <h2>Damai Beach</h2>
              <p className="location">
                <MdLocationPin className="icon_location" /> Teluk Bandung Santubong
              </p>

              <p className="location_description">
                Nestled at the foot of Mount Santubong, Damai Beach is one of Sarawak's most beautiful coastal destinations.
                With its golden sands and clear waters, it's perfect for swimming, sunbathing, and beach sports. Visitors can
                enjoy water activities like kayaking and snorkeling in nearby coral reefs.
              </p>

              <div className="buttons_destination">
                <button onClick={() => navigate('/about_sarawak')}>SEE MORE</button>
              </div>
            </div>

            <div className="image" ref={(el) => (imagesRef.current[1] = el)}>
              <img alt="Damai Beach 1" src={Damai_1} />
              <img alt="Damai Beach 2" src={Damai_2} />
            </div>
          </div>
        </div>
      </div>

      {/* Popular Trip */}
      <div className="trip">
        <h1>Popular Trips</h1>
        <p>Find Your Path, Create Your Memories</p>

        {/* Trip Cards */}
        <div className="tripcard">
          {/* Card 1 */}
          <div className="t-card" ref={(el) => sectionRefs.current.push(el)}>
            <div className="t-image">
              <img alt="Cave" src={Culture} />
            </div>

            <h3>Sarawak Cultural Village</h3>
            <p>
              Located near Damai Beach, this "living museum" highlights Sarawak's diverse cultures.
              Visitors can explore traditional houses and experience performances by major ethnic groups,
              including the Iban, Bidayuh, and Orang Ulu. A great spot to learn about Sarawak's cultural heritage.
            </p>
          </div>

          {/* Card 2 */}
          <div className="t-card" ref={(el) => sectionRefs.current.push(el)}>
            <div className="t-image">
              <img alt="Kubah" src={Kubah} />
            </div>

            <h3>Kubah National Park</h3>
            <p>
              Kubah National Park, near Kuching, is famous for its waterfalls, clear streams, and rich biodiversity.
              It's a great spot for eco-tourism with activities like hiking, bird-watching, and a night trekking trail
              to explore the jungle's nighttime ambiance.
            </p>
          </div>

          {/* Card 3 */}
          <div className="t-card" ref={(el) => sectionRefs.current.push(el)}>
            <div className="t-image">
              <img alt="Waterfront" src={WaterFront} />
            </div>

            <h3>Sarawak Waterfront</h3>
            <p>
              The Sarawak Waterfront in Kuching is a scenic riverside promenade known for
              its blend of heritage and modern charm. With historic buildings, local craft shops,
              and riverfront cafes, it's a vibrant spot to experience Sarawak's culture.
            </p>
          </div>
        </div>

        {/* Trip Cards Row 2*/}
        <div className="tripcard">
          {/* Card 1 */}
          <div className="t-card" ref={(el) => sectionRefs.current.push(el)}>
            <div className="t-image">
              <img alt="Gunung" src={Gunung} />
            </div>

            <h3>Gunung Mulu National Park</h3>
            <p>
              A UNESCO World Heritage Site, this park is famous for its vast cave systems, limestone karsts, 
              and lush rainforest. The Deer Cave and Clearwater Cave are among the world's largest caves, and the Pinnacles, 
              sharp limestone formations, offer a stunning view for trekkers.
            </p>
          </div>

          {/* Card 2 */}
          <div className="t-card" ref={(el) => sectionRefs.current.push(el)}>
            <div className="t-image">
              <img alt="LongHouse" src={LongHouse} />
            </div>

            <h3>Annah Rais Longhouse</h3>
            <p>
              A traditional Bidayuh tribe longhouse where visitors can experience the indigenous lifestyle, 
              interact with locals, and taste their homemade Tuak (rice wine). It offers an authentic insight into Sarawak's 
              tribal heritage.
            </p>
          </div>

          {/* Card 3 */}
          <div className="t-card" ref={(el) => sectionRefs.current.push(el)}>
            <div className="t-image">
              <img alt="Similajau" src={Similajau} />
            </div>

            <h3>Similajau National Park</h3>
            <p>
              This park features golden sandy beaches, mangrove forests, and diverse wildlife. 
              It is a paradise for nature lovers and hikers, offering scenic jungle trails, waterfalls 
              and a chance to spot dolphins along the coast.
            </p>
          </div>
        </div>
      </div>

      {/* Rooms & Suites Section */}
      <div className="room_section">
        <div className="room_des">
          <h1>Rooms & Suites</h1>
          <p>Rest is for going further</p>
        </div>

        <div className="wrapper_room">
          <div className="container_room">
            {/* Room 1 */}
            <input type="radio" name="slide" id="c1" className="room_display" defaultChecked />
            <label htmlFor="c1" className="card_room">
              <div className="row">
                <div className="icon_room">1</div>
                <div className="description_room">
                  <h4>Family Suite</h4>
                  <p>1 King-sized bed / 2 Queen-sized beds</p>
                </div>
              </div>
            </label>

            {/* Room 2 */}
            <input type="radio" name="slide" id="c2" className="room_display" />
            <label htmlFor="c2" className="card_room">
              <div className="row">
                <div className="icon_room">2</div>
                <div className="description_room">
                  <h4>Seaview Deluxe</h4>
                  <p>1 King-sized bed / 2 Queen-sized beds</p>
                </div>
              </div>
            </label>

            {/* Room 3 */}
            <input type="radio" name="slide" id="c3" className="room_display" />
            <label htmlFor="c3" className="card_room">
              <div className="row">
                <div className="icon_room">3</div>
                <div className="description_room">
                  <h4>Superior Poolside</h4>
                  <p>1 King-sized bed / 2 Queen-sized beds</p>
                </div>
              </div>
            </label>

            {/* Room 4 */}
            <input type="radio" name="slide" id="c4" className="room_display" />
            <label htmlFor="c4" className="card_room">
              <div className="row">
                <div className="icon_room">4</div>
                <div className="description_room">
                  <h4>Presidential Suite</h4>
                  <p>1 King-sized bed / 2 Queen-sized beds</p>
                </div>
              </div>
            </label>

            {/* Room 5 */}
            <input type="radio" name="slide" id="c5" className="room_display" />
            <label htmlFor="c5" className="card_room">
              <div className="row">
                <div className="icon_room">5</div>
                <div className="description_room">
                  <h4>Chalet</h4>
                  <p>1 King-sized bed / 2 Queen-sized beds</p>
                </div>
              </div>
            </label>

            {/* Room 6 */}
            <input type="radio" name="slide" id="c6" className="room_display" />
            <label htmlFor="c6" className="card_room">
              <div className="row">
                <div className="icon_room">6</div>
                <div className="description_room">
                  <h4>Baruk Suite</h4>
                  <p>1 King-sized bed / 2 Queen-sized beds</p>
                </div>
              </div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Destination;
