import { useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";

// ─── Styles ───────────────────────────────────────────────────────────────────

const CSS = `
  @keyframes ldBlink {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.15; }
  }

  @keyframes registerScanline {
    0%   { transform: translateY(-100%); }
    100% { transform: translateY(100vh); }
  }

  /* ── Page wrapper ── */
  .register-page {
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

  /* ── Scanline overlay ── */
  .register-page::before {
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

  /* ── Corner reticle top-left ── */
  .register-page::after {
    content: "";
    position: fixed;
    top: 1.2rem;
    left: 1.2rem;
    width: 28px;
    height: 28px;
    border-top: 1px solid rgba(181,21,60,0.35);
    border-left: 1px solid rgba(181,21,60,0.35);
    pointer-events: none;
    z-index: 0;
  }

  /* ── Corner reticle bottom-right ── */
  .register-corner-br {
    position: fixed;
    bottom: 1.2rem;
    right: 1.2rem;
    width: 28px;
    height: 28px;
    border-bottom: 1px solid rgba(181,21,60,0.35);
    border-right: 1px solid rgba(181,21,60,0.35);
    pointer-events: none;
    z-index: 0;
  }

  /* ── Form card ── */
  .register-card {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 440px;
    margin: 0 1rem;
    background: rgba(8,3,5,0.92);
    border: 1px solid var(--line-1);
    border-radius: var(--radius-lg);
    box-shadow:
      0 0 0 1px rgba(181,21,60,0.08),
      0 24px 60px rgba(0,0,0,0.6);
    overflow: hidden;
  }

  /* ── Card topbar ── */
  .register-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.7rem 1.2rem;
    background: rgba(181,21,60,0.04);
    border-bottom: 1px solid rgba(181,21,60,0.15);
  }

  .register-topbar-left {
    display: flex;
    align-items: center;
    gap: 0.55rem;
  }

  .register-blink-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--ok);
    flex-shrink: 0;
    animation: ldBlink 1.8s ease-in-out infinite;
  }

  .register-section-code {
    font-family: var(--font-display);
    font-size: 0.62rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--text-3);
  }

  .register-channel-status {
    font-family: var(--font-display);
    font-size: 0.6rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--ok);
  }

  /* ── Card body ── */
  .register-body {
    padding: 2rem 2rem 1.75rem;
  }

  /* ── Heading ── */
  .register-heading {
    font-family: var(--font-display);
    font-size: 1.8rem;
    font-weight: 700;
    margin: 0 0 0.45rem;
    color: var(--text-1);
    line-height: 1.15;
  }

  .register-subtitle {
    font-size: 0.9rem;
    color: var(--text-2);
    margin: 0 0 1.6rem;
    line-height: 1.55;
  }

  /* ── Field group ── */
  .register-field {
    margin-bottom: 1.1rem;
  }

  .register-label {
    display: block;
    font-family: var(--font-display);
    font-size: 0.65rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-3);
    margin-bottom: 0.35rem;
  }

  .register-input {
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

  .register-input::placeholder {
    color: var(--text-3);
    opacity: 0.6;
  }

  .register-input:focus {
    border-color: var(--accent-3);
    box-shadow: 0 0 0 3px rgba(222,41,82,0.16);
  }

  /* ── Primary button ── */
  .register-btn-primary {
    width: 100%;
    padding: 0.85rem 1.5rem;
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
    box-shadow: 0 0 16px rgba(181,21,60,0.3);
    transition: box-shadow 0.18s, opacity 0.18s;
    margin-top: 0.4rem;
  }

  .register-btn-primary:hover:not(:disabled) {
    box-shadow: 0 0 28px rgba(181,21,60,0.55);
  }

  .register-btn-primary:disabled {
    opacity: 0.52;
    cursor: default;
  }

  /* ── Error banner ── */
  .register-error {
    display: flex;
    align-items: flex-start;
    gap: 0.45rem;
    margin-top: 1rem;
    padding: 0.65rem 0.85rem;
    background: rgba(222,41,82,0.06);
    border: 1px solid rgba(222,41,82,0.22);
    border-radius: var(--radius-sm);
    color: var(--bad);
    font-size: 0.82rem;
    line-height: 1.45;
  }

  .register-error-icon {
    flex-shrink: 0;
    margin-top: 0.05rem;
  }

  /* ── Success banner ── */
  .register-success {
    display: flex;
    align-items: flex-start;
    gap: 0.45rem;
    margin-top: 1rem;
    padding: 0.65rem 0.85rem;
    background: rgba(40,183,141,0.06);
    border: 1px solid rgba(40,183,141,0.22);
    border-radius: var(--radius-sm);
    color: var(--ok);
    font-size: 0.82rem;
    line-height: 1.45;
  }

  /* ── Footer ── */
  .register-footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    margin-top: 1.4rem;
    padding-top: 1.1rem;
    border-top: 1px solid rgba(181,21,60,0.1);
  }

  .register-link {
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

  .register-link:hover {
    opacity: 0.75;
  }
`;

// ─── Component ────────────────────────────────────────────────────────────────

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
        const r = await apiFetch("/api/profile/init", {
          method: "POST",
          body: JSON.stringify({ email: user.email || emailClean })
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
    <div className="public-page register-page">
      <style>{CSS}</style>

      {/* Corner reticle bottom-right */}
      <div className="register-corner-br" aria-hidden="true" />

      <div className="register-card">
        {/* Topbar */}
        <div className="register-topbar">
          <div className="register-topbar-left">
            <span className="register-blink-dot" aria-hidden="true" />
            <span className="register-section-code">ENLIST // CREATE ACCOUNT</span>
          </div>
          <span className="register-channel-status">SECURE CHANNEL</span>
        </div>

        {/* Body */}
        <div className="register-body">
          <h1 className="register-heading">Begin your mission.</h1>
          <p className="register-subtitle">
            Start your free 30-day trial. No card required.
          </p>

          <form onSubmit={handleRegister}>
            <div className="register-field">
              <label className="register-label" htmlFor="register-email">Email</label>
              <input
                id="register-email"
                className="register-input"
                type="email"
                required
                autoComplete="email"
                placeholder="pilot@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="register-field">
              <label className="register-label" htmlFor="register-password">Password</label>
              <input
                id="register-password"
                className="register-input"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="register-btn-primary"
              disabled={loading}
            >
              {loading ? "Enlisting..." : "Enlist Now"}
            </button>
          </form>

          {errorMsg && (
            <div className="register-error" role="alert">
              <span className="register-error-icon">⚠</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="register-success" role="status">
              <span>{successMsg}</span>
            </div>
          )}

          <div className="register-footer">
            <button
              type="button"
              className="register-link"
              onClick={() => navigate("/login")}
            >
              Already enlisted? Log in →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Register;
