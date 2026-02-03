import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import AppLayout from "./layouts/AppLayout";
import WeightTracking from "./pages/WeightTracking";
import Nutrition from "./pages/Nutrition";
import CardioSteps from "./pages/CardioSteps";
import Training from "./pages/Training";
import CheckIns from "./pages/CheckIns";
import Coach from "./pages/Coach";
import Settings from "./pages/Settings";

function RequireAuth({ children }) {
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setHasSession(!!data?.session);
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setHasSession(!!session);
      setReady(true);
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  if (!ready) return <div style={{ padding: "2rem" }}>Loading…</div>;
  if (!hasSession) return <Navigate to="/login" replace />;
  return children;
}

function RequireOnboardingComplete({ children }) {
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      // Must be logged in first
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      if (!user) {
        if (!mounted) return;
        setAllowed(false);
        setReady(true);
        return;
      }

      // Support both column names just in case
      const { data: pData } = await supabase
        .from("profiles")
        .select("onboarding_complete, onboarding_completed")
        .eq("user_id", user.id)
        .maybeSingle();

      const complete = pData?.onboarding_complete === true || pData?.onboarding_completed === true;

      if (!mounted) return;
      setAllowed(!!complete);
      setReady(true);
    };

    run();

    return () => {
      mounted = false;
    };
  }, []);

  if (!ready) return <div style={{ padding: "2rem" }}>Loading…</div>;
  if (!allowed) return <Navigate to="/app/onboarding" replace />;
  return children;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Onboarding: must be logged in, but does NOT require onboarding completion */}
      <Route
        path="/app/onboarding"
        element={
          <RequireAuth>
            <Onboarding />
          </RequireAuth>
        }
      />

      {/* Main app: must be logged in AND have completed onboarding */}
      <Route
        path="/app"
        element={
          <RequireAuth>
            <RequireOnboardingComplete>
              <AppLayout />
            </RequireOnboardingComplete>
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/app/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="weight" element={<WeightTracking />} />
        <Route path="nutrition" element={<Nutrition />} />
        <Route path="training" element={<Training />} />
        <Route path="cardio-steps" element={<CardioSteps />} />
        <Route path="check-ins" element={<CheckIns />} />
        <Route path="coach" element={<Coach />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;