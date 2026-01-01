import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import Sidebar from "../components/Sidebar";

function AppLayout() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;

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

      setLoading(false);
    };

    run();
  }, [navigate]);

  if (loading) return <div style={{ padding: "2rem" }}>Loading...</div>;

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        width: "100vw",
        background: "#0f0f0f",
        color: "#fff"
      }}
    >
      <Sidebar />

      <main
        style={{
          flex: 1,
          padding: "2rem",
          overflowX: "hidden"
        }}
      >
        {/* THIS is the only width constraint in the entire app */}
        <div
          style={{
            width: "100%",
            maxWidth: "1920px",
            margin: "0 auto"
          }}
        >
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default AppLayout;