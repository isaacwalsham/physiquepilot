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
    border-top: 1px solid rgba(165,21,21,0.35);
    border-left: 1px solid rgba(165,21,21,0.35);
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
    border-bottom: 1px solid rgba(165,21,21,0.35);
    border-right: 1px solid rgba(165,21,21,0.35);
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
      0 0 0 1px rgba(165,21,21,0.08),
      0 24px 60px rgba(0,0,0,0.6);
    overflow: hidden;
  }

  /* ── Card topbar ── */
  .register-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.7rem 1.2rem;
    background: rgba(165,21,21,0.04);
    border-bottom: 1px solid rgba(165,21,21,0.15);
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
    box-shadow: 0 0 0 3px rgba(204,32,32,0.16);
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
    box-shadow: 0 0 16px rgba(165,21,21,0.3);
    transition: box-shadow 0.18s, opacity 0.18s;
    margin-top: 0.4rem;
  }

  .register-btn-primary:hover:not(:disabled) {
    box-shadow: 0 0 28px rgba(165,21,21,0.55);
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
    background: rgba(204,32,32,0.06);
    border: 1px solid rgba(204,32,32,0.22);
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

  /* ── Email confirm overlay ── */
  .email-confirm-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.78);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 300;
    padding: 1rem;
    animation: ecFadeIn 0.22s ease;
  }

  @keyframes ecFadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  .email-confirm-modal {
    width: 100%;
    max-width: 420px;
    background: rgba(8,3,5,0.97);
    border: 1px solid var(--accent-2);
    border-radius: var(--radius-lg);
    box-shadow:
      0 0 0 1px rgba(165,21,21,0.1),
      0 0 80px rgba(165,21,21,0.2),
      0 32px 80px rgba(0,0,0,0.75);
    padding: 2.25rem 2rem;
    text-align: center;
    animation: ecSlideUp 0.25s ease;
  }

  @keyframes ecSlideUp {
    from { transform: translateY(20px); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }

  .email-confirm-icon {
    font-size: 3rem;
    display: block;
    margin-bottom: 1.1rem;
    filter: drop-shadow(0 0 12px rgba(165,21,21,0.5));
  }

  .email-confirm-title {
    font-family: var(--font-display);
    font-size: 1.55rem;
    font-weight: 700;
    color: var(--text-1);
    margin: 0 0 0.75rem;
    letter-spacing: -0.02em;
    line-height: 1.2;
  }

  .email-confirm-body {
    font-family: var(--font-body);
    font-size: 0.9rem;
    color: var(--text-2);
    line-height: 1.65;
    margin: 0 0 1.6rem;
  }

  .email-confirm-email {
    color: var(--accent-3);
    font-weight: 600;
    word-break: break-all;
  }

  .email-confirm-divider {
    width: 2.5rem;
    height: 1px;
    background: var(--accent-2);
    margin: 0 auto 1.5rem;
    opacity: 0.4;
  }

  .email-confirm-btn {
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
    box-shadow: 0 0 20px rgba(165,21,21,0.3);
    transition: box-shadow 0.18s, opacity 0.18s;
  }

  .email-confirm-btn:hover {
    box-shadow: 0 0 36px rgba(165,21,21,0.55);
  }

  .email-confirm-note {
    font-family: var(--font-body);
    font-size: 0.73rem;
    color: var(--text-3);
    margin-top: 1rem;
    line-height: 1.5;
  }

  /* ── Password strength ── */
  .pw-strength-bar-wrap {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
    margin-top: 0.55rem;
  }

  .pw-strength-segment {
    height: 3px;
    border-radius: 999px;
    background: var(--line-1);
    transition: background 0.25s ease;
  }

  .pw-strength-label {
    font-family: var(--font-display);
    font-size: 0.6rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    margin-top: 0.35rem;
    margin-bottom: 0.55rem;
    transition: color 0.2s;
  }

  .pw-criteria {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.22rem 0.5rem;
    margin-top: 0.1rem;
  }

  .pw-criterion {
    display: flex;
    align-items: center;
    gap: 0.38rem;
    font-size: 0.78rem;
    line-height: 1.4;
    transition: color 0.2s;
  }

  .pw-criterion-icon {
    font-size: 0.65rem;
    flex-shrink: 0;
    width: 14px;
    text-align: center;
    transition: color 0.2s;
  }

  /* ── Footer ── */
  .register-footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    margin-top: 1.4rem;
    padding-top: 1.1rem;
    border-top: 1px solid rgba(165,21,21,0.1);
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
  const [showEmailConfirm, setShowEmailConfirm] = useState(false);

  // ── Password strength ──────────────────────────────────────────────────────
  const pwCriteria = [
    { key: "len",   label: "8+ characters",      test: (p) => p.length >= 8 },
    { key: "lower", label: "Lowercase (a–z)",     test: (p) => /[a-z]/.test(p) },
    { key: "upper", label: "Uppercase (A–Z)",     test: (p) => /[A-Z]/.test(p) },
    { key: "num",   label: "Number (0–9)",        test: (p) => /[0-9]/.test(p) },
    { key: "sym",   label: "Symbol (!@#…)",       test: (p) => /[^a-zA-Z0-9]/.test(p) },
  ];

  const pwPassed  = pwCriteria.filter((c) => c.test(password)).length;
  const pwStrong  = pwPassed === pwCriteria.length;
  const pwScore   = password.length === 0 ? 0 : Math.min(4, Math.ceil((pwPassed / pwCriteria.length) * 4));

  const strengthMeta = [
    { label: "",       color: "var(--line-1)"  },
    { label: "Weak",   color: "var(--bad)"     },
    { label: "Fair",   color: "var(--warn)"    },
    { label: "Good",   color: "#4a9eff"        },
    { label: "Strong", color: "var(--ok)"      },
  ][pwScore];

  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);

    const emailClean = String(email || "").trim().toLowerCase();

    const { data, error } = await supabase.auth.signUp({
      email: emailClean,
      password,
      options: { emailRedirectTo: `${window.location.origin}/verified` }
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

    // If Supabase returned a session immediately (email confirmation disabled),
    // navigate straight into the app.
    if (data?.session) {
      setLoading(false);
      setSuccessMsg("Account created. Redirecting…");
      navigate("/app", { replace: true });
      return;
    }

    // No session means Supabase requires email confirmation before sign-in.
    // Show the confirmation modal instead of trying to sign in.
    setLoading(false);
    setShowEmailConfirm(true);
  };

  return (
    <div className="public-page register-page">
      <style>{CSS}</style>

      {/* ── Email confirmation modal ── */}
      {showEmailConfirm && (
        <div className="email-confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="ec-title">
          <div className="email-confirm-modal">
            <span className="email-confirm-icon" aria-hidden="true">✉</span>
            <h2 className="email-confirm-title" id="ec-title">Check your inbox</h2>
            <div className="email-confirm-divider" aria-hidden="true" />
            <p className="email-confirm-body">
              We sent a confirmation link to<br />
              <span className="email-confirm-email">{email}</span>.<br /><br />
              Click that link to activate your account,
              then come back here to sign in.
            </p>
            <button
              className="email-confirm-btn"
              onClick={() => navigate("/login")}
            >
              Go to Login →
            </button>
            <p className="email-confirm-note">
              Can't find it? Check your spam folder.
            </p>
          </div>
        </div>
      )}

      {/* Corner reticle bottom-right */}
      <div className="register-corner-br" aria-hidden="true" />

      <div className="register-card">
        {/* Topbar */}
        <div className="register-topbar">
          <div className="register-topbar-left">
            <span className="register-blink-dot" aria-hidden="true" />
            <span className="register-section-code">CREATE ACCOUNT</span>
          </div>
          <span className="register-channel-status">SECURE CHANNEL</span>
        </div>

        {/* Body */}
        <div className="register-body">
          <h1 className="register-heading">Create your account.</h1>
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
                placeholder="email@example.com"
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
                minLength={8}
                autoComplete="new-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              {/* Strength bar */}
              {password.length > 0 && (
                <>
                  <div className="pw-strength-bar-wrap" aria-hidden="true">
                    {[1, 2, 3, 4].map((seg) => (
                      <div
                        key={seg}
                        className="pw-strength-segment"
                        style={{ background: pwScore >= seg ? strengthMeta.color : undefined }}
                      />
                    ))}
                  </div>
                  <div className="pw-strength-label" style={{ color: strengthMeta.color }}>
                    {strengthMeta.label}
                  </div>
                  <div className="pw-criteria" role="list" aria-label="Password requirements">
                    {pwCriteria.map((c) => {
                      const ok = c.test(password);
                      return (
                        <div
                          key={c.key}
                          className="pw-criterion"
                          role="listitem"
                          style={{ color: ok ? "var(--text-2)" : "var(--text-3)" }}
                        >
                          <span className="pw-criterion-icon" style={{ color: ok ? "var(--ok)" : "var(--line-2)" }}>
                            {ok ? "✓" : "○"}
                          </span>
                          {c.label}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <button
              type="submit"
              className="register-btn-primary"
              disabled={loading || !pwStrong}
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
