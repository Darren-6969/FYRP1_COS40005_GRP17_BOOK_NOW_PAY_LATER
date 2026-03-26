import React from 'react';

//Import Component
import Navbar from '../../../Component/Navbar/navbar';
import Footer from '../../../Component/Footer/footer';
import Back_To_Top_Button from '../../../Component/Back_To_Top_Button/Back_To_Top_Button';
import TawkMessenger from '../../../Component/TawkMessenger/TawkMessenger';
import { AuthProvider } from '../../../Component/AuthContext/AuthContext';

//Import css
import './about_sarawak.css';

//Import Images
import Bako from '../../../public/Bako.jpg';
import Bird from '../../../public/Bird.jpg';
import Sarawak from '../../../public/Sarawak.png';
import Cave from '../../../public/cave.jpg';
import Cave2 from '../../../public/monkey.png';
import Temple from '../../../public/Temple.jpg';
import Church from '../../../public/Church.png';
import Laksa from '../../../public/Laksa.jpg';
import KoloMee from '../../../public/KoloMee.png';
import Forest from '../../../public/forest.png';

const Section = ({ title, description, imgLeft, imgRight }) => {
  return (
    <div className='first-des_AboutSarawak'>
      <div className='des-text_AboutSarawak'>
        <h2>{title}</h2>
        <p className='location_description_AboutSarawak'>
          {description}
        </p>
      </div>

      <div className='image_AboutSarawak'>
        <img alt={`${title} image 1`} src={imgLeft} />
        <img alt={`${title} image 2`} src={imgRight} />
      </div>
    </div>
  );
};

const About_Sarawak = () => {
  const sections = [
    {
      title: "About Sarawak",
      description: "Nestled on the island of Borneo, Sarawak is Malaysia's largest state, renowned for its rich cultural tapestry, diverse wildlife, and breathtaking natural landscapes. Often referred to as the \"Land of the Hornbills,\" Sarawak offers an unparalleled journey into the heart of Southeast Asia.",
      imgLeft: Bird,
      imgRight: Sarawak
    },
    {
      title: "Cultural Diversity",
      description: "Home to over 27 ethnic groups, including the Iban, Bidayuh, and Orang Ulu, Sarawak boasts a mosaic of traditions, languages, and beliefs. Visitors can immerse themselves in this cultural diversity by exploring traditional longhouses, participating in local festivals, and visiting the Sarawak Cultural Village, which showcases the heritage of these indigenous communities.",
      imgLeft: Temple,
      imgRight: Church
    },
    {
      title: "Natural Wonders",
      description: "Sarawak's lush rainforests and diverse ecosystems are protected within numerous national parks. Bako National Park, easily accessible from Kuching, is famed for its proboscis monkeys and varied landscapes. Gunung Mulu National Park, a UNESCO World Heritage Site, captivates with its vast cave systems and the iconic limestone Pinnacles.",
      imgLeft: Bako,
      imgRight: Forest
    },
    {
      title: "Wildlife Encounters",
      description: "For wildlife enthusiasts, Sarawak offers opportunities to observe orangutans in their natural habitat at centers like the Semenggoh Wildlife Rehabilitation Centre. The state's rivers and coastal areas are also home to diverse marine life and bird species, making it a haven for nature lovers.",
      imgLeft: Cave,
      imgRight: Cave2
    },
    {
      title: "Culinary Delights",
      description: "The state's diverse cultural landscape is mirrored in its cuisine. Dishes like Sarawak laksa, kolo mee, and traditional Iban fare offer a gastronomic journey that delights the senses. Exploring local markets and food stalls provides an authentic taste of Sarawak's culinary heritage.",
      imgLeft: Laksa,
      imgRight: KoloMee
    }
  ];

  return (
    <div>
      <div className='About_Sarawak_Container'>

        <AuthProvider>
          <Navbar />

          <div className='destination_AboutSarawak'>

            <div className='Main_description_AboutSarawak'>
              <h1>About Sarawak</h1>
              <p>Adventure, Culture and Nature in One</p>
            </div>

            {sections.map((section, index) => (
              <React.Fragment key={index}>
                <Section
                  title={section.title}
                  description={section.description}
                  imgLeft={section.imgLeft}
                  imgRight={section.imgRight}
                />
                {index < sections.length - 1 && <div className="section-divider"></div>}
              </React.Fragment>
            ))}
          </div>

              <Back_To_Top_Button />
            <Footer />
          <TawkMessenger />
        </AuthProvider>

      </div>
    </div>
  );
};

export default About_Sarawak;