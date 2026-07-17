import { Navigate, Outlet } from "react-router-dom";
import { getUser as getStoredUser } from "../utils/session";

export default function OperatorAccessRoute({ allowedAccess = [] }) {
  const user = getStoredUser();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === "MASTER_SELLER") {
    return <Outlet />;
  }

  if (user.role !== "NORMAL_SELLER") {
    return <Navigate to="/login" replace />;
  }

  if (!allowedAccess.includes(user.operatorAccessLevel)) {
    return <Navigate to="/operator/dashboard" replace />;
  }

  return <Outlet />;
}