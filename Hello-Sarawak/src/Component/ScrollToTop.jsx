import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    // Forces window to top-left corner instantly when path changes
    window.scrollTo(0, 0);
  }, [pathname]); // <--- dependency: runs every time the URL path changes

  return null;
};

export default ScrollToTop;