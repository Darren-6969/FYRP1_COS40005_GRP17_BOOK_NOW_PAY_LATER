import { useEffect } from 'react';

const TawkMessenger = () => {
  useEffect(() => {
    
    var s1 = document.createElement("script");
    var s0 = document.getElementsByTagName("script")[0];
    s1.async = true;
    s1.src = 'https://embed.tawk.to/67b5789155b96f1911e05195/1ikedtuei';
    s1.charset = 'UTF-8';
    s1.setAttribute('crossorigin', '*');
    s0.parentNode.insertBefore(s1, s0);

    
    return () => {
      
      const tawkScript = document.querySelector('script[src*="tawk.to"]');
      if (tawkScript) {
        tawkScript.remove();
      }
      const tawkWidget = document.getElementById('tawk-widget');
      if (tawkWidget) {
        tawkWidget.remove();
      }
    };
  }, []);

  return null;
};

export default TawkMessenger;