import React from 'react';

//Import Component
import Navbar from '../../../Component/Navbar/navbar';
import Footer from '../../../Component/Footer/footer';
import Back_To_Top_Button from '../../../Component/Back_To_Top_Button/Back_To_Top_Button';
import TawkMessenger from '../../../Component/TawkMessenger/TawkMessenger';
import { AuthProvider } from '../../../Component/AuthContext/AuthContext';

//Import css
import './About_Us.css';

//Import Images
import About from '../../../public/About_Us_2.jpg';
import Profile_1 from '../../../public/Profile_1.jpg';
import Profile_2 from '../../../public/Profile_2.jpg';
import Profile_3 from '../../../public/Profile_3.jpg';

//Import Icon
import { FaHotel } from "react-icons/fa6";
import { MdOutlineTravelExplore } from "react-icons/md";
import { MdDining } from "react-icons/md";
import { FaTruckPlane } from "react-icons/fa6";
import { MdCardTravel } from "react-icons/md";
import { MdAttachMoney } from "react-icons/md";

const About_Us = () => {
  return (
    <div className="About_Us_Container_Main">
      <AuthProvider>
        <Navbar />

        {/*Hero Section*/}
        <div className='hero-section'>
          <div className="container_hero">
            <h1>We Care We Share</h1>
            <p>Your Gateway to Sarawak's Best Experiences</p>
          </div>
        </div>

        {/*Topic*/}
        <div className='topic_about_us'>
          <h1>About Us</h1>
          <p>A Company With Passion</p>
        </div>

        {/*About_Us Content*/}
        <div className="container_About_Us">
          <section className="about_Us">
            <div className="about_us-image">
              <img src={About} alt="About Hello Sarawak" />
            </div>
            <div className="about_us-content">
              <h1>Our Mission - Your Perfect Stay</h1>
              <p>
                We are committed to offering our guests the best of Sarawak, from breathtaking natural wonders to 
                thrilling escapades. Surrounded by the pristine beauty of the region, our mission is to deliver 
                exceptional hospitality and unforgettable memories. Come, let the spirit of adventure guide your stay.
              </p>

              <div className="buttons_about_us">
                <button>SEE MORE</button>
              </div>
            </div>
          </section>
        </div>

        {/*Service Topic*/}
        <div className='topic_about_us'>
          <h1>Our Service</h1>
        </div>

        {/*Service Section*/}
        <div className="service_section">
          <div className="service_container">
            <div className="service_card">
              <FaHotel className='Service_Icon'/>
              <h4 className="card_heading">Scenic Accommodations</h4>
              <p>Relax in cozy rooms with breathtaking nature views.</p>
            </div>

            <div className="service_card">
              <MdOutlineTravelExplore className='Service_Icon'/>
              <h4 className="card_heading">Adventure Planning</h4>
              <p>Expert help for booking unforgettable adventures.</p>
            </div>

            <div className="service_card">
              <MdDining className='Service_Icon'/>
              <h4 className="card_heading">Local Dining</h4>
              <p>Enjoy authentic Sarawak flavors at our restaurant.</p>
            </div>

            <div className="service_card">
              <FaTruckPlane className='Service_Icon'/>
              <h4 className="card_heading">Transfer Services</h4>
              <p>Convenient transport to the airport and attractions.</p>
            </div>

            <div className="service_card">
              <MdCardTravel className='Service_Icon'/>
              <h4 className="card_heading">Tour Desk</h4>
              <p>Get recommendations and arrange tours effortlessly.</p>
            </div>

            <div className="service_card">
              <MdAttachMoney className='Service_Icon'/>
              <h4 className="card_heading">Group Packages</h4>
              <p>Custom experiences for families and groups.</p>
            </div>
          </div>
        </div>

        {/* Company Founder/Member */}
        <div className='Profile_Member'>
          <h1>Our Founders</h1>
          <div className='Profile_container'>
            {/* Profile Card 1 */}
            <div className='Profile_card'>
              <div className='Profile_image'>
                <img alt='Profile of John Doe' src={Profile_1} />
              </div>
              <div className="profile-content">
                <h3>John Doe</h3>
                <p>Hello Sarawak Co-founder and Chief Executive Officer</p>
              </div>
            </div>

            {/* Profile Card 2 */}
            <div className='Profile_card'>
              <div className='Profile_image'>
                <img alt='Profile of Curlos' src={Profile_2} />
              </div>
              <div className="profile-content">
                <h3>Curlos</h3>
                <p>Hello Sarawak Co-founder and Chief Strategy Officer</p>
              </div>
            </div>

            {/* Profile Card 3 */}
            <div className='Profile_card'>
              <div className='Profile_image'>
                <img alt='Profile of Mart' src={Profile_3} />
              </div>
              <div className="profile-content">
                <h3>Mart</h3>
                <p>Hello Sarawak Co-founder and Chairman of Hello Sarawak</p>
              </div>
            </div>
          </div>
        </div>

        <Back_To_Top_Button />
        <Footer />
        <TawkMessenger />
      </AuthProvider>
    </div>
  );
};

export default About_Us;
