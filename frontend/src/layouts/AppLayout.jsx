import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import Sidebar from "../components/Sidebar";

function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;

    const guard = async () => {
      try {
        if (aliveRef.current) setLoading(true);

        const { data, error: sessErr } = await supabase.auth.getSession();
        const session = data?.session;

        // If not authenticated, always go back to landing
        if (sessErr || !session) {
          navigate("/", { replace: true });
          return;
        }

        // Onboarding route should always be accessible while signed in,
        // even if the profile row hasn't been created yet (race after sign-up).
        const isOnboardingRoute = location.pathname.startsWith("/app/onboarding");

        const { data: profile, error } = await supabase
          .from("profiles")
          .select("onboarding_complete")
          .eq("user_id", session.user.id)
          .maybeSingle();

        // If profile fetch fails for any reason, still allow onboarding route
        if (error && !isOnboardingRoute) {
          navigate("/", { replace: true });
          return;
        }

        const onboardingComplete = profile?.onboarding_complete === true;

        // If onboarding not complete (or profile missing), force user onto onboarding
        if (!onboardingComplete) {
          if (!isOnboardingRoute) {
            navigate("/app/onboarding", { replace: true });
            return;
          }
          // Already on onboarding, allow render
          if (aliveRef.current) setLoading(false);
          return;
        }

        // Onboarding complete -> keep users out of onboarding page
        if (onboardingComplete && isOnboardingRoute) {
          navigate("/app", { replace: true });
          return;
        }

        if (aliveRef.current) setLoading(false);
      } catch {
        // Safe fallback
        navigate("/", { replace: true });
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
  }, [navigate, location.pathname]);

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