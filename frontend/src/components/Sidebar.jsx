import { NavLink, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

function Sidebar() {
  const navigate = useNavigate();

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/", { replace: true });
  };

  const linkStyle = ({ isActive }) => ({
    padding: "0.7rem 0.9rem",
    textDecoration: "none",
    color: isActive ? "#fff" : "#aaa",
    background: isActive ? "#1e1e1e" : "transparent",
    borderRadius: "10px",
    whiteSpace: "nowrap"
  });

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
        <NavLink to="/app/dashboard" style={linkStyle}>Dashboard</NavLink>
        <NavLink to="/app/weight" style={linkStyle}>Weight</NavLink>
        <NavLink to="/app/nutrition" style={linkStyle}>Nutrition</NavLink>
        <NavLink to="/app/training" style={linkStyle}>Training</NavLink>
        <NavLink to="/app/cardio-steps" style={linkStyle}>Cardio & Steps</NavLink>
        <NavLink to="/app/check-ins" style={linkStyle}>Check-ins</NavLink>
        <NavLink to="/app/coach" style={linkStyle}>Coach</NavLink>
        <NavLink to="/app/settings" style={linkStyle}>Settings</NavLink>
      </nav>
    </aside>
  );
}

export default Sidebar;