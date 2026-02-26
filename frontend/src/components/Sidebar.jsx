import { NavLink, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

function Sidebar() {
  const navigate = useNavigate();

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/", { replace: true });
  };

  return (
    <aside className="pp-sidebar">
      <div className="pp-sidebar-header">
        <div className="pp-sidebar-brand">PhysiquePilot</div>

        <button
          onClick={logout}
          className="pp-logout-btn"
          type="button"
          aria-label="Logout"
        >
          Logout
        </button>
      </div>

      <nav className="pp-sidebar-nav">
        <NavLink to="/app/dashboard" className={({ isActive }) => `pp-nav-link${isActive ? " is-active" : ""}`}>Dashboard</NavLink>
        <NavLink to="/app/weight" className={({ isActive }) => `pp-nav-link${isActive ? " is-active" : ""}`}>Weight</NavLink>
        <NavLink to="/app/nutrition" className={({ isActive }) => `pp-nav-link${isActive ? " is-active" : ""}`}>Nutrition</NavLink>
        <NavLink to="/app/training" className={({ isActive }) => `pp-nav-link${isActive ? " is-active" : ""}`}>Training</NavLink>
        <NavLink to="/app/cardio-steps" className={({ isActive }) => `pp-nav-link${isActive ? " is-active" : ""}`}>Cardio & Steps</NavLink>
        <NavLink to="/app/check-ins" className={({ isActive }) => `pp-nav-link${isActive ? " is-active" : ""}`}>Check-ins</NavLink>
        <NavLink to="/app/coach" className={({ isActive }) => `pp-nav-link${isActive ? " is-active" : ""}`}>Coach</NavLink>
        <NavLink to="/app/settings" className={({ isActive }) => `pp-nav-link${isActive ? " is-active" : ""}`}>Settings</NavLink>
      </nav>
    </aside>
  );
}

export default Sidebar;
