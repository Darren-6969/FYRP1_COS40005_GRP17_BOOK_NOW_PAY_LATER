import { Outlet } from "react-router-dom";
import MasterSidebar from "./MasterSidebar";
import MasterTopbar from "./MasterTopbar";

export default function MasterLayout() {
  return (
    <div className="app-shell">
      <MasterSidebar />
      <main className="main-area">
        <MasterTopbar />
        <div className="page-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}