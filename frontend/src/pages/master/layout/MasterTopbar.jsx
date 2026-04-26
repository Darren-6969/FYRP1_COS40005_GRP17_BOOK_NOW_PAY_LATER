import { Bell } from "lucide-react";

export default function MasterTopbar() {
  return (
    <header className="topbar">
      <h2>Admin Dashboard</h2>

      <div className="topbar-right">
        <span className="tenant-pill">GoCar · scootbooking</span>
        <button className="icon-btn">
          <Bell size={16} />
        </button>
      </div>
    </header>
  );
}