import { Navigate, Outlet, useLocation } from "react-router-dom";

function getStoredUser() {
  try {
    const rawUser = localStorage.getItem("user") || sessionStorage.getItem("user");
    return rawUser ? JSON.parse(rawUser) : null;
  } catch {
    return null;
  }
}

function getStoredToken() {
  return (
    localStorage.getItem("bnpl_token") ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("bnpl_token") ||
    sessionStorage.getItem("token")
  );
}

function defaultPathForRole(role) {
  if (role === "MASTER_SELLER") return "/master/dashboard";
  if (role === "NORMAL_SELLER") return "/operator/dashboard";
  if (role === "CUSTOMER") return "/customer/bookings";
  return "/login";
}

export default function ProtectedRoute({ allowedRoles = [] }) {
  const location = useLocation();
  const user = getStoredUser();
  const token = getStoredToken();

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