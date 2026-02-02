import { useEffect, useRef, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import Sidebar from "../components/Sidebar";

function AppLayout() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;

    const guard = async () => {
      // While we check auth/profile, keep the layout in a loading state
      if (aliveRef.current) setLoading(true);

      const { data, error: sessErr } = await supabase.auth.getSession();
      const session = data?.session;

      if (sessErr) {
        // If session fetch fails, send user to landing
        navigate("/", { replace: true });
        return;
      }

      if (!session) {
        navigate("/", { replace: true });
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("onboarding_complete")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        navigate("/", { replace: true });
        return;
      }

      if (!profile || !profile.onboarding_complete) {
        navigate("/app/onboarding", { replace: true });
        return;
      }

      if (aliveRef.current) setLoading(false);
    };

    // Run once on mount
    guard();

    // Re-run whenever auth changes (login/logout/refresh)
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