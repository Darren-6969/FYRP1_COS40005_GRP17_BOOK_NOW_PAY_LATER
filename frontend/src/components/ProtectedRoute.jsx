import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getUser as getStoredUser, getToken as getStoredToken } from "../utils/session";
import { getMemoryUser, getMemoryToken } from "../utils/memorySession";

function defaultPathForRole(role) {
  if (role === "MASTER_SELLER") return "/master/dashboard";
  if (role === "NORMAL_SELLER") return "/operator/dashboard";
  if (role === "CUSTOMER") return "/customer/bookings";
  return "/login";
}

export default function ProtectedRoute({ allowedRoles = [] }) {
  const location = useLocation();
  const user = getMemoryUser() || getStoredUser();
  const token = getMemoryToken() || getStoredToken();

  if (!token || !user) {
    const redirectPath = `${location.pathname}${location.search || ""}`;
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(redirectPath)}`}
        replace
      />
    );
  }

  if (allowedRoles.length && !allowedRoles.includes(user.role)) {
    return <Navigate to={defaultPathForRole(user.role)} replace />;
  }

  return <Outlet />;
}