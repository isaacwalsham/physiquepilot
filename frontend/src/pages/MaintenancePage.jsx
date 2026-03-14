import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

// ─── Config ───────────────────────────────────────────────────────────────────

// June 1st 2026 00:00 BST = May 31st 2026 23:00 UTC
const LAUNCH_DATE = new Date("2026-05-31T23:00:00Z");
const TOTAL_SPOTS = 500;
const INSTAGRAM_URL = "https://www.instagram.com/physiquepilotuk";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTimeLeft() {
  const diff = LAUNCH_DATE - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, mins: 0, secs: 0 };
  const secs = Math.floor(diff / 1000);
  return {
    days: Math.floor(secs / 86400),
    hours: Math.floor((secs % 86400) / 3600),
    mins: Math.floor((secs % 3600) / 60),
    secs: secs % 60,
  };
}

function pad(n) {
  return String(n).padStart(2, "0");
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MaintenancePage() {
  const [timeLeft, setTimeLeft] = useState(getTimeLeft);
  const [spotsClaimed, setSpotsClaimed] = useState(null);
  const [email, setEmail] = useState("");
  const [submitState, setSubmitState] = useState("idle"); // idle | loading | success | duplicate | error

  // Countdown tick
  useEffect(() => {
    const id = setInterval(() => setTimeLeft(getTimeLeft()), 1000);
    return () => clearInterval(id);
  }, []);

  // Fetch spot count
  useEffect(() => {
    supabase
      .from("waitlist")
      .select("id", { count: "exact", head: true })
      .then(({ count }) => {
        if (count != null) setSpotsClaimed(count);
      });
  }, [submitState]); // re-fetch after a successful signup

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;

    setSubmitState("loading");

    const { error } = await supabase
      .from("waitlist")
      .insert({ email: trimmed });

    if (!error) {
      setSubmitState("success");
      return;
    }

    // Postgres unique violation code
    if (error.code === "23505") {
      setSubmitState("duplicate");
      return;
    }

    setSubmitState("error");
  };

  const spotsLeft = spotsClaimed != null ? Math.max(0, TOTAL_SPOTS - spotsClaimed) : null;

  return (
    <div style={s.page}>
      {/* ── Wordmark ─────────────────────────────── */}
      <div style={s.wordmark}>PHYSIQUE PILOT</div>

      {/* ── Headline ─────────────────────────────── */}
      <h1 style={s.headline}>Something big<br />is coming.</h1>

      {/* ── Offer pill ───────────────────────────── */}
      <div style={s.offerPill}>
        <span style={s.offerIcon}>⚡</span>
        First 500 members get <strong style={s.offerStrong}>90 days free</strong>
      </div>

      {/* ── Spot counter ─────────────────────────── */}
      {spotsLeft != null && (
        <div style={s.spotRow}>
          <div style={s.spotBar}>
            <div
              style={{
                ...s.spotFill,
                width: `${(spotsClaimed / TOTAL_SPOTS) * 100}%`,
              }}
            />
          </div>
          <p style={s.spotText}>
            <span style={s.spotNum}>{spotsLeft}</span> of {TOTAL_SPOTS} free spots remaining
          </p>
        </div>
      )}

      {/* ── Countdown ────────────────────────────── */}
      <div style={s.countdown}>
        {[
          { label: "DAYS", value: timeLeft.days },
          { label: "HRS", value: timeLeft.hours },
          { label: "MIN", value: timeLeft.mins },
          { label: "SEC", value: timeLeft.secs },
        ].map(({ label, value }, i) => (
          <div key={label} style={s.countdownGroup}>
            {i > 0 && <span style={s.colon}>:</span>}
            <div style={s.countdownBlock}>
              <span style={s.countdownNum}>{pad(value)}</span>
              <span style={s.countdownLabel}>{label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Email form ───────────────────────────── */}
      <div style={s.formWrap}>
        {submitState === "success" ? (
          <div style={s.successMsg}>
            <span style={s.successIcon}>✓</span>
            You&apos;re on the list! We&apos;ll be in touch before launch.
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={s.form}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              disabled={submitState === "loading"}
              style={s.input}
            />
            <button
              type="submit"
              disabled={submitState === "loading"}
              style={submitState === "loading" ? { ...s.btn, opacity: 0.6, cursor: "not-allowed" } : s.btn}
            >
              {submitState === "loading" ? "Saving…" : "Claim My Spot"}
            </button>
          </form>
        )}

        {submitState === "duplicate" && (
          <p style={s.hintMsg}>You&apos;re already on the list — we&apos;ve got you.</p>
        )}
        {submitState === "error" && (
          <p style={{ ...s.hintMsg, color: "var(--bad)" }}>Something went wrong — please try again.</p>
        )}
      </div>

      {/* ── Instagram ────────────────────────────── */}
      <a
        href={INSTAGRAM_URL}
        target="_blank"
        rel="noopener noreferrer"
        style={s.igLink}
      >
        <svg style={s.igIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
        </svg>
        @physiquepilotuk
      </a>

      {/* ── Launch date label ─────────────────────── */}
      <p style={s.launchLabel}>Launching 1st June 2026</p>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = {
  page: {
    minHeight: "100vh",
    width: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "3rem 1.5rem",
    background:
      "radial-gradient(1200px 520px at 8% -20%, rgba(181,21,60,0.16), transparent 70%), " +
      "radial-gradient(1100px 460px at 95% -15%, rgba(138,15,46,0.22), transparent 68%), " +
      "linear-gradient(180deg, var(--bg-1), var(--bg-0))",
    textAlign: "center",
    boxSizing: "border-box",
  },

  wordmark: {
    fontFamily: "var(--font-display)",
    fontSize: "0.7rem",
    letterSpacing: "0.28em",
    color: "var(--accent-2)",
    marginBottom: "2.5rem",
    textTransform: "uppercase",
  },

  headline: {
    fontFamily: "var(--font-display)",
    fontSize: "clamp(2.4rem, 6vw, 4rem)",
    fontWeight: 700,
    color: "var(--text-1)",
    lineHeight: 1.12,
    letterSpacing: "-0.02em",
    margin: "0 0 1.8rem",
  },

  offerPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.4rem",
    fontFamily: "var(--font-body)",
    fontSize: "0.9rem",
    color: "var(--text-2)",
    background: "rgba(181,21,60,0.12)",
    border: "1px solid rgba(181,21,60,0.3)",
    borderRadius: "100px",
    padding: "0.55rem 1.1rem",
    marginBottom: "2rem",
  },

  offerIcon: {
    fontSize: "0.85rem",
  },

  offerStrong: {
    color: "var(--accent-3)",
    fontWeight: 600,
  },

  spotRow: {
    width: "100%",
    maxWidth: "400px",
    marginBottom: "2.2rem",
  },

  spotBar: {
    width: "100%",
    height: "4px",
    background: "var(--line-1)",
    borderRadius: "4px",
    overflow: "hidden",
    marginBottom: "0.6rem",
  },

  spotFill: {
    height: "100%",
    background: "linear-gradient(90deg, var(--accent-1), var(--accent-3))",
    borderRadius: "4px",
    transition: "width 0.6s ease",
  },

  spotText: {
    fontFamily: "var(--font-body)",
    fontSize: "0.8rem",
    color: "var(--text-3)",
    margin: 0,
  },

  spotNum: {
    color: "var(--text-1)",
    fontWeight: 600,
  },

  countdown: {
    display: "flex",
    alignItems: "center",
    gap: "0",
    marginBottom: "2.5rem",
  },

  countdownGroup: {
    display: "flex",
    alignItems: "center",
  },

  colon: {
    fontFamily: "var(--font-display)",
    fontSize: "clamp(1.8rem, 4vw, 2.8rem)",
    color: "var(--line-2)",
    margin: "0 0.3rem",
    lineHeight: 1,
    paddingBottom: "1.2rem",
  },

  countdownBlock: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    minWidth: "72px",
  },

  countdownNum: {
    fontFamily: "var(--font-display)",
    fontSize: "clamp(2rem, 5vw, 3.2rem)",
    fontWeight: 700,
    color: "var(--text-1)",
    lineHeight: 1,
    letterSpacing: "0.02em",
  },

  countdownLabel: {
    fontFamily: "var(--font-display)",
    fontSize: "0.6rem",
    letterSpacing: "0.18em",
    color: "var(--text-3)",
    marginTop: "0.35rem",
  },

  formWrap: {
    width: "100%",
    maxWidth: "420px",
    marginBottom: "2rem",
  },

  form: {
    display: "flex",
    gap: "0.6rem",
    flexWrap: "wrap",
    justifyContent: "center",
  },

  input: {
    flex: "1 1 200px",
    padding: "0.8rem 1rem",
    background: "var(--surface-2)",
    border: "1px solid var(--line-2)",
    borderRadius: "var(--radius-md)",
    color: "var(--text-1)",
    fontFamily: "var(--font-body)",
    fontSize: "0.95rem",
    outline: "none",
    minWidth: 0,
  },

  btn: {
    flex: "0 0 auto",
    padding: "0.8rem 1.4rem",
    background: "var(--accent-2)",
    color: "#fff",
    border: "none",
    borderRadius: "var(--radius-md)",
    fontFamily: "var(--font-display)",
    fontSize: "0.9rem",
    fontWeight: 600,
    letterSpacing: "0.04em",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  successMsg: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.6rem",
    fontFamily: "var(--font-body)",
    fontSize: "0.95rem",
    color: "var(--ok)",
    background: "rgba(40,183,141,0.08)",
    border: "1px solid rgba(40,183,141,0.25)",
    borderRadius: "var(--radius-md)",
    padding: "0.9rem 1.2rem",
  },

  successIcon: {
    fontWeight: 700,
    fontSize: "1rem",
  },

  hintMsg: {
    fontFamily: "var(--font-body)",
    fontSize: "0.82rem",
    color: "var(--text-3)",
    marginTop: "0.7rem",
  },

  igLink: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.45rem",
    fontFamily: "var(--font-body)",
    fontSize: "0.875rem",
    color: "var(--text-3)",
    textDecoration: "none",
    marginBottom: "1.5rem",
    transition: "color 160ms ease",
  },

  igIcon: {
    width: "18px",
    height: "18px",
    flexShrink: 0,
  },

  launchLabel: {
    fontFamily: "var(--font-display)",
    fontSize: "0.7rem",
    letterSpacing: "0.16em",
    color: "var(--text-3)",
    textTransform: "uppercase",
    margin: 0,
  },
};
