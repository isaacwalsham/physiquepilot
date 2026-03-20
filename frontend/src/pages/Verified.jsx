import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

// ─── Styles ───────────────────────────────────────────────────────────────────

const CSS = `
  @keyframes vfBlink {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.15; }
  }
  @keyframes vfPulse {
    0%, 100% { box-shadow: 0 0 24px rgba(40,183,141,0.25); }
    50%       { box-shadow: 0 0 48px rgba(40,183,141,0.5); }
  }
  @keyframes vfFadeIn {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .vf-page {
    min-height: 100vh;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-body);
    color: var(--text-1);
    position: relative;
    overflow: hidden;
    background:
      radial-gradient(900px 400px at 20% -10%, rgba(40,183,141,0.08), transparent 70%),
      radial-gradient(900px 400px at 80% 110%, rgba(165,21,21,0.1), transparent 70%),
      linear-gradient(180deg, var(--bg-1), var(--bg-0));
  }

  /* corner reticles */
  .vf-page::before {
    content: "";
    position: fixed;
    top: 1.2rem; left: 1.2rem;
    width: 28px; height: 28px;
    border-top: 1px solid rgba(40,183,141,0.3);
    border-left: 1px solid rgba(40,183,141,0.3);
    pointer-events: none;
  }
  .vf-corner-br {
    position: fixed;
    bottom: 1.2rem; right: 1.2rem;
    width: 28px; height: 28px;
    border-bottom: 1px solid rgba(40,183,141,0.3);
    border-right: 1px solid rgba(40,183,141,0.3);
    pointer-events: none;
  }

  .vf-card {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 440px;
    margin: 0 1rem;
    background: rgba(8,3,5,0.94);
    border: 1px solid rgba(40,183,141,0.2);
    border-radius: var(--radius-lg);
    box-shadow: 0 0 0 1px rgba(40,183,141,0.06), 0 24px 60px rgba(0,0,0,0.6);
    overflow: hidden;
    animation: vfFadeIn 0.3s ease;
  }

  .vf-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.7rem 1.2rem;
    background: rgba(40,183,141,0.04);
    border-bottom: 1px solid rgba(40,183,141,0.12);
  }

  .vf-topbar-left {
    display: flex;
    align-items: center;
    gap: 0.55rem;
  }

  .vf-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--ok);
    animation: vfBlink 1.8s ease-in-out infinite;
  }

  .vf-code {
    font-family: var(--font-display);
    font-size: 0.62rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--text-3);
  }

  .vf-status {
    font-family: var(--font-display);
    font-size: 0.6rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--ok);
  }

  .vf-body {
    padding: 2.5rem 2rem 2rem;
    text-align: center;
  }

  .vf-icon-wrap {
    width: 72px; height: 72px;
    border-radius: 50%;
    border: 1.5px solid rgba(40,183,141,0.3);
    background: rgba(40,183,141,0.07);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 1.5rem;
    font-size: 2rem;
    animation: vfPulse 2.4s ease-in-out infinite;
  }

  .vf-title {
    font-family: var(--font-display);
    font-size: 1.7rem;
    font-weight: 700;
    color: var(--text-1);
    margin: 0 0 0.6rem;
    line-height: 1.2;
    letter-spacing: -0.02em;
  }

  .vf-sub {
    font-size: 0.9rem;
    color: var(--text-2);
    line-height: 1.6;
    margin: 0 0 2rem;
  }

  .vf-divider {
    width: 2rem; height: 1px;
    background: rgba(40,183,141,0.35);
    margin: 0 auto 1.6rem;
  }

  .vf-btn-primary {
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
    transition: box-shadow 0.18s;
    margin-bottom: 0.75rem;
  }
  .vf-btn-primary:hover { box-shadow: 0 0 28px rgba(165,21,21,0.5); }

  .vf-btn-ghost {
    width: 100%;
    padding: 0.72rem 1.5rem;
    background: transparent;
    border: 1px solid var(--line-1);
    border-radius: var(--radius-sm);
    color: var(--text-3);
    font-family: var(--font-display);
    font-size: 0.78rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
  }
  .vf-btn-ghost:hover { border-color: var(--line-2); color: var(--text-2); }

  .vf-loading {
    color: var(--text-3);
    font-family: var(--font-display);
    font-size: 0.75rem;
    letter-spacing: 0.15em;
    padding: 3rem;
    text-align: center;
  }

  .vf-error {
    color: var(--bad);
    font-size: 0.82rem;
    background: rgba(204,32,32,0.06);
    border: 1px solid rgba(204,32,32,0.2);
    border-radius: var(--radius-sm);
    padding: 0.65rem 0.85rem;
    margin-bottom: 1rem;
    text-align: left;
  }
`;

// ─── Component ────────────────────────────────────────────────────────────────

export default function Verified() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("checking"); // "checking" | "verified" | "error"
  const [hasSession, setHasSession] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    // Supabase JS automatically processes the #access_token hash in the URL
    // and fires onAuthStateChange. We just listen for the result.
    let timer;

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        setHasSession(!!session);
        setStatus("verified");
      }
    });

    // Also check current session (handles page refresh after the hash is consumed)
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) {
        setHasSession(true);
        setStatus("verified");
      } else {
        // Give Supabase JS a moment to process the URL hash
        timer = setTimeout(() => {
          setStatus((prev) => (prev === "checking" ? "error" : prev));
          setErrMsg("We couldn't verify your email. The link may have expired — try signing up again.");
        }, 4000);
      }
    });

    return () => {
      sub?.subscription?.unsubscribe?.();
      clearTimeout(timer);
    };
  }, []);

  const goToOnboarding = () => navigate("/app/onboarding", { replace: true });
  const goToLogin = () => navigate("/login", { replace: true });
  const goHome = () => navigate("/", { replace: true });

  return (
    <div className="public-page vf-page">
      <style>{CSS}</style>
      <div className="vf-corner-br" aria-hidden="true" />

      <div className="vf-card">
        <div className="vf-topbar">
          <div className="vf-topbar-left">
            <span className="vf-dot" aria-hidden="true" />
            <span className="vf-code">EMAIL VERIFICATION</span>
          </div>
          <span className="vf-status">
            {status === "checking" ? "PROCESSING…" : status === "verified" ? "CONFIRMED" : "ERROR"}
          </span>
        </div>

        <div className="vf-body">
          {status === "checking" && (
            <p className="vf-loading">Verifying your email…</p>
          )}

          {status === "verified" && (
            <>
              <div className="vf-icon-wrap" aria-hidden="true">✓</div>
              <h1 className="vf-title">Email verified.</h1>
              <div className="vf-divider" aria-hidden="true" />
              <p className="vf-sub">
                Thanks for confirming your address. Your account is active —
                let's get your profile set up so the AI can calibrate your plan.
              </p>
              {hasSession ? (
                <button className="vf-btn-primary" onClick={goToOnboarding}>
                  Start Setup →
                </button>
              ) : (
                <button className="vf-btn-primary" onClick={goToLogin}>
                  Sign In to Continue →
                </button>
              )}
              <button className="vf-btn-ghost" onClick={goHome}>
                Back to Home
              </button>
            </>
          )}

          {status === "error" && (
            <>
              <div className="vf-icon-wrap" style={{ borderColor: "rgba(204,32,32,0.3)", background: "rgba(204,32,32,0.07)", animation: "none" }} aria-hidden="true">✕</div>
              <h1 className="vf-title" style={{ color: "var(--bad)" }}>Link expired.</h1>
              <div className="vf-divider" style={{ background: "rgba(204,32,32,0.3)" }} aria-hidden="true" />
              {errMsg && <div className="vf-error">{errMsg}</div>}
              <button className="vf-btn-primary" onClick={() => navigate("/register")}>
                Try Again →
              </button>
              <button className="vf-btn-ghost" onClick={goHome}>
                Back to Home
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
