import { NavLink, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

// Single glyph used for every nav item (weight hexagon)
const GLYPH = "⬡";

const NAV_ITEMS = [
  { to: "/app/dashboard",    label: "DASHBOARD"  },
  { to: "/app/weight",       label: "WEIGHT"     },
  { to: "/app/nutrition",    label: "NUTRITION"  },
  { to: "/app/training",     label: "TRAINING"   },
  { to: "/app/cardio-steps", label: "ACTIVITY"   },
  { to: "/app/habits",       label: "HABITS"     },
  { to: "/app/check-ins",    label: "CHECK-INS"  },
  { to: "/app/coach",        label: "THE PILOT"  },
];

const SETTINGS_ITEM = { to: "/app/settings", label: "SETTINGS" };

// Active tab → green pulsing dot. Inactive → dim hexagon glyph.
function NavIndicator({ isActive }) {
  if (isActive) {
    return (
      <span
        aria-hidden="true"
        style={{
          display: "inline-block",
          width: "7px",
          height: "7px",
          borderRadius: "50%",
          background: "var(--ok)",
          boxShadow: "0 0 8px var(--ok)",
          flexShrink: 0,
          animation: "pp-blink 1.4s step-start infinite",
          marginRight: "0.7rem",
          verticalAlign: "middle",
        }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      style={{
        fontFamily: "var(--font-display)",
        fontSize: "0.78rem",
        opacity: 0.4,
        marginRight: "0.65rem",
        letterSpacing: 0,
      }}
    >
      {GLYPH}
    </span>
  );
}

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
          ⏻ Sign out
        </button>
      </div>

      {/* ── Primary nav ── */}
      <nav className="pp-sidebar-nav" aria-label="Primary navigation">
        {NAV_ITEMS.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `pp-nav-link${isActive ? " is-active" : ""}`}
          >
            {({ isActive }) => (
              <>
                <NavIndicator isActive={isActive} />
                {label}
              </>
            )}
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
          {({ isActive }) => (
            <>
              <NavIndicator isActive={isActive} />
              {SETTINGS_ITEM.label}
            </>
          )}
        </NavLink>
      </nav>

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
