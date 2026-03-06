import { useEffect, useRef, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import Sidebar from "../components/Sidebar";

/* ─── Cockpit boot loader ─────────────────────────────────────────────────── */
function CockpitLoader() {
  return (
    <div
      role="status"
      aria-label="Initialising systems"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-0)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Faint radial glow behind the text */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(600px 320px at 50% 50%, rgba(181,21,60,0.13), transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Brand wordmark */}
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(1.6rem, 4vw, 2.8rem)",
          fontWeight: 700,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "var(--text-1)",
          display: "flex",
          alignItems: "center",
          gap: "0.7rem",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Blinking status dot */}
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            width: "9px",
            height: "9px",
            borderRadius: "50%",
            background: "var(--accent-3)",
            boxShadow: "0 0 8px var(--accent-2)",
            flexShrink: 0,
            animation: "pp-loader-blink 1.4s step-start infinite",
          }}
        />
        PHYSIQUE PILOT
      </div>

      {/* Sub-label */}
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "0.7rem",
          letterSpacing: "0.22em",
          color: "var(--text-3)",
          marginTop: "0.9rem",
          textTransform: "uppercase",
          position: "relative",
          zIndex: 1,
          animation: "pp-loader-fade 0.6s ease forwards",
        }}
      >
        Loading...
      </div>

      {/* Red progress bar at the bottom of the viewport */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: "2px",
          background: "var(--bg-1)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            background:
              "linear-gradient(90deg, var(--accent-1), var(--accent-3) 60%, var(--accent-2))",
            boxShadow: "0 0 10px var(--accent-2)",
            animation: "pp-loader-bar 1.8s cubic-bezier(0.4,0,0.2,1) infinite",
            transformOrigin: "left",
          }}
        />
      </div>

      <style>{`
        @keyframes pp-loader-blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.1; }
        }
        @keyframes pp-loader-fade {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pp-loader-bar {
          0%   { transform: scaleX(0)   translateX(0); opacity: 1; }
          60%  { transform: scaleX(0.7) translateX(0); opacity: 1; }
          100% { transform: scaleX(1)   translateX(0); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

/* ─── AppLayout ───────────────────────────────────────────────────────────── */
function AppLayout() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const aliveRef = useRef(true);
  const hasCheckedRef = useRef(false);
  const isGuardRunningRef = useRef(false);

  useEffect(() => {
    aliveRef.current = true;

    const finish = () => {
      if (aliveRef.current) {
        hasCheckedRef.current = true;
        setLoading(false);
      }
    };

    const go = (path) => {
      const currentPath = window.location.pathname;
      // Avoid pointless re-navigations that can cause flicker
      if (currentPath !== path) navigate(path, { replace: true });
    };

    const guard = async () => {
      // Prevent overlapping guards (can happen on rapid auth events)
      if (isGuardRunningRef.current) return;
      isGuardRunningRef.current = true;

      try {
        // Only show the full-screen loader on the very first check
        if (aliveRef.current && !hasCheckedRef.current) setLoading(true);

        const { data, error: sessErr } = await supabase.auth.getSession();
        const session = data?.session;

        // If not authenticated, always go back to landing
        if (sessErr || !session) {
          finish();
          go("/");
          return;
        }

        const currentPath = window.location.pathname;
        const isOnboardingRoute = currentPath.startsWith("/app/onboarding");

        const { data: profile, error } = await supabase
          .from("profiles")
          .select("onboarding_complete")
          .eq("user_id", session.user.id)
          .maybeSingle();

        // PGRST116 = no rows; treat as onboarding not complete.
        // Any other error (permissions, schema, network) should not create a redirect loop.
        if (error && error.code !== "PGRST116") {
          console.warn("profiles read failed:", error);
          // Keep user on onboarding if they're already there; otherwise send them there.
          finish();
          if (!isOnboardingRoute) go("/app/onboarding");
          return;
        }

        const onboardingComplete = profile?.onboarding_complete === true;

        if (!onboardingComplete) {
          // Force user onto onboarding until complete
          finish();
          if (!isOnboardingRoute) go("/app/onboarding");
          return;
        }

        // Onboarding complete -> keep users out of onboarding page
        finish();
        if (isOnboardingRoute) {
          go("/app");
          return;
        }
      } catch (err) {
        console.warn("AppLayout guard failed:", err);
        finish();
        // If something unexpected happens, at least don't trap them in a spinner loop.
        go("/");
      } finally {
        isGuardRunningRef.current = false;
      }
    };

    guard();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      guard();
    });

    return () => {
      aliveRef.current = false;
      try {
        sub?.subscription?.unsubscribe?.();
      } catch {}
    };
  }, [navigate]);

  if (loading) {
    return <CockpitLoader />;
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <Sidebar />
      </aside>

      <main className="app-content">
        <div className="app-content-inner">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default AppLayout;
