import { useEffect, useRef, useState, useLocation } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import Sidebar from "../components/Sidebar";

function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const aliveRef = useRef(true);
  const hasCheckedRef = useRef(false);
  const isGuardRunningRef = useRef(false);

  useEffect(() => {
    aliveRef.current = true;

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
          if (aliveRef.current) {
            hasCheckedRef.current = true;
            setLoading(false);
          }
          navigate("/", { replace: true });
          return;
        }

        // Use the real current path (avoid using location.pathname as an effect dependency)
        const currentPath = window.location.pathname;
        const isOnboardingRoute = currentPath.startsWith("/app/onboarding");

        const { data: profile, error } = await supabase
          .from("profiles")
          .select("onboarding_complete")
          .eq("user_id", session.user.id)
          .maybeSingle();

        // If profile fetch fails for any reason, still allow onboarding route
        if (error && !isOnboardingRoute) {
          if (aliveRef.current) {
            hasCheckedRef.current = true;
            setLoading(false);
          }
          navigate("/", { replace: true });
          return;
        }

        const onboardingComplete = profile?.onboarding_complete === true;

        // If onboarding not complete (or profile missing), force user onto onboarding
        if (!onboardingComplete) {
          if (!isOnboardingRoute) {
            if (aliveRef.current) {
              hasCheckedRef.current = true;
              setLoading(false);
            }
            navigate("/app/onboarding", { replace: true });
            return;
          }

          if (aliveRef.current) {
            hasCheckedRef.current = true;
            setLoading(false);
          }
          return;
        }

        // Onboarding complete -> keep users out of onboarding page
        if (onboardingComplete && isOnboardingRoute) {
          if (aliveRef.current) {
            hasCheckedRef.current = true;
            setLoading(false);
          }
          navigate("/app", { replace: true });
          return;
        }

        if (aliveRef.current) {
          hasCheckedRef.current = true;
          setLoading(false);
        }
      } catch {
        if (aliveRef.current) {
          hasCheckedRef.current = true;
          setLoading(false);
        }
        navigate("/", { replace: true });
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