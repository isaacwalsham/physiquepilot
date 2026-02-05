import { useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";

const API_URL = (
  String(import.meta.env.VITE_API_URL || "")
    .trim()
    .replace(/\/$/, "") ||
  (import.meta.env.DEV ? "http://localhost:4000" : "https://physiquepilot.onrender.com")
);

function Register() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);

    const emailClean = String(email || "").trim().toLowerCase();

    const { data, error } = await supabase.auth.signUp({
      email: emailClean,
      password
    });

    if (error) {
      setLoading(false);
      setErrorMsg(error.message);
      return;
    }

    const user = data?.user;

    // Try to create an initial profiles row.
    // If this fails due to auth/RLS/endpoint issues, don't block signup—Onboarding can create it.
    if (user) {
      try {
        const r = await fetch(`${API_URL}/api/profile/init`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            user_id: user.id,
            email: user.email || emailClean
          })
        });

        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          console.warn("Profile init skipped:", j?.error || `HTTP ${r.status}`);
        }
      } catch (err) {
        console.warn("Profile init skipped:", err);
      }
    }

    // Supabase can sometimes return no session right after signUp (depending on auth settings).
    // Even with email confirmation disabled, there can be a short delay before sign-in works.
    let session = data?.session || null;

    if (!session) {
      // Try a few times before falling back to manual login.
      for (let i = 0; i < 6; i++) {
        const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
          email: emailClean,
          password
        });

        if (!signInErr && signInData?.session) {
          session = signInData.session;
          break;
        }

        // small backoff
        await sleep(350);
      }
    }

    if (session) {
      setLoading(false);
      setSuccessMsg("Account created. Redirecting...");

      // Route into the app shell. AppLayout decides whether the user should see onboarding or dashboard.
      navigate("/app", { replace: true });
      return;
    }

    // If we still couldn't establish a session, send them to login.
    setLoading(false);
    setSuccessMsg("Account created. Please log in.");
    navigate("/login", { replace: true });
    return;
  };

  return (
    <div
      style={{
        height: "100vh",
        width: "100vw",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0f0f0f",
        overflow: "hidden"
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          padding: "2.5rem",
          background: "#151515",
          border: "1px solid #222",
          borderRadius: "10px",
          boxSizing: "border-box"
        }}
      >
        <h1 style={{ marginBottom: "1.5rem", textAlign: "center" }}>Sign Up</h1>

        <form onSubmit={handleRegister}>
          <label style={{ display: "block", marginBottom: "0.4rem" }}>Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: "100%",
              padding: "0.6rem",
              marginBottom: "1.2rem",
              background: "#0f0f0f",
              border: "1px solid #333",
              color: "#fff"
            }}
          />

          <label style={{ display: "block", marginBottom: "0.4rem" }}>Password</label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: "100%",
              padding: "0.6rem",
              marginBottom: "1.5rem",
              background: "#0f0f0f",
              border: "1px solid #333",
              color: "#fff"
            }}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "0.7rem",
              background: "#2a2a2a",
              border: "1px solid #333",
              color: "#fff",
              cursor: loading ? "default" : "pointer"
            }}
          >
            {loading ? "Creating account..." : "Register"}
          </button>

          <button
            type="button"
            onClick={() => navigate("/login")}
            style={{
              width: "100%",
              marginTop: "0.75rem",
              padding: "0.7rem",
              background: "transparent",
              border: "1px solid #333",
              color: "#fff",
              cursor: "pointer"
            }}
          >
            Already registered? Log in
          </button>
        </form>

        {errorMsg && <p style={{ color: "#ff6b6b", marginTop: "1rem" }}>{errorMsg}</p>}
        {successMsg && <p style={{ color: "#6bff95", marginTop: "1rem" }}>{successMsg}</p>}
      </div>
    </div>
  );
}

export default Register;