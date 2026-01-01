import { NavLink, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

function Sidebar() {
  const navigate = useNavigate();

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/", { replace: true });
  };

  const linkStyle = ({ isActive }) => ({
    padding: "0.75rem 1rem",
    textDecoration: "none",
    color: isActive ? "#fff" : "#aaa",
    background: isActive ? "#1e1e1e" : "transparent"
  });

  return (
    <aside style={{ width: "220px", borderRight: "1px solid #1e1e1e" }}>
      <div style={{ padding: "1.5rem", fontWeight: "bold", fontSize: "1.1rem" }}>
        PhysiquePilot
      </div>

      <nav style={{ display: "flex", flexDirection: "column" }}>
        <NavLink to="/app/dashboard" style={linkStyle}>Dashboard</NavLink>
        <NavLink to="/app/weight" style={linkStyle}>Weight Tracking</NavLink>
        <NavLink to="/app/nutrition" style={linkStyle}>Nutrition</NavLink>
        <NavLink to="/app/training" style={linkStyle}>Training</NavLink>
        <NavLink to="/app/cardio-steps" style={linkStyle}>Cardio & Steps</NavLink>
        <NavLink to="/app/check-ins" style={linkStyle}>Check-ins</NavLink>
        <NavLink to="/app/coach" style={linkStyle}>Coach</NavLink>
        <NavLink to="/app/settings" style={linkStyle}>Settings</NavLink>
        <button
          onClick={logout}
          style={{
            margin: "1rem",
            padding: "0.5rem",
            background: "#1e1e1e",
            color: "#fff",
            border: "none",
            cursor: "pointer"
          }}
        >
          Logout
        </button>
      </nav>
    </aside>
  );
}

export default Sidebar;