import { useEffect, useRef, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import Sidebar from "../components/Sidebar";

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
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f0f0f",
          color: "#fff"
        }}
      >
        Loading…
      </div>
    );
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