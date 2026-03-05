import { NavLink, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

const NAV_ITEMS = [
  { to: "/app/dashboard",   label: "DASHBOARD",  glyph: "◈" },
  { to: "/app/weight",      label: "WEIGHT",     glyph: "⬡" },
  { to: "/app/nutrition",   label: "NUTRITION",  glyph: "◉" },
  { to: "/app/training",    label: "TRAINING",   glyph: "⬟" },
  { to: "/app/cardio-steps",label: "ACTIVITY",   glyph: "▲" },
  { to: "/app/check-ins",   label: "CHECK-INS",  glyph: "◇" },
  { to: "/app/coach",       label: "AI COACH",   glyph: "⬡" },
];

const SETTINGS_ITEM = { to: "/app/settings", label: "SETTINGS", glyph: "◈" };

function Sidebar() {
  const navigate = useNavigate();

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/", { replace: true });
  };

  return (
    <aside className="pp-sidebar">
      {/* ── Header / Brand ── */}
      <div className="pp-sidebar-header">
        <div className="pp-sidebar-brand">
          <span
            aria-hidden="true"
            style={{
              display: "inline-block",
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              background: "var(--accent-3)",
              boxShadow: "0 0 6px var(--accent-2)",
              marginRight: "0.55rem",
              verticalAlign: "middle",
              animation: "pp-blink 1.4s step-start infinite",
              flexShrink: 0,
            }}
          />
          PHYSIQUE PILOT
        </div>

        <button
          onClick={logout}
          className="pp-logout-btn"
          type="button"
          aria-label="Logout"
          style={{ fontFamily: "var(--font-display)", letterSpacing: "0.08em", fontSize: "0.72rem" }}
        >
          ⏻ EJECT
        </button>
      </div>

      {/* ── Primary nav ── */}
      <nav className="pp-sidebar-nav" aria-label="Primary navigation">
        {NAV_ITEMS.map(({ to, label, glyph }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `pp-nav-link${isActive ? " is-active" : ""}`}
          >
            <span
              aria-hidden="true"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "0.8rem",
                opacity: 0.7,
                marginRight: "0.6rem",
                letterSpacing: 0,
              }}
            >
              {glyph}
            </span>
            {label}
          </NavLink>
        ))}

        {/* ── Section divider ── */}
        <div
          aria-hidden="true"
          style={{
            margin: "0.55rem 0.25rem",
            borderTop: "1px solid var(--line-1)",
            position: "relative",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: "50%",
              left: "0.5rem",
              transform: "translateY(-50%)",
              fontFamily: "var(--font-display)",
              fontSize: "0.58rem",
              letterSpacing: "0.18em",
              color: "var(--text-3)",
              background: "var(--bg-1)",
              padding: "0 0.35rem",
              pointerEvents: "none",
            }}
          >
            SYS
          </span>
        </div>

        {/* ── Settings ── */}
        <NavLink
          to={SETTINGS_ITEM.to}
          className={({ isActive }) => `pp-nav-link${isActive ? " is-active" : ""}`}
        >
          <span
            aria-hidden="true"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "0.8rem",
              opacity: 0.7,
              marginRight: "0.6rem",
              letterSpacing: 0,
            }}
          >
            {SETTINGS_ITEM.glyph}
          </span>
          {SETTINGS_ITEM.label}
        </NavLink>
      </nav>

      {/* ── System status readout ── */}
      <div
        aria-label="System status: online"
        style={{
          marginTop: "auto",
          padding: "0.9rem 1.15rem",
          borderTop: "1px solid var(--line-1)",
          display: "flex",
          alignItems: "center",
          gap: "0.55rem",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            width: "7px",
            height: "7px",
            borderRadius: "50%",
            background: "var(--ok)",
            boxShadow: "0 0 7px var(--ok)",
            flexShrink: 0,
            animation: "pp-blink 1.1s step-start infinite",
          }}
        />
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "0.65rem",
            letterSpacing: "0.2em",
            color: "var(--ok)",
            textTransform: "uppercase",
          }}
        >
          SYSTEM ONLINE
        </span>
      </div>

      {/* ── Keyframe for blink ── */}
      <style>{`
        @keyframes pp-blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.15; }
        }
      `}</style>
    </aside>
  );
}

export default Sidebar;
