import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;

    const run = async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session) navigate("/app/onboarding", { replace: true });
    };

    run();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) navigate("/app/onboarding", { replace: true });
    });

    return () => {
      aliveRef.current = false;
      sub?.subscription?.unsubscribe();
    };
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (aliveRef.current) setErrorMsg("");
    if (aliveRef.current) setLoading(true);

    const emailNorm = String(email || "").trim().toLowerCase();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailNorm,
      password
    });

    if (aliveRef.current) setLoading(false);

    if (error) {
      if (aliveRef.current) setErrorMsg(error.message);
      return;
    }

    // Some environments can take a moment to persist the session.
    // Confirm session exists before routing.
    if (!data?.session) {
      const { data: s } = await supabase.auth.getSession();
      if (!s?.session) {
        if (aliveRef.current) setErrorMsg("Login succeeded but session was not available yet. Please try again.");
        return;
      }
    }

    navigate("/app/onboarding", { replace: true });
  };

  return (
    <div
      style={{
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        background: "#0f0f0f",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "480px",
          background: "#111",
          border: "1px solid #222",
          borderRadius: "10px",
          padding: "2rem",
          boxSizing: "border-box"
        }}
      >
        <div style={{ fontWeight: 800, fontSize: "1.25rem", marginBottom: "0.75rem" }}>
          PhysiquePilot
        </div>
        <h1 style={{ margin: 0, fontSize: "1.8rem" }}>Welcome back</h1>
        <p style={{ marginTop: "0.75rem", color: "#aaa", lineHeight: 1.6 }}>
          Log in to access your dashboard, training log, nutrition targets, and trends.
        </p>

        <form onSubmit={handleLogin} style={{ marginTop: "1.25rem" }}>
          <label style={{ display: "block", color: "#aaa", marginBottom: "0.35rem" }}>Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: "100%",
              padding: "0.75rem",
              background: "#0b0b0b",
              color: "#fff",
              border: "1px solid #333",
              borderRadius: "8px",
              outline: "none",
              marginBottom: "0.9rem"
            }}
          />

          <label style={{ display: "block", color: "#aaa", marginBottom: "0.35rem" }}>Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: "100%",
              padding: "0.75rem",
              background: "#0b0b0b",
              color: "#fff",
              border: "1px solid #333",
              borderRadius: "8px",
              outline: "none",
              marginBottom: "1rem"
            }}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "0.85rem",
              background: loading ? "transparent" : "#2a2a2a",
              color: loading ? "#666" : "#fff",
              border: "1px solid #333",
              borderRadius: "8px",
              cursor: loading ? "default" : "pointer",
              fontSize: "1rem",
              fontWeight: 700
            }}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        {errorMsg && (
          <div
            style={{
              marginTop: "1rem",
              padding: "0.75rem",
              border: "1px solid #3a1f1f",
              background: "#1a0f0f",
              borderRadius: "8px",
              color: "#ff6b6b"
            }}
          >
            {errorMsg}
          </div>
        )}

        <div style={{ marginTop: "1.25rem", display: "flex", justifyContent: "space-between", gap: "1rem" }}>
          <button
            type="button"
            onClick={() => navigate("/")}
            style={{
              background: "transparent",
              color: "#aaa",
              border: "none",
              padding: 0,
              cursor: "pointer",
              textDecoration: "underline"
            }}
          >
            Back to home
          </button>

          <button
            type="button"
            onClick={() => navigate("/register")}
            style={{
              background: "transparent",
              color: "#fff",
              border: "none",
              padding: 0,
              cursor: "pointer",
              textDecoration: "underline",
              fontWeight: 600
            }}
          >
            Create an account
          </button>
        </div>
      </div>
    </div>
  );
}

export default Login;
