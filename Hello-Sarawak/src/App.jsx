import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, RouterProvider, Outlet } from 'react-router-dom'; // Added Outlet

// Import Pages
import Home from './Pages/customer/Home/Home';
import Login from './Pages/customer/Login/Login';
import Register from './Pages/customer/Register/Register';
import ModeratorDashboard from './Pages/moderator/ModeratorDashboard';
import AdminDashboard from './Pages/administrator/AdminDashboard';
import OwnerDashboard from './Pages/cams_owner/OwnerDashboard';
import AboutSarawak from './Pages/customer/About_Sarawak/about_sarawak';
import Product from './Pages/customer/Product/product';
import PropertyDetails from './Pages/customer/PropertyDetails/PropertyDetails';
import Cart from './Pages/customer/Cart/cart';
import AboutUs from './Pages/customer/About_us/About_Us';
import NoAccess from './Component/NoAccess/NoAccess';
import Error from './Component/Error_404/Error';
import Profile from './Pages/customer/Profile/Profile';

// Import ScrollToTop
import ScrollToTop from './Component/ScrollToTop';

const queryClient = new QueryClient();

// 1. Create a Layout Component
// This component runs on EVERY page change. 
// It forces the scroll to top, then renders the page content (Outlet).
const RootLayout = () => {
  return (
    <>
      <ScrollToTop />
      <Outlet />
    </>
  );
};

// 2. Wrap your routes inside the RootLayout
const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />, // <--- WRAPPER HERE
    children: [
      // All your existing routes go here as "children"
      { index: true, element: <Home /> }, // Use 'index: true' for the default path
      { path: 'home', element: <Home /> },
      { path: 'register', element: <Register /> },
      { path: 'login', element: <Login /> },
      { path: 'about_sarawak', element: <AboutSarawak /> },
      { path: 'product', element: <Product /> },
      { path: 'product/:propertyid', element: <PropertyDetails /> },
      { path: 'cart', element: <Cart /> },
      { path: 'about_us', element: <AboutUs /> },
      { path: 'profile', element: <Profile /> },
      
      // These complex routes can stay as they are, or be children too.
      // Since they have their own internal routing (/*), we keep them here.
      { path: 'administrator_dashboard/*', element: <AdminDashboard /> },
      { path: 'moderator_dashboard/*', element: <ModeratorDashboard /> },
      { path: 'owner_dashboard/*', element: <OwnerDashboard /> },
      { path: 'no-access', element: <NoAccess /> },
      { path: '*', element: <Error /> },
    ],
  },
]);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

export default App;