import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";

// ─── Styles ───────────────────────────────────────────────────────────────────

const CSS = `
  @keyframes ldBlink {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.15; }
  }

  @keyframes loginScanline {
    0%   { transform: translateY(-100%); }
    100% { transform: translateY(100vh); }
  }

  /* ── Page wrapper ── */
  .login-page {
    width: 100%;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-body);
    color: var(--text-1);
    overflow: hidden;
    position: relative;
  }

  /* ── Moving scan-line ── */
  .login-page::before {
    content: "";
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    background: repeating-linear-gradient(
      0deg,
      rgba(0,0,0,0)    0px,
      rgba(0,0,0,0)    3px,
      rgba(0,0,0,0.06) 4px
    );
  }

  /* ── Corner reticle marks ── */
  .login-page::after {
    content: "";
    position: fixed;
    top: 1.2rem;
    left: 1.2rem;
    width: 28px;
    height: 28px;
    border-top: 1px solid rgba(165,21,21,0.35);
    border-left: 1px solid rgba(165,21,21,0.35);
    pointer-events: none;
    z-index: 0;
  }

  /* ── Form card ── */
  .login-card {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 440px;
    margin: 0 1rem;
    background: rgba(8,3,5,0.92);
    border: 1px solid var(--line-1);
    border-radius: var(--radius-lg);
    box-shadow:
      0 0 0 1px rgba(165,21,21,0.08),
      0 24px 60px rgba(0,0,0,0.6);
    overflow: hidden;
  }

  /* ── Card topbar ── */
  .login-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.7rem 1.2rem;
    background: rgba(165,21,21,0.04);
    border-bottom: 1px solid rgba(165,21,21,0.15);
  }

  .login-topbar-left {
    display: flex;
    align-items: center;
    gap: 0.55rem;
  }

  .login-blink-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--ok);
    flex-shrink: 0;
    animation: ldBlink 1.8s ease-in-out infinite;
  }

  .login-section-code {
    font-family: var(--font-display);
    font-size: 0.62rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--text-3);
  }

  .login-system-status {
    font-family: var(--font-display);
    font-size: 0.6rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--ok);
  }

  /* ── Card body ── */
  .login-body {
    padding: 2rem 2rem 1.75rem;
  }

  /* ── Heading ── */
  .login-heading {
    font-family: var(--font-display);
    font-size: 1.8rem;
    font-weight: 700;
    margin: 0 0 0.45rem;
    color: var(--text-1);
    line-height: 1.15;
  }

  .login-subtitle {
    font-size: 0.9rem;
    color: var(--text-2);
    margin: 0 0 1.6rem;
    line-height: 1.55;
  }

  /* ── Field group ── */
  .login-field {
    margin-bottom: 1.1rem;
  }

  .login-label {
    display: block;
    font-family: var(--font-display);
    font-size: 0.65rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-3);
    margin-bottom: 0.35rem;
  }

  .login-input {
    width: 100%;
    padding: 0.72rem 0.9rem;
    background: rgba(10,5,8,0.9);
    border: 1px solid var(--line-1);
    border-radius: var(--radius-sm);
    color: var(--text-1);
    font-family: var(--font-body);
    font-size: 0.95rem;
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.18s, box-shadow 0.18s;
  }

  .login-input::placeholder {
    color: var(--text-3);
    opacity: 0.6;
  }

  .login-input:focus {
    border-color: var(--accent-3);
    box-shadow: 0 0 0 3px rgba(204,32,32,0.16);
  }

  /* ── Primary button ── */
  .login-btn-primary {
    width: 100%;
    padding: 0.8rem 1.5rem;
    background: linear-gradient(135deg, var(--accent-2), var(--accent-1));
    border: 1px solid var(--accent-2);
    border-radius: var(--radius-sm);
    color: #fff;
    font-family: var(--font-display);
    font-size: 0.85rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;
    box-shadow: 0 0 16px rgba(165,21,21,0.3);
    transition: box-shadow 0.18s, opacity 0.18s;
    margin-top: 0.4rem;
  }

  .login-btn-primary:hover:not(:disabled) {
    box-shadow: 0 0 28px rgba(165,21,21,0.55);
  }

  .login-btn-primary:disabled {
    opacity: 0.52;
    cursor: default;
  }

  /* ── Error banner ── */
  .login-error {
    display: flex;
    align-items: flex-start;
    gap: 0.45rem;
    margin-top: 1rem;
    padding: 0.65rem 0.85rem;
    background: rgba(204,32,32,0.06);
    border: 1px solid rgba(204,32,32,0.22);
    border-radius: var(--radius-sm);
    color: var(--bad);
    font-size: 0.82rem;
    line-height: 1.45;
  }

  .login-error-icon {
    flex-shrink: 0;
    margin-top: 0.05rem;
  }

  /* ── Footer links ── */
  .login-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-top: 1.4rem;
    padding-top: 1.1rem;
    border-top: 1px solid rgba(165,21,21,0.1);
  }

  .login-link {
    background: transparent;
    border: none;
    padding: 0;
    cursor: pointer;
    font-family: var(--font-display);
    font-size: 0.8rem;
    letter-spacing: 0.06em;
    color: var(--accent-3);
    text-transform: uppercase;
    transition: opacity 0.15s;
  }

  .login-link:hover {
    opacity: 0.75;
  }

  /* ── Corner reticle bottom-right ── */
  .login-corner-br {
    position: fixed;
    bottom: 1.2rem;
    right: 1.2rem;
    width: 28px;
    height: 28px;
    border-bottom: 1px solid rgba(165,21,21,0.35);
    border-right: 1px solid rgba(165,21,21,0.35);
    pointer-events: none;
    z-index: 0;
  }
`;

