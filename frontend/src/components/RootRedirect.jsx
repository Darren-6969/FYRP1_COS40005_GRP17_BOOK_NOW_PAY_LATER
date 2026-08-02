import { Navigate } from "react-router-dom";
import { getUser as getStoredUser, getToken as getStoredToken } from "../utils/session";

function defaultPathForRole(role) {
  if (role === "MASTER_SELLER") return "/master/dashboard";
  if (role === "NORMAL_SELLER") return "/operator/dashboard";
  if (role === "CUSTOMER") return "/customer/bookings";
  return "/login";
}

// "/" honours an existing session, so "Remember me" lands the user on their
// dashboard instead of bouncing them to the login page.
export default function RootRedirect() {
  const user = getStoredUser();
  const token = getStoredToken();

  if (!token || !user) return <Navigate to="/login" replace />;

  return <Navigate to={defaultPathForRole(user.role)} replace />;
}