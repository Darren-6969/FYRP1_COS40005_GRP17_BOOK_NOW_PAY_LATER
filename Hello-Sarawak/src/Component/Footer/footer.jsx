import React from 'react';
import { Link } from 'react-router-dom';
import './footer.css';

import { RiFacebookCircleFill } from "react-icons/ri";
import { FiInstagram } from "react-icons/fi";
import { FaWhatsapp } from "react-icons/fa";
import { RiTwitterXFill } from "react-icons/ri";
import { MdEmail } from "react-icons/md";
import { FaPhoneAlt } from "react-icons/fa";

const Footer = () => {
  return (
    <div className='footer'>

      <div className='footer-row'>

        <div className='top'>

          <div>
            <h1>Hello Sarawak</h1>
            <p>Your Journey Begin</p>
          </div>

          <div className="icons_footer">

            <Link to='https://www.facebook.com/'>
              <RiFacebookCircleFill className='icon_footer' />
            </Link>

            <Link to='https://www.instagram.com/'>
              <FiInstagram className='icon_footer' />
            </Link>

            <Link to='https://web.whatsapp.com/'>
              <FaWhatsapp className='icon_footer' />
            </Link>

            <Link to='https://x.com/'>
              <RiTwitterXFill className='icon_footer' />
            </Link>

          </div>

        </div>

        <div className='bottom'>

          <div>
            <h3>Tour</h3>
            <a href='/'>Damai Beach</a>
            <a href='/'>Bako National Park</a>
            <a href='/'>Kuching Waterfront</a>
            <a href='/'>Gunung Mulu National Park</a>
          </div>

          <div>
            <h3>Support</h3>
            <a href='/'>FAQ</a>
            <a href='/'>Privacy Policy</a>
            <a href='/'>Help</a>
          </div>

          <div>

            <h3>Contact Us</h3>
              <p>
                <MdEmail className='icon' />  project@webnyou.com
              </p>

              <p>
                <FaPhoneAlt className='icon' /> +6016-888 XXXX
              </p>

          </div>

        </div>

      </div>

    </div>

  );
};

export default Footer;