// ─── Component ────────────────────────────────────────────────────────────────

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const aliveRef = useRef(true);

  const redirectingRef = useRef(false);

  useEffect(() => {
    aliveRef.current = true;

    const run = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data?.session;
      if (!session) return;

      if (redirectingRef.current) return;
      redirectingRef.current = true;

      if (aliveRef.current) navigate("/app", { replace: true });
    };

    run();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) return;

      if (redirectingRef.current) return;
      redirectingRef.current = true;

      if (aliveRef.current) navigate("/app", { replace: true });
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

    if (redirectingRef.current) return;
    redirectingRef.current = true;

    navigate("/app", { replace: true });
  };

  return (
    <div className="public-page login-page">
      <style>{CSS}</style>

      {/* Corner reticle marks */}
      <div className="login-corner-br" aria-hidden="true" />

      <div className="login-card">
        {/* Topbar */}
        <div className="login-topbar">
          <div className="login-topbar-left">
            <span className="login-blink-dot" aria-hidden="true" />
            <span className="login-section-code">SIGN IN</span>
          </div>
          <span className="login-system-status">SYSTEM ACTIVE</span>
        </div>

        {/* Body */}
        <div className="login-body">
          <h1 className="login-heading">Welcome back.</h1>
          <p className="login-subtitle">
            Log in to access your dashboard, training log, nutrition targets, and trends.
          </p>

          <form onSubmit={handleLogin}>
            <div className="login-field">
              <label className="login-label" htmlFor="login-email">Email</label>
              <input
                id="login-email"
                className="login-input"
                type="email"
                required
                autoComplete="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="login-field">
              <label className="login-label" htmlFor="login-password">Password</label>
              <input
                id="login-password"
                className="login-input"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="login-btn-primary"
              disabled={loading}
            >
              {loading ? "Authenticating..." : "Initiate Login"}
            </button>
          </form>

          {errorMsg && (
            <div className="login-error" role="alert">
              <span className="login-error-icon">⚠</span>
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="login-footer">
            <button
              type="button"
              className="login-link"
              onClick={() => navigate("/")}
            >
              ← Back to home
            </button>

            <button
              type="button"
              className="login-link"
              onClick={() => navigate("/register")}
            >
              Create account →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
