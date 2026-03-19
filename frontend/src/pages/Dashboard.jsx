import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { useProfile } from "../context/ProfileContext";
import PhysiquePilotLoader from "../components/PhysiquePilotLoader";

const API_URL = (() => {
  const raw =
    import.meta?.env?.VITE_API_URL ||
    import.meta?.env?.VITE_API_BASE_URL ||
    (import.meta?.env?.PROD ? "https://physiquepilot.onrender.com" : "http://localhost:4000");
  return String(raw || "").replace(/\/+$/, "");
})();

const round1 = (n) => Math.round(n * 10) / 10;
const kgToLb  = (kg) => kg * 2.2046226218;

const zeroPad = (n) => String(n).padStart(2, "0");
const formatDate = (d) => {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${zeroPad(dt.getMonth() + 1)}-${zeroPad(dt.getDate())}`;
};
const todayLocalISO = () => formatDate(new Date());

const DAY_ABBR  = ["SUN","MON","TUE","WED","THU","FRI","SAT"];
const MON_ABBR  = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
const fmtDisplayDate = () => {
  const d = new Date();
  return `${DAY_ABBR[d.getDay()]} ${zeroPad(d.getDate())} ${MON_ABBR[d.getMonth()]} ${d.getFullYear()}`;
};

const DAY_LABEL = { training: "TRAINING DAY", rest: "REST DAY", high: "HIGH DAY" };

const getDaysUntilCheckIn = (checkInDay) => {
  const map = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
  const target = map[checkInDay] ?? 1;
  const today = new Date().getDay();
  let diff = target - today;
  if (diff <= 0) diff += 7;
  if (diff === 7) diff = 0;
  return diff;
};

// ─── Stylesheet ───────────────────────────────────────────────────────────────
const CSS = `
  @keyframes statusPulse {
    0%, 100% { opacity: 1; box-shadow: 0 0 5px currentColor; }
    50%       { opacity: 0.25; box-shadow: none; }
  }

  /* ── Wrap ── */
  .db-wrap {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 3.2rem);
    gap: 0.6rem;
    box-sizing: border-box;
    overflow: hidden;
    padding-bottom: 0.5rem;
  }

  /* ── Header ── */
  .db-header {
    background: var(--surface-2);
    border: 1px solid var(--line-1);
    border-left: 3px solid var(--accent-3);
    border-radius: var(--radius-md);
    padding: 0.75rem 1.2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
    gap: 1rem;
    flex-wrap: wrap;
    position: relative;
  }
  .db-header-eyebrow {
    font-family: var(--font-display);
    font-size: 0.72rem;
    letter-spacing: 0.2em;
    color: var(--text-3);
    margin-bottom: 0.2rem;
  }
  .db-header-greeting {
    font-family: var(--font-display);
    font-size: 1.25rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .db-header-center {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    pointer-events: none;
  }
  .db-header-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.35rem;
  }

  /* ── Status dot ── */
  .db-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    animation: statusPulse 2s ease-in-out infinite;
    flex-shrink: 0;
  }
  .db-dot-green { color: var(--ok);      background: var(--ok); }
  .db-dot-red   { color: var(--accent-3); background: var(--accent-3); }
  .db-dot-amber { color: var(--warn);    background: var(--warn); }
  .db-dot-dim   { color: var(--text-3);  background: var(--text-3); }

  /* ── Clock ── */
  .db-clock {
    font-family: var(--font-display);
    font-size: 1.75rem;
    letter-spacing: 0.15em;
    color: var(--accent-3);
    font-variant-numeric: tabular-nums;
  }

  /* ── Grid ── */
  .db-grid {
    display: grid;
    grid-template-columns: 1fr 1.5fr 1fr 1fr;
    grid-template-rows: 1fr 1fr;
    gap: 0.6rem;
    flex: 1;
    min-height: 0;
  }

  /* ── Panel ── */
  .db-panel {
    background: var(--surface-2);
    border: 1px solid var(--line-1);
    border-radius: var(--radius-md);
    padding: 1.1rem 1.25rem;
    position: relative;
    overflow: hidden;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    outline: none;
    transition: border-color 150ms ease, box-shadow 250ms ease, transform 150ms ease;
  }
  .db-panel:hover, .db-panel:focus-visible {
    border-color: rgba(181,21,60,0.5);
    box-shadow: 0 0 0 1px rgba(181,21,60,0.15), 0 0 20px rgba(181,21,60,0.1), 0 8px 24px rgba(0,0,0,0.4);
    transform: translateY(-1px);
  }
  .db-panel:focus-visible { outline: 2px solid var(--accent-3); outline-offset: 2px; }
  .db-panel::before {
    content: '';
    position: absolute;
    top: 0; left: 0;
    width: 16px; height: 16px;
    border-top: 2px solid var(--accent-2);
    border-left: 2px solid var(--accent-2);
    border-radius: var(--radius-md) 0 0 0;
    opacity: 0.4;
    transition: opacity 150ms;
  }
  .db-panel:hover::before { opacity: 1; }
  .db-macro-panel { grid-row: 1 / 3; grid-column: 2; }

  /* ── MFD label ── */
  .db-mfd {
    font-family: var(--font-display);
    font-size: 0.82rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--accent-3);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.85rem;
    flex-shrink: 0;
  }
  .db-mfd::after {
    content: '';
    flex: 1;
    height: 1px;
    background: linear-gradient(to right, rgba(181,21,60,0.4), transparent);
  }

  /* ── Big number ── */
  .db-bignum {
    font-family: var(--font-display);
    font-size: 3.2rem;
    font-weight: 700;
    line-height: 1;
    color: var(--text-1);
  }

  /* ── Stat ── */
  .db-stat { display: flex; flex-direction: column; gap: 0.15rem; }
  .db-stat-label {
    font-family: var(--font-display);
    font-size: 0.78rem;
    letter-spacing: 0.14em;
    color: var(--text-3);
    text-transform: uppercase;
  }
  .db-stat-val {
    font-family: var(--font-display);
    font-size: 1.4rem;
    color: var(--text-1);
  }

  /* ── Badges ── */
  .db-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-family: var(--font-display);
    font-size: 0.82rem;
    letter-spacing: 0.07em;
    padding: 0.28rem 0.75rem;
    border: 1px solid;
    border-radius: 6px;
    text-transform: uppercase;
  }
  .db-badge-training { color: var(--accent-3); border-color: var(--accent-1); background: rgba(138,15,46,0.18); }
  .db-badge-rest     { color: #60a5fa;         border-color: #1e3a5f;         background: rgba(30,58,95,0.25); }
  .db-badge-high     { color: #fbbf24;         border-color: #78450f;         background: rgba(120,69,15,0.2); }
  .db-badge-ok       { color: var(--ok);       border-color: #1a4a36;         background: rgba(26,74,54,0.25); }
  .db-badge-warn     { color: var(--warn);     border-color: #5a3a00;         background: rgba(90,58,0,0.2); }

  /* ── Divider ── */
  .db-hr { border: none; border-top: 1px solid var(--line-1); margin: 0.65rem 0; flex-shrink: 0; }

  /* ── Nav hint ── */
  .db-nav-hint {
    position: absolute;
    bottom: 0.65rem; right: 0.9rem;
    font-family: var(--font-display);
    font-size: 0.55rem;
    letter-spacing: 0.12em;
    color: transparent;
    transition: color 150ms;
    text-transform: uppercase;
  }
  .db-panel:hover .db-nav-hint,
  .db-panel:focus-visible .db-nav-hint { color: var(--text-3); }

  /* ── Habit row ── */
  .db-habit-row { display: flex; align-items: center; gap: 0.5rem; padding: 0.25rem 0; }
  .db-habit-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .db-habit-name {
    font-family: var(--font-display);
    font-size: 0.88rem;
    letter-spacing: 0.06em;
    color: var(--text-2);
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .db-habit-check { font-family: var(--font-display); font-size: 0.88rem; flex-shrink: 0; }

  /* ── Progress bar ── */
  .db-progress-track { height: 4px; background: var(--line-1); border-radius: 2px; overflow: hidden; }
  .db-progress-fill  { height: 100%; border-radius: 2px; transition: width 0.8s ease; }

  /* ── Toggle switch ── */
  .db-toggle-wrap { display: flex; align-items: center; gap: 0.5rem; }
  .db-toggle-label {
    font-family: var(--font-display);
    font-size: 0.58rem;
    letter-spacing: 0.1em;
    color: var(--text-3);
  }
  .db-toggle {
    width: 32px; height: 18px;
    background: var(--surface-3);
    border: 1px solid var(--line-2);
    border-radius: 9px;
    position: relative;
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s;
    flex-shrink: 0;
  }
  .db-toggle.on { background: rgba(181,21,60,0.25); border-color: var(--accent-2); }
  .db-toggle-knob {
    width: 12px; height: 12px;
    background: var(--text-3);
    border-radius: 50%;
    position: absolute;
    top: 2px; left: 2px;
    transition: transform 0.2s, background 0.2s;
  }
  .db-toggle.on .db-toggle-knob { transform: translateX(14px); background: var(--accent-3); }

  /* ── Terminal lines (Pilot panel) ── */
  .db-terminal-line {
    font-family: var(--font-display);
    font-size: 0.62rem;
    letter-spacing: 0.08em;
    color: var(--text-3);
    display: flex;
    gap: 0.4rem;
    margin-bottom: 0.3rem;
  }
  .db-terminal-prompt { color: var(--accent-3); }

  /* ── CTA button ── */
  .db-cta-btn {
    display: block;
    width: 100%;
    margin-top: auto;
    padding: 0.8rem;
    background: linear-gradient(135deg, var(--accent-1), var(--accent-2));
    border: none;
    border-radius: var(--radius-sm);
    color: #fff;
    font-family: var(--font-display);
    font-size: 0.92rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    cursor: pointer;
    transition: opacity 0.15s, transform 0.15s;
    text-align: center;
  }
  .db-cta-btn:hover { opacity: 0.85; transform: translateY(-1px); }

  /* ── Gauge grid ── */
  .db-gauge-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
    place-items: center;
    flex: 1;
    min-height: 0;
  }

  /* ── Countdown ── */
  .db-countdown {
    font-family: var(--font-display);
    font-size: 5.5rem;
    font-weight: 700;
    line-height: 1;
    color: var(--text-1);
  }
  .db-countdown-unit {
    font-family: var(--font-display);
    font-size: 0.88rem;
    letter-spacing: 0.2em;
    color: var(--text-3);
    margin-top: 0.2rem;
  }

  /* ── Cal status bar ── */
  .db-cal-status {
    font-family: var(--font-display);
    font-size: 0.92rem;
    letter-spacing: 0.1em;
    padding: 0.4rem 0.7rem;
    border-radius: var(--radius-sm);
    text-align: center;
    margin-top: 0.5rem;
    flex-shrink: 0;
  }

  /* ── Bio carousel ── */
  .db-bio-carousel {
    flex: 1; display: flex; flex-direction: column; min-height: 0; margin-top: 0.6rem;
  }
  .db-bio-slide {
    flex: 1; display: flex; flex-direction: column; justify-content: flex-start; padding: 0.5rem 0 0 0;
    animation: bioFadeIn 0.25s ease; min-height: 0; overflow: hidden;
  }
  @keyframes bioFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
  .db-bio-nav {
    display: flex; align-items: center; justify-content: space-between; padding-top: 0.5rem;
    border-top: 1px solid var(--line-1); margin-top: auto; flex-shrink: 0;
  }
  .db-bio-arrow {
    width: 26px; height: 26px; border-radius: 50%; border: 1px solid var(--line-2);
    background: transparent; color: var(--text-3); display: flex; align-items: center;
    justify-content: center; cursor: pointer; font-size: 0.75rem;
    transition: all 0.15s ease; flex-shrink: 0; line-height: 1;
  }
  .db-bio-arrow:hover { border-color: var(--accent-2); color: var(--accent-3); background: rgba(181,21,60,0.12); }
  .db-bio-dots { display: flex; gap: 5px; align-items: center; }
  .db-bio-dot {
    height: 5px; border-radius: 3px; background: var(--line-2);
    transition: all 0.25s ease; cursor: pointer; width: 5px;
  }
  .db-bio-dot.active { background: var(--accent-3); width: 18px; box-shadow: 0 0 6px var(--accent-2); }
  .db-sparkline-label {
    font-family: var(--font-display); font-size: 0.65rem; letter-spacing: 0.12em;
    color: var(--text-3); text-align: center; margin-top: 0.3rem;
  }
  .db-progress-goal-track {
    height: 8px; background: var(--line-1); border-radius: 4px; overflow: hidden; margin: 0.5rem 0;
  }
  .db-progress-goal-fill {
    height: 100%; border-radius: 4px;
    background: linear-gradient(90deg, var(--accent-1), var(--accent-3));
    box-shadow: 0 0 8px var(--accent-2);
    transition: width 1s cubic-bezier(0.4,0,0.2,1);
  }
  .db-slide-title {
    font-family: var(--font-display); font-size: 0.68rem; letter-spacing: 0.14em;
    color: var(--text-3); text-transform: uppercase; margin-bottom: 0.4rem;
  }
  .db-slide-big {
    font-family: var(--font-display); font-size: 1.9rem; font-weight: 700; line-height: 1; color: var(--text-1);
  }
  .db-slide-sub {
    font-family: var(--font-display); font-size: 0.78rem; color: var(--text-3); margin-top: 0.25rem;
  }

  /* ── Nutrition carousel ── */
  .db-nut-carousel { flex: 1; display: flex; flex-direction: column; min-height: 0; }
  .db-nut-slide { flex: 1; display: flex; flex-direction: column; min-height: 0; overflow: hidden; animation: bioFadeIn 0.25s ease; }
  .db-nut-nav {
    display: flex; align-items: center; justify-content: space-between;
    padding-top: 0.5rem; border-top: 1px solid var(--line-1); flex-shrink: 0; margin-top: 0.4rem;
  }
  /* centred gauge section at top of each detail slide */
  .db-nut-center-gauge {
    display: flex; flex-direction: column; align-items: center; gap: 0.45rem;
    flex-shrink: 0; padding-bottom: 0.5rem;
  }
  .db-macro-remaining {
    font-family: var(--font-display); font-size: 0.75rem; letter-spacing: 0.1em;
    padding: 0.32rem 1rem; border-radius: var(--radius-sm); text-align: center; flex-shrink: 0;
  }
  /* 2×2 stats grid */
  .db-nut-stats-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem;
    width: 100%; flex-shrink: 0; margin-bottom: 0.55rem;
  }
  .db-nut-stat-box {
    background: var(--surface-3); border: 1px solid var(--line-1);
    border-radius: var(--radius-sm); padding: 0.38rem 0.6rem;
    display: flex; flex-direction: column; gap: 0.06rem;
  }
  .db-nut-stat-label {
    font-family: var(--font-display); font-size: 0.57rem; letter-spacing: 0.13em;
    color: var(--text-3); text-transform: uppercase;
  }
  .db-nut-stat-val {
    font-family: var(--font-display); font-size: 1.05rem; font-weight: 700;
    color: var(--text-1); line-height: 1.1;
  }
  /* sources list — flex:1 so it fills remaining space */
  .db-nut-sources {
    flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column;
  }
  .db-sources-label {
    font-family: var(--font-display); font-size: 0.6rem; letter-spacing: 0.18em;
    color: var(--text-3); text-transform: uppercase; margin-bottom: 0.3rem; flex-shrink: 0;
  }
  /* overview bottom summary row */
  .db-nut-summary-row {
    display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 0.35rem;
    flex-shrink: 0; margin-top: 0.4rem;
  }
  .db-nut-summary-cell {
    background: var(--surface-3); border: 1px solid var(--line-1);
    border-radius: var(--radius-sm); padding: 0.3rem 0.4rem; text-align: center;
    display: flex; flex-direction: column; gap: 0.05rem;
  }

  /* ── Responsive ── */
  @media (max-width: 1100px) {
    .db-grid {
      grid-template-columns: 1fr 1.3fr 1fr;
      grid-template-rows: 1fr 1fr 1fr;
    }
    .db-macro-panel { grid-column: 2; grid-row: 1 / 3; }
  }
  @media (max-width: 750px) {
    .db-grid {
      grid-template-columns: 1fr 1fr;
      grid-template-rows: repeat(4, 1fr);
    }
    .db-macro-panel { grid-column: 1 / 3; grid-row: 1; }
    .db-wrap { height: auto; overflow: auto; }
  }
`;

// ─── LiveClock ────────────────────────────────────────────────────────────────
function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const h = zeroPad(now.getHours());
  const m = zeroPad(now.getMinutes());
  const s = zeroPad(now.getSeconds());
  return (
    <div className="db-clock">{h}:{m}:{s}</div>
  );
}

// ─── ToggleSwitch ─────────────────────────────────────────────────────────────
function ToggleSwitch({ on, onToggle, labelOff, labelOn }) {
  return (
    <div className="db-toggle-wrap" onClick={(e) => { e.stopPropagation(); onToggle(); }}>
      <span className="db-toggle-label">{on ? labelOn : labelOff}</span>
      <div className={`db-toggle${on ? " on" : ""}`} role="switch" aria-checked={on} tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); onToggle(); } }}>
        <div className="db-toggle-knob" />
      </div>
    </div>
  );
}

// ─── ArcGauge ─────────────────────────────────────────────────────────────────
function ArcGauge({ value, max, label, color, unit = "g", size = 110 }) {
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const sw = Math.round(size * 0.065);
  const r = (size - sw * 2) / 2;
  const circ = 2 * Math.PI * r;
  const arcFraction = 0.75;
  const arcLen = circ * arcFraction;
  const gapLen = circ - arcLen;
  const fillLen = pct * arcLen;
  const over = max > 0 && value > max * 1.02;
  const fillColor = over ? "var(--bad)" : color;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} style={{ transform: "rotate(-225deg)", display: "block" }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none"
            stroke="var(--line-1)" strokeWidth={sw}
            strokeDasharray={`${arcLen} ${gapLen}`} strokeLinecap="round" />
          <circle cx={size/2} cy={size/2} r={r} fill="none"
            stroke={fillColor} strokeWidth={sw}
            strokeDasharray={`${fillLen} ${circ - fillLen}`} strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 5px ${fillColor})`, transition: "stroke-dasharray 1s cubic-bezier(0.4,0,0.2,1)" }} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "2px" }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: size * 0.18, fontWeight: 700, lineHeight: 1, color: over ? "var(--bad)" : "var(--text-1)" }}>
            {value > 0 ? Math.round(value) : "—"}
          </span>
          <span style={{ fontFamily: "var(--font-display)", fontSize: size * 0.1, color, lineHeight: 1 }}>{unit}</span>
        </div>
      </div>
      <div style={{ textAlign: "center", fontFamily: "var(--font-display)", fontSize: "0.75rem", letterSpacing: "0.14em", color: "var(--text-3)", marginTop: "4px" }}>{label}</div>
    </div>
  );
}

// ─── RadialGauge ──────────────────────────────────────────────────────────────
function RadialGauge({ value, max, size = 120 }) {
  const pct      = max > 0 ? Math.min(value / max, 1) : 0;
  const sw       = 10;
  const r        = (size - sw * 2) / 2;
  const circ     = 2 * Math.PI * r;
  const cx       = size / 2;
  const cy       = size / 2;
  const complete = pct >= 1;
  const color    = complete ? "var(--ok)" : "var(--accent-3)";

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)", display: "block" }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--line-1)" strokeWidth={sw} />
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke={color} strokeWidth={sw}
          strokeDasharray={`${pct * circ} ${circ}`}
          strokeLinecap="round"
          style={{ filter: "drop-shadow(0 0 6px var(--accent-2))", transition: "stroke-dasharray 0.9s cubic-bezier(0.4,0,0.2,1), stroke 0.4s" }}
        />
        {[0, 0.25, 0.5, 0.75].map((p) => {
          const angle = p * 2 * Math.PI - Math.PI / 2;
          const x1 = cx + (r - sw / 2 - 2) * Math.cos(angle);
          const y1 = cy + (r - sw / 2 - 2) * Math.sin(angle);
          const x2 = cx + (r + sw / 2 + 2) * Math.cos(angle);
          const y2 = cy + (r + sw / 2 + 2) * Math.sin(angle);
          return <line key={p} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--line-2)" strokeWidth={1.5} />;
        })}
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: "0.1rem",
      }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: size * 0.22, fontWeight: 700, lineHeight: 1, color: complete ? "var(--ok)" : "var(--text-1)" }}>
          {Math.round(pct * 100)}%
        </span>
        <span style={{ fontFamily: "var(--font-display)", fontSize: size * 0.1, color: "var(--text-3)" }}>
          STEPS
        </span>
      </div>
    </div>
  );
}

// ─── SparkLine ────────────────────────────────────────────────────────────────
function SparkLine({ logs }) {
  if (!logs?.length) return <div style={{ fontFamily: "var(--font-display)", fontSize: "0.75rem", color: "var(--text-3)" }}>Not enough data</div>;
  const W = 220, H = 64;
  const vals = logs.map(l => Number(l.weight_kg));
  const min  = Math.min(...vals);
  const max  = Math.max(...vals);
  const range = max - min || 0.5;
  const px = (i) => (i / Math.max(vals.length - 1, 1)) * (W - 12) + 6;
  const py = (v)  => H - ((v - min) / range) * (H - 12) - 6;
  const pts = vals.map((v, i) => `${px(i)},${py(v)}`).join(" ");
  const fillPts = `${px(0)},${H} ${pts} ${px(vals.length - 1)},${H}`;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent-3)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--accent-3)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={fillPts} fill="url(#spark-fill)" />
      <polyline points={pts} fill="none" stroke="var(--accent-3)" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"
        style={{ filter: "drop-shadow(0 0 4px var(--accent-2))" }} />
      {vals.map((v, i) => (
        <circle key={i} cx={px(i)} cy={py(v)} r={i === vals.length - 1 ? 4 : 2.5}
          fill={i === vals.length - 1 ? "var(--accent-3)" : "var(--surface-2)"}
          stroke="var(--accent-3)" strokeWidth={i === vals.length - 1 ? 0 : 1.5} />
      ))}
    </svg>
  );
}

// ─── FoodRow ──────────────────────────────────────────────────────────────────
function FoodRow({ name, value, unit, totalVal, color }) {
  const pct = totalVal > 0 ? Math.min((value / totalVal) * 100, 100) : 0;
  return (
    <div style={{ marginBottom: "0.45rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.18rem" }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: "0.72rem", color: "var(--text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "72%", letterSpacing: "0.04em" }}>
          {name || "Unknown"}
        </span>
        <span style={{ fontFamily: "var(--font-display)", fontSize: "0.72rem", color, flexShrink: 0, letterSpacing: "0.06em" }}>
          {Math.round(value)}{unit}
        </span>
      </div>
      <div style={{ height: "3px", background: "var(--line-1)", borderRadius: "2px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: "2px",
          boxShadow: `0 0 4px ${color}`, transition: "width 0.9s cubic-bezier(0.4,0,0.2,1)" }} />
      </div>
    </div>
  );
}

// ─── MacroSourceBar ───────────────────────────────────────────────────────────
function MacroSourceBar({ proteinKcal, carbsKcal, fatKcal }) {
  const total = proteinKcal + carbsKcal + fatKcal || 1;
  const pP = (proteinKcal / total) * 100;
  const pC = (carbsKcal  / total) * 100;
  const pF = (fatKcal    / total) * 100;
  return (
    <div style={{ width: "100%" }}>
      <div style={{ height: "10px", borderRadius: "5px", overflow: "hidden", display: "flex", gap: "2px", marginBottom: "0.4rem" }}>
        <div style={{ width: `${pP}%`, background: "#22c55e", boxShadow: "0 0 6px #22c55e55", transition: "width 0.9s ease" }} />
        <div style={{ width: `${pC}%`, background: "#4d8eff", boxShadow: "0 0 6px #4d8eff55", transition: "width 0.9s ease" }} />
        <div style={{ width: `${pF}%`, background: "#f59e0b", boxShadow: "0 0 6px #f59e0b55", transition: "width 0.9s ease" }} />
      </div>
      <div style={{ display: "flex", gap: "0.8rem", justifyContent: "center" }}>
        {[["P", pP, "#22c55e"], ["C", pC, "#4d8eff"], ["F", pF, "#f59e0b"]].map(([l, p, c]) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: c }} />
            <span style={{ fontFamily: "var(--font-display)", fontSize: "0.65rem", color: "var(--text-3)", letterSpacing: "0.08em" }}>
              {l} {Math.round(p)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const { profile, todayDayType, loading: profileLoading } = useProfile();

  const [loading,          setLoading]          = useState(true);
  const [userId,           setUserId]           = useState(null);
  const [unit,             setUnit]             = useState("kg");
  const [unitDisplay,      setUnitDisplay]      = useState("kg");
  const [latest,           setLatest]           = useState(null);
  const [avg7,             setAvg7]             = useState(null);
  const [wLogs,            setWLogs]            = useState([]);
  const [bestWeight,       setBestWeight]       = useState(null);
  const [bioSlide,         setBioSlide]         = useState(0);
  const [stepsToday,       setStepsToday]       = useState(null);
  const [stepsTarget,      setStepsTarget]      = useState(null);
  const [cardioToday,      setCardioToday]      = useState(null);
  const [trainSession,     setTrainSession]     = useState(null);
  const [todayTargets,     setTodayTargets]     = useState(null);
  const [nutLogged,        setNutLogged]        = useState({ calories: 0, protein_g: 0, carbs_g: 0, fats_g: 0 });
  const [nutItems,         setNutItems]         = useState([]);
  const [nutSlide,         setNutSlide]         = useState(0);
  const [habits,           setHabits]           = useState({ total: 0, done: 0, list: [], loggedIds: new Set() });
  const [todayProgramDay,  setTodayProgramDay]  = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: { session: _s } } = await supabase.auth.getSession();
      const ud = { user: _s?.user };
      const user = ud?.user;
      if (!user) { navigate("/", { replace: true }); return; }
      setUserId(user.id);

      const initUnit = profile?.unit_system === "imperial" ? "lb" : "kg";
      setUnit(initUnit);
      setUnitDisplay(initUnit);

      const stepTgt = profile?.baseline_steps_per_day ?? profile?.steps_target ?? null;
      setStepsTarget(stepTgt !== null ? Number(stepTgt) : null);

      const today = todayLocalISO();

      // Weight — fetch 14 days for carousel slides
      const { data: wLogsRaw } = await supabase
        .from("weight_logs").select("log_date, weight_kg")
        .eq("user_id", user.id).order("log_date", { ascending: false }).limit(14);
      if (wLogsRaw?.length) {
        setLatest(wLogsRaw[0]);
        const last7 = wLogsRaw.slice(0, 7);
        setAvg7(last7.reduce((s, l) => s + Number(l.weight_kg), 0) / last7.length);
        setWLogs([...wLogsRaw].reverse()); // ascending for sparkline
      } else { setLatest(null); setAvg7(null); setWLogs([]); }
      // Best weight (min for losing, max for gaining)
      const isGaining = profile?.goal === "gain" || profile?.goal_type === "gain";
      const { data: bestRow } = await supabase
        .from("weight_logs").select("weight_kg")
        .eq("user_id", user.id)
        .order("weight_kg", { ascending: !isGaining })
        .limit(1);
      setBestWeight(bestRow?.[0]?.weight_kg ?? null);

      // Steps
      const { data: sRow } = await supabase
        .from("steps_logs").select("steps")
        .eq("user_id", user.id).eq("log_date", today).maybeSingle();
      setStepsToday(sRow?.steps ?? null);

      // Cardio
      const { data: cRows } = await supabase
        .from("cardio_logs").select("minutes, avg_hr")
        .eq("user_id", user.id).eq("log_date", today)
        .order("created_at", { ascending: false }).limit(1);
      setCardioToday(cRows?.length ? cRows[0] : null);

      // Training session (completed workout today)
      const { data: tSess } = await supabase
        .from("workout_sessions").select("id, session_date")
        .eq("user_id", user.id).eq("session_date", today)
        .not("completed_at", "is", null).limit(1);
      setTrainSession(tSess?.length ? tSess[0] : null);

      // Nutrition targets
      const dayType = todayDayType || "rest";
      let targetRow = null;
      const { data: tRow } = await supabase
        .from("nutrition_day_targets")
        .select("day_type, calories, protein_g, carbs_g, fats_g")
        .eq("user_id", user.id).eq("day_type", dayType).maybeSingle();

      if (!tRow && API_URL) {
        try {
          const { data: sess } = await supabase.auth.getSession();
          const token = sess?.session?.access_token;
          const r = await fetch(`${API_URL}/api/nutrition/init`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: JSON.stringify({ user_id: user.id }),
          });
          if (r.ok) {
            const { data: tRow2 } = await supabase
              .from("nutrition_day_targets")
              .select("day_type, calories, protein_g, carbs_g, fats_g")
              .eq("user_id", user.id).eq("day_type", dayType).maybeSingle();
            targetRow = tRow2 || null;
          }
        } catch { /* silent */ }
      } else { targetRow = tRow || null; }
      setTodayTargets(targetRow);

      // Nutrition logged today
      const { data: items } = await supabase
        .from("daily_nutrition_items").select("food_name, meal_name, calories, protein_g, carbs_g, fats_g")
        .eq("user_id", user.id).eq("log_date", today);
      if (items?.length) {
        setNutItems(items);
        setNutLogged({
          calories:  items.reduce((s, i) => s + Number(i.calories  || 0), 0),
          protein_g: items.reduce((s, i) => s + Number(i.protein_g || 0), 0),
          carbs_g:   items.reduce((s, i) => s + Number(i.carbs_g   || 0), 0),
          fats_g:    items.reduce((s, i) => s + Number(i.fats_g    || 0), 0),
        });
      } else {
        setNutItems([]);
      }

      // Habits completion today
      const { data: allHabits } = await supabase
        .from("habits").select("id, name")
        .eq("user_id", user.id).eq("is_archived", false);
      const { data: todayLogs } = await supabase
        .from("habit_logs").select("habit_id")
        .eq("user_id", user.id).eq("log_date", today);
      const habitTotal = allHabits?.length || 0;
      const habitDone  = todayLogs?.length || 0;
      setHabits({
        total: habitTotal,
        done: habitDone,
        list: allHabits || [],
        loggedIds: new Set(todayLogs?.map(l => l.habit_id) || []),
      });

      // Training program — today's day name
      const { data: programs } = await supabase
        .from("training_programs").select("id, name")
        .eq("user_id", user.id).eq("is_active", true).limit(1);
      if (programs?.length) {
        const prog = programs[0];
        const { data: days } = await supabase
          .from("training_program_days").select("id, day_name, is_rest, sort_order")
          .eq("program_id", prog.id).order("sort_order");
        const dayOfWeek = new Date().getDay(); // 0=Sun
        const fixedIdx   = Math.min(dayOfWeek === 0 ? 6 : dayOfWeek - 1, (days?.length || 1) - 1);
        const rollingIdx = Math.floor(Date.now() / 86400000) % (days?.length || 1);
        const idx = (profile?.split_mode === "rolling") ? rollingIdx : fixedIdx;
        setTodayProgramDay(days?.[idx] || null);
      }

      setLoading(false);
    };
    if (!profileLoading) load();
  }, [navigate, profile, todayDayType, profileLoading]);

  // ── Realtime: re-fetch nutrition whenever daily_nutrition_items changes ──
  useEffect(() => {
    if (!userId) return;
    const today = todayLocalISO();

    const refetchNutrition = async () => {
      const { data: items } = await supabase
        .from("daily_nutrition_items")
        .select("food_name, meal_name, calories, protein_g, carbs_g, fats_g")
        .eq("user_id", userId)
        .eq("log_date", today);
      if (items?.length) {
        setNutItems(items);
        setNutLogged({
          calories:  items.reduce((s, i) => s + Number(i.calories  || 0), 0),
          protein_g: items.reduce((s, i) => s + Number(i.protein_g || 0), 0),
          carbs_g:   items.reduce((s, i) => s + Number(i.carbs_g   || 0), 0),
          fats_g:    items.reduce((s, i) => s + Number(i.fats_g    || 0), 0),
        });
      } else {
        setNutItems([]);
        setNutLogged({ calories: 0, protein_g: 0, carbs_g: 0, fats_g: 0 });
      }
    };

    const channel = supabase
      .channel(`db-nutrition-${userId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "daily_nutrition_items",
      }, refetchNutrition)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const dispW = (kg) => {
    const n = Number(kg);
    if (!isFinite(n)) return "—";
    return unitDisplay === "lb" ? `${round1(kgToLb(n))} lb` : `${round1(n)} kg`;
  };

  const loggedToday = useMemo(() => latest?.log_date === todayLocalISO(), [latest]);
  const trend = useMemo(() => {
    if (!latest || avg7 === null) return null;
    return Number(latest.weight_kg) - Number(avg7);
  }, [latest, avg7]);

  const nav   = (path) => () => navigate(path);
  const onKey = (path) => (e) => e.key === "Enter" && navigate(path);

  const firstName = profile?.first_name || "PILOT";
  const dtLabel   = DAY_LABEL[todayDayType || "rest"] || "REST DAY";
  const hour      = new Date().getHours();
  const greeting  = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // Nutrition helpers
  const calTarget    = todayTargets?.calories   || 0;
  const calLogged    = Math.round(nutLogged.calories);
  const calRemaining = calTarget ? calTarget - calLogged : null;

  // Check-in countdown
  const daysUntil    = getDaysUntilCheckIn(profile?.check_in_day || "Monday");
  const ciDotCls     = daysUntil === 0 ? "db-dot-green" : daysUntil <= 2 ? "db-dot-amber" : "db-dot-dim";
  const ciProgress   = Math.round(((7 - daysUntil) / 7) * 100);

  // Habits status dot
  const habitPct     = habits.total > 0 ? habits.done / habits.total : 0;
  const habitDotCls  = habitPct >= 0.8 ? "db-dot-green" : habitPct >= 0.3 ? "db-dot-amber" : "db-dot-red";

  // Today's training program day label
  const programDayName = todayProgramDay?.day_name || (todayDayType === "training" ? "TRAINING DAY" : "REST DAY");

  if (profileLoading || loading) return <PhysiquePilotLoader />;

  return (
    <>
      <style>{CSS}</style>

      <div className="db-wrap">

        {/* ── HEADER ──────────────────────────────────────────────────────────── */}
        <div className="db-header">
          <div className="db-header-left">
            <div className="db-header-eyebrow">PHYSIQUE PILOT</div>
            <div className="db-header-greeting">
              <span className="db-dot db-dot-green" />
              {greeting}, <span style={{ color: "var(--accent-3)" }}>{firstName}.</span>
            </div>
          </div>
          <div className="db-header-center">
            <LiveClock />
          </div>
          <div className="db-header-right">
            <div style={{ fontFamily: "var(--font-display)", fontSize: "0.7rem", color: "var(--text-3)", letterSpacing: "0.12em" }}>
              {fmtDisplayDate()}
            </div>
            <span className={`db-badge db-badge-${todayDayType === "training" ? "training" : todayDayType === "high" ? "high" : "rest"}`}>
              <span className={`db-dot db-dot-${todayDayType === "training" ? "red" : todayDayType === "high" ? "amber" : "green"}`} />
              {dtLabel}
            </span>
          </div>
        </div>

        {/* ── GRID ────────────────────────────────────────────────────────────── */}
        <div className="db-grid">

          {/* ── COL 1 ROW 1: BIOMETRICS ── */}
          <div className="db-panel" onClick={nav("/app/weight")} role="button"
            tabIndex={0} onKeyDown={onKey("/app/weight")} aria-label="Open weight tracking">

            <div className="db-mfd">
              <span className="db-dot db-dot-green" />
              ◈ BIOMETRICS
              <div style={{ marginLeft: "auto", marginRight: 0 }} onClick={(e) => e.stopPropagation()}>
                <ToggleSwitch
                  on={unitDisplay === "lb"}
                  onToggle={() => setUnitDisplay(u => u === "kg" ? "lb" : "kg")}
                  labelOff="KG"
                  labelOn="LB"
                />
              </div>
            </div>

            {latest ? (
              <>
                <div className="db-bignum">{dispW(latest.weight_kg)}</div>
                <div style={{ marginTop: "0.4rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  {trend !== null && (
                    <span style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem",
                      color: trend > 0.05 ? "var(--bad)" : trend < -0.05 ? "#60a5fa" : "var(--ok)" }}>
                      {trend > 0.05 ? "↑" : trend < -0.05 ? "↓" : "→"} {dispW(Math.abs(trend))}
                    </span>
                  )}
                  <span style={{ fontSize: "0.88rem", color: "var(--text-3)", fontFamily: "var(--font-display)" }}>vs 7-day avg</span>
                </div>
                <div style={{ marginTop: "0.5rem" }}>
                  {loggedToday
                    ? <span className="db-badge db-badge-ok">✓ LOGGED TODAY</span>
                    : <span className="db-badge db-badge-warn">⚠ NOT LOGGED</span>}
                </div>
              </>
            ) : (
              <>
                <div className="db-bignum" style={{ color: "var(--text-3)" }}>—</div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-3)", marginTop: "0.4rem", fontFamily: "var(--font-display)" }}>
                  No data. Tap to log weight.
                </div>
              </>
            )}

            {latest && (() => {
              const BIO_SLIDES = 6;
              const goalW   = Number(profile?.target_weight_kg || profile?.goal_weight_kg || 0);
              const startW  = Number(profile?.starting_weight_kg || 0);
              const currW   = Number(latest.weight_kg);
              const isGain  = profile?.goal === "gain" || profile?.goal_type === "gain";
              // slide 2: week avgs
              const thisWeekLogs = wLogs.slice(-7);
              const lastWeekLogs = wLogs.slice(-14, -7);
              const thisAvg = thisWeekLogs.length ? thisWeekLogs.reduce((s,l)=>s+Number(l.weight_kg),0)/thisWeekLogs.length : null;
              const lastAvg = lastWeekLogs.length ? lastWeekLogs.reduce((s,l)=>s+Number(l.weight_kg),0)/lastWeekLogs.length : null;
              const weekDelta = thisAvg !== null && lastAvg !== null ? thisAvg - lastAvg : null;
              // slide 3: progress to goal
              const progPct = goalW && startW && startW !== goalW
                ? Math.min(Math.max(isGain
                    ? (currW - startW) / (goalW - startW)
                    : (startW - currW) / (startW - goalW), 0), 1) * 100
                : null;
              // slide 4: rate of change
              const sortedLogs = [...wLogs];
              const rateWks = sortedLogs.length >= 2
                ? (() => {
                    const days = (new Date(sortedLogs[sortedLogs.length-1].log_date) - new Date(sortedLogs[0].log_date)) / 86400000;
                    const delta = Number(sortedLogs[sortedLogs.length-1].weight_kg) - Number(sortedLogs[0].weight_kg);
                    return days > 0 ? (delta / days) * 7 : null;
                  })()
                : null;

              const slides = [
                // 0: sparkline
                <div key="spark" className="db-bio-slide">
                  <div className="db-slide-title">7-DAY TREND</div>
                  <SparkLine logs={wLogs.slice(-7)} />
                  <div className="db-sparkline-label">
                    {wLogs.length >= 2
                      ? `${dispW(Number(wLogs[wLogs.length-1]?.weight_kg))} now · ${dispW(Number(wLogs[Math.max(wLogs.length-7,0)]?.weight_kg))} 7 days ago`
                      : "Log more weights to see trend"}
                  </div>
                </div>,
                // 1: total change since start
                <div key="total" className="db-bio-slide">
                  <div className="db-slide-title">TOTAL CHANGE</div>
                  {startW ? (() => {
                    const diff = currW - startW;
                    const col = diff < -0.05 ? "#60a5fa" : diff > 0.05 ? "var(--bad)" : "var(--ok)";
                    return <>
                      <div className="db-slide-big" style={{ color: col }}>
                        {diff > 0 ? "+" : ""}{dispW(diff)}
                      </div>
                      <div className="db-slide-sub">since starting weight ({dispW(startW)})</div>
                    </>;
                  })() : <div className="db-slide-sub">Set a starting weight in Settings to track total change.</div>}
                </div>,
                // 2: this week vs last week
                <div key="weeks" className="db-bio-slide">
                  <div className="db-slide-title">THIS WEEK VS LAST</div>
                  {thisAvg !== null ? <>
                    <div style={{ display: "flex", gap: "1.2rem", alignItems: "flex-end" }}>
                      <div>
                        <div className="db-slide-sub">This week</div>
                        <div className="db-slide-big" style={{ fontSize: "1.5rem" }}>{dispW(thisAvg)}</div>
                      </div>
                      {lastAvg !== null && <div>
                        <div className="db-slide-sub">Last week</div>
                        <div className="db-slide-big" style={{ fontSize: "1.5rem", color: "var(--text-3)" }}>{dispW(lastAvg)}</div>
                      </div>}
                    </div>
                    {weekDelta !== null && <div className="db-slide-sub" style={{ marginTop: "0.3rem",
                      color: weekDelta < -0.05 ? "#60a5fa" : weekDelta > 0.05 ? "var(--bad)" : "var(--ok)" }}>
                      {weekDelta > 0 ? "+" : ""}{dispW(weekDelta)} vs last week
                    </div>}
                  </> : <div className="db-slide-sub">Log weights across two weeks to compare.</div>}
                </div>,
                // 3: progress to goal
                <div key="prog" className="db-bio-slide">
                  <div className="db-slide-title">PROGRESS TO GOAL</div>
                  {goalW && startW ? <>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}>
                      <span className="db-slide-sub">{dispW(startW)}</span>
                      <span className="db-slide-sub">{dispW(goalW)}</span>
                    </div>
                    <div className="db-progress-goal-track">
                      <div className="db-progress-goal-fill" style={{ width: `${progPct || 0}%` }} />
                    </div>
                    <div className="db-slide-big" style={{ fontSize: "1.6rem", marginTop: "0.3rem" }}>
                      {Math.round(progPct || 0)}%
                      <span className="db-slide-sub" style={{ fontSize: "0.78rem", marginLeft: "0.5rem" }}>
                        {dispW(Math.abs(currW - goalW))} to go
                      </span>
                    </div>
                  </> : <div className="db-slide-sub">Set a target weight in Settings to track progress.</div>}
                </div>,
                // 4: rate of change
                <div key="rate" className="db-bio-slide">
                  <div className="db-slide-title">RATE OF CHANGE</div>
                  {rateWks !== null ? <>
                    <div className="db-slide-big" style={{
                      color: rateWks < -0.05 ? "#60a5fa" : rateWks > 0.05 ? "var(--bad)" : "var(--ok)" }}>
                      {rateWks > 0 ? "+" : ""}{dispW(rateWks)}
                    </div>
                    <div className="db-slide-sub">per week (avg over logged data)</div>
                  </> : <div className="db-slide-sub">Not enough data to calculate rate.</div>}
                </div>,
                // 5: best weight
                <div key="best" className="db-bio-slide">
                  <div className="db-slide-title">{isGain ? "PEAK WEIGHT" : "LOWEST WEIGHT"}</div>
                  {bestWeight ? <>
                    <div className="db-slide-big" style={{ color: "var(--accent-3)" }}>{dispW(bestWeight)}</div>
                    <div className="db-slide-sub">
                      {isGain ? "Heaviest recorded" : "Lightest recorded"} · {dispW(Math.abs(currW - Number(bestWeight)))} {isGain ? "below" : "above"} current
                    </div>
                  </> : <div className="db-slide-sub">No data yet.</div>}
                </div>,
              ];

              return (
                <div className="db-bio-carousel">
                  {slides[bioSlide]}
                  <div className="db-bio-nav">
                    <button className="db-bio-arrow"
                      onClick={(e) => { e.stopPropagation(); setBioSlide(s => (s - 1 + BIO_SLIDES) % BIO_SLIDES); }}
                      aria-label="Previous">‹</button>
                    <div className="db-bio-dots">
                      {Array.from({ length: BIO_SLIDES }).map((_, i) => (
                        <div key={i} className={`db-bio-dot${bioSlide === i ? " active" : ""}`}
                          onClick={(e) => { e.stopPropagation(); setBioSlide(i); }} />
                      ))}
                    </div>
                    <button className="db-bio-arrow"
                      onClick={(e) => { e.stopPropagation(); setBioSlide(s => (s + 1) % BIO_SLIDES); }}
                      aria-label="Next">›</button>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* ── COL 2 ROWS 1-2: NUTRITION CAROUSEL ── */}
          <div className="db-panel db-macro-panel" onClick={nav("/app/nutrition")} role="button"
            tabIndex={0} onKeyDown={onKey("/app/nutrition")} aria-label="Open nutrition">

            {(() => {
              const NUT_SLIDES = 5;
              const slideLabels = ["OVERVIEW", "CALORIES", "PROTEIN", "CARBS", "FATS"];
              const slideColors = ["var(--accent-3)", "var(--accent-3)", "#22c55e", "#4d8eff", "#f59e0b"];
              const dotColor = slideColors[nutSlide];

              // Derived values
              const calTarget  = todayTargets?.calories  || 2000;
              const proTarget  = todayTargets?.protein_g || 150;
              const carbTarget = todayTargets?.carbs_g   || 200;
              const fatTarget  = todayTargets?.fats_g    || 60;
              const calLog     = Math.round(nutLogged.calories);
              const proLog     = Math.round(nutLogged.protein_g);
              const carbLog    = Math.round(nutLogged.carbs_g);
              const fatLog     = Math.round(nutLogged.fats_g);
              const proteinKcal = proLog * 4;
              const carbsKcal   = carbLog * 4;
              const fatKcal     = fatLog * 9;
              const weightKg    = latest ? Number(latest.weight_kg) : null;
              const gpkg        = weightKg && weightKg > 0 ? (proLog / weightKg).toFixed(1) : null;
              const gpkgTarget  = weightKg && weightKg > 0 ? (proTarget / weightKg).toFixed(1) : null;

              // Top food sources helpers (up to 6 items to fill space)
              const topSources = (macro) => [...nutItems]
                .filter(i => Number(i[macro] || 0) > 0)
                .sort((a, b) => Number(b[macro]) - Number(a[macro]))
                .slice(0, 6)
                .map(i => ({ name: i.food_name || i.meal_name || "Food item", value: Number(i[macro] || 0) }));

              const dayContextLabel = todayDayType === "training"
                ? { text: "Training day — higher carbs recommended", bg: "rgba(138,15,46,0.15)", col: "var(--accent-3)" }
                : todayDayType === "high"
                  ? { text: "High day — surplus carbs", bg: "rgba(120,69,15,0.15)", col: "#fbbf24" }
                  : { text: "Rest day — reduced carbs", bg: "rgba(30,58,95,0.15)", col: "#60a5fa" };

              const RemBadge = ({ remaining, unit, color }) => (
                <div className="db-macro-remaining" style={{
                  background: remaining >= 0 ? "rgba(26,74,54,0.2)" : "rgba(138,15,46,0.15)",
                  border: `1px solid ${remaining >= 0 ? "#1a4a36" : "var(--accent-1)"}`,
                  color: remaining >= 0 ? "var(--ok)" : "var(--bad)",
                }}>
                  {remaining >= 0 ? `${remaining}${unit} remaining` : `${Math.abs(remaining)}${unit} over target`}
                </div>
              );

              const SourceList = ({ macro, unit, color }) => {
                const sources = topSources(macro);
                const total = sources.reduce((s, f) => s + f.value, 0) || 1;
                return sources.length > 0
                  ? sources.map((f, i) => <FoodRow key={i} name={f.name} value={f.value} unit={unit} totalVal={total} color={color} />)
                  : <div className="db-slide-sub">Nothing logged yet today.</div>;
              };

              // derived stats
              const pctOfCal = (kcal) => calLog > 0 ? Math.round((kcal / calLog) * 100) : 0;

              const slides = [
                // 0: Overview — 4 large gauges filling the panel + summary row
                <div key="overview" className="db-nut-slide">
                  <div className="db-gauge-grid" style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
                    <ArcGauge value={calLog}  max={calTarget}  label="CALORIES" color="var(--accent-3)" unit="kcal" size={168} />
                    <ArcGauge value={proLog}  max={proTarget}  label="PROTEIN"  color="#22c55e"         unit="g"    size={168} />
                    <ArcGauge value={carbLog} max={carbTarget} label="CARBS"    color="#4d8eff"         unit="g"    size={168} />
                    <ArcGauge value={fatLog}  max={fatTarget}  label="FATS"     color="#f59e0b"         unit="g"    size={168} />
                  </div>
                  {/* logged / target summary + remaining */}
                  <div className="db-nut-summary-row">
                    {[
                      { label: "CALORIES", logged: calLog, target: calTarget, unit: "kcal", color: "var(--accent-3)" },
                      { label: "PROTEIN",  logged: proLog,  target: proTarget,  unit: "g",    color: "#22c55e" },
                      { label: "CARBS",    logged: carbLog, target: carbTarget, unit: "g",    color: "#4d8eff" },
                      { label: "FATS",     logged: fatLog,  target: fatTarget,  unit: "g",    color: "#f59e0b" },
                    ].map(({ label, logged, target, unit, color }) => (
                      <div key={label} className="db-nut-summary-cell">
                        <span style={{ fontFamily: "var(--font-display)", fontSize: "0.55rem", letterSpacing: "0.12em", color: "var(--text-3)" }}>{label}</span>
                        <span style={{ fontFamily: "var(--font-display)", fontSize: "0.9rem", fontWeight: 700, color, lineHeight: 1 }}>{logged}</span>
                        <span style={{ fontFamily: "var(--font-display)", fontSize: "0.58rem", color: "var(--text-3)" }}>/ {target}{unit}</span>
                      </div>
                    ))}
                  </div>
                  {calRemaining !== null && (
                    <div className="db-cal-status" style={{
                      background: calRemaining >= 0 ? "rgba(26,74,54,0.25)" : "rgba(138,15,46,0.2)",
                      border: `1px solid ${calRemaining >= 0 ? "#1a4a36" : "var(--accent-1)"}`,
                      color: calRemaining >= 0 ? "var(--ok)" : "var(--bad)",
                      marginTop: "0.4rem",
                    }}>
                      {calRemaining >= 0 ? `${calRemaining} kcal remaining` : `${Math.abs(calRemaining)} kcal over target`}
                    </div>
                  )}
                </div>,

                // 1: Calories — large centred gauge + macro split + stats grid + sources
                <div key="cal" className="db-nut-slide">
                  <div className="db-nut-center-gauge">
                    <ArcGauge value={calLog} max={calTarget} label="CALORIES" color="var(--accent-3)" unit="kcal" size={210} />
                    <RemBadge remaining={calRemaining ?? (calTarget - calLog)} unit=" kcal" />
                  </div>
                  <div className="db-sources-label">Macro split</div>
                  <MacroSourceBar proteinKcal={proteinKcal} carbsKcal={carbsKcal} fatKcal={fatKcal} />
                  <div className="db-nut-stats-grid" style={{ marginTop: "0.5rem" }}>
                    <div className="db-nut-stat-box">
                      <span className="db-nut-stat-label">Protein</span>
                      <span className="db-nut-stat-val" style={{ color: "#22c55e" }}>{proteinKcal} kcal</span>
                    </div>
                    <div className="db-nut-stat-box">
                      <span className="db-nut-stat-label">Carbs</span>
                      <span className="db-nut-stat-val" style={{ color: "#4d8eff" }}>{carbsKcal} kcal</span>
                    </div>
                    <div className="db-nut-stat-box">
                      <span className="db-nut-stat-label">Fats</span>
                      <span className="db-nut-stat-val" style={{ color: "#f59e0b" }}>{fatKcal} kcal</span>
                    </div>
                    <div className="db-nut-stat-box">
                      <span className="db-nut-stat-label">Target</span>
                      <span className="db-nut-stat-val">{calTarget} kcal</span>
                    </div>
                  </div>
                  <div className="db-sources-label">Top contributors</div>
                  <div className="db-nut-sources">
                    <SourceList macro="calories" unit=" kcal" color="var(--accent-3)" />
                  </div>
                </div>,

                // 2: Protein — large centred gauge + 4 stats + sources
                <div key="pro" className="db-nut-slide">
                  <div className="db-nut-center-gauge">
                    <ArcGauge value={proLog} max={proTarget} label="PROTEIN" color="#22c55e" unit="g" size={210} />
                    <RemBadge remaining={proTarget - proLog} unit="g" />
                  </div>
                  <div className="db-nut-stats-grid">
                    <div className="db-nut-stat-box">
                      <span className="db-nut-stat-label">g / kg bodyweight</span>
                      <span className="db-nut-stat-val" style={{ color: "#22c55e" }}>{gpkg ?? "—"}</span>
                    </div>
                    <div className="db-nut-stat-box">
                      <span className="db-nut-stat-label">Target g / kg</span>
                      <span className="db-nut-stat-val">{gpkgTarget ?? "—"}</span>
                    </div>
                    <div className="db-nut-stat-box">
                      <span className="db-nut-stat-label">As kcal</span>
                      <span className="db-nut-stat-val">{proteinKcal}</span>
                    </div>
                    <div className="db-nut-stat-box">
                      <span className="db-nut-stat-label">% of kcal logged</span>
                      <span className="db-nut-stat-val" style={{ color: "#22c55e" }}>{pctOfCal(proteinKcal)}%</span>
                    </div>
                  </div>
                  <div className="db-sources-label">Top sources</div>
                  <div className="db-nut-sources">
                    <SourceList macro="protein_g" unit="g" color="#22c55e" />
                  </div>
                </div>,

                // 3: Carbs — large centred gauge + 4 stats + sources
                <div key="carb" className="db-nut-slide">
                  <div className="db-nut-center-gauge">
                    <ArcGauge value={carbLog} max={carbTarget} label="CARBS" color="#4d8eff" unit="g" size={210} />
                    <RemBadge remaining={carbTarget - carbLog} unit="g" />
                  </div>
                  <div className="db-nut-stats-grid">
                    <div className="db-nut-stat-box">
                      <span className="db-nut-stat-label">As kcal</span>
                      <span className="db-nut-stat-val">{carbsKcal}</span>
                    </div>
                    <div className="db-nut-stat-box">
                      <span className="db-nut-stat-label">% of kcal logged</span>
                      <span className="db-nut-stat-val" style={{ color: "#4d8eff" }}>{pctOfCal(carbsKcal)}%</span>
                    </div>
                    <div className="db-nut-stat-box" style={{ gridColumn: "1 / -1", borderColor: `${dayContextLabel.col}44` }}>
                      <span className="db-nut-stat-label">Day context</span>
                      <span className="db-nut-stat-val" style={{ fontSize: "0.88rem", color: dayContextLabel.col }}>{dayContextLabel.text}</span>
                    </div>
                  </div>
                  <div className="db-sources-label">Top sources</div>
                  <div className="db-nut-sources">
                    <SourceList macro="carbs_g" unit="g" color="#4d8eff" />
                  </div>
                </div>,

                // 4: Fats — large centred gauge + 4 stats + sources
                <div key="fat" className="db-nut-slide">
                  <div className="db-nut-center-gauge">
                    <ArcGauge value={fatLog} max={fatTarget} label="FATS" color="#f59e0b" unit="g" size={210} />
                    <RemBadge remaining={fatTarget - fatLog} unit="g" />
                  </div>
                  <div className="db-nut-stats-grid">
                    <div className="db-nut-stat-box">
                      <span className="db-nut-stat-label">As kcal</span>
                      <span className="db-nut-stat-val">{fatKcal}</span>
                    </div>
                    <div className="db-nut-stat-box">
                      <span className="db-nut-stat-label">% of kcal logged</span>
                      <span className="db-nut-stat-val" style={{ color: "#f59e0b" }}>{pctOfCal(fatKcal)}%</span>
                    </div>
                    <div className="db-nut-stat-box">
                      <span className="db-nut-stat-label">Target</span>
                      <span className="db-nut-stat-val">{fatTarget}g</span>
                    </div>
                    <div className="db-nut-stat-box">
                      <span className="db-nut-stat-label">9 kcal per gram</span>
                      <span className="db-nut-stat-val" style={{ color: "#f59e0b" }}>{fatLog}g logged</span>
                    </div>
                  </div>
                  <div className="db-sources-label">Top sources</div>
                  <div className="db-nut-sources">
                    <SourceList macro="fats_g" unit="g" color="#f59e0b" />
                  </div>
                </div>,
              ];

              return (
                <>
                  <div className="db-mfd">
                    <span className={`db-dot ${calRemaining !== null && calRemaining < 0 ? "db-dot-red" : "db-dot-green"}`} />
                    <span style={{ color: nutSlide === 0 ? "var(--accent-3)" : slideColors[nutSlide] }}>
                      ◈ {slideLabels[nutSlide]}
                    </span>
                  </div>
                  <div className="db-nut-carousel">
                    {slides[nutSlide]}
                    <div className="db-nut-nav">
                      <button className="db-bio-arrow"
                        onClick={(e) => { e.stopPropagation(); setNutSlide(s => (s - 1 + NUT_SLIDES) % NUT_SLIDES); }}
                        aria-label="Previous">‹</button>
                      <div className="db-bio-dots">
                        {Array.from({ length: NUT_SLIDES }).map((_, i) => (
                          <div key={i}
                            className={`db-bio-dot${nutSlide === i ? " active" : ""}`}
                            style={nutSlide === i ? { background: dotColor, boxShadow: `0 0 6px ${dotColor}` } : {}}
                            onClick={(e) => { e.stopPropagation(); setNutSlide(i); }} />
                        ))}
                      </div>
                      <button className="db-bio-arrow"
                        onClick={(e) => { e.stopPropagation(); setNutSlide(s => (s + 1) % NUT_SLIDES); }}
                        aria-label="Next">›</button>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>

          {/* ── COL 3 ROW 1: TRAINING TODAY ── */}
          <div className="db-panel" onClick={nav("/app/training")} role="button"
            tabIndex={0} onKeyDown={onKey("/app/training")} aria-label="Open training">

            <div className="db-mfd">
              <span className={`db-dot db-dot-${todayDayType === "training" ? "red" : "green"}`} />
              ◈ TRAINING
            </div>

            <div style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem", fontWeight: 700, color: todayProgramDay?.is_rest ? "var(--text-3)" : "var(--text-1)", marginBottom: "0.5rem", lineHeight: 1.2 }}>
              {todayProgramDay?.is_rest
                ? "REST DAY"
                : programDayName}
            </div>

            <div style={{ marginBottom: "0.5rem" }}>
              {trainSession
                ? <span className="db-badge db-badge-ok">✓ SESSION LOGGED</span>
                : todayDayType === "training"
                  ? <span className="db-badge db-badge-warn">PENDING</span>
                  : <span style={{ fontFamily: "var(--font-display)", fontSize: "0.9rem", color: "var(--text-3)" }}>Rest day</span>}
            </div>

            <hr className="db-hr" />

            <div className="db-stat">
              <span className="db-stat-label">NUTRITION TARGET</span>
              <span className="db-stat-val" style={{ fontSize: "1.1rem", marginTop: "0.2rem", color: "var(--text-2)" }}>
                {todayDayType === "training" ? "Training day macros"
                 : todayDayType === "high"   ? "High day macros"
                 :                             "Rest day macros"}
              </span>
            </div>

            <div className="db-nav-hint">OPEN TRAINING →</div>
          </div>

          {/* ── COL 4 ROW 1: MOVEMENT ── */}
          <div className="db-panel" onClick={nav("/app/cardio-steps")} role="button"
            tabIndex={0} onKeyDown={onKey("/app/cardio-steps")} aria-label="Open movement">

            <div className="db-mfd">
              <span className={`db-dot ${stepsToday !== null && stepsTarget !== null && stepsToday >= stepsTarget ? "db-dot-green" : "db-dot-amber"}`} />
              ◈ MOVEMENT
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.3rem", flex: 1, justifyContent: "center" }}>
              <RadialGauge value={stepsToday || 0} max={stepsTarget || 10000} size={160} />
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem", fontWeight: 700, color: "var(--text-1)" }}>
                  {stepsToday !== null ? stepsToday.toLocaleString() : "—"}
                  <span style={{ fontSize: "0.85rem", color: "var(--text-3)", marginLeft: "0.35rem" }}>
                    / {stepsTarget !== null ? stepsTarget.toLocaleString() : "10,000"}
                  </span>
                </div>
                {stepsToday !== null && stepsTarget !== null && stepsToday < stepsTarget && (
                  <div style={{ fontFamily: "var(--font-display)", fontSize: "0.85rem", color: "var(--text-3)", letterSpacing: "0.1em" }}>
                    {(stepsTarget - stepsToday).toLocaleString()} REMAINING
                  </div>
                )}
              </div>
            </div>

            <hr className="db-hr" />

            <div className="db-stat-label" style={{ marginBottom: "0.3rem" }}>CARDIO SESSION</div>
            {cardioToday ? (
              <div style={{ display: "flex", gap: "1rem" }}>
                <div className="db-stat">
                  <span className="db-stat-label">DURATION</span>
                  <span className="db-stat-val" style={{ fontSize: "0.85rem" }}>{cardioToday.minutes} min</span>
                </div>
                {cardioToday.avg_hr && (
                  <div className="db-stat">
                    <span className="db-stat-label">AVG HR</span>
                    <span className="db-stat-val" style={{ fontSize: "0.85rem" }}>{cardioToday.avg_hr} bpm</span>
                  </div>
                )}
              </div>
            ) : (
              <span style={{ fontFamily: "var(--font-display)", fontSize: "0.92rem", color: "var(--text-3)" }}>
                NO CARDIO LOGGED
              </span>
            )}

            <div className="db-nav-hint">OPEN MOVEMENT →</div>
          </div>

          {/* ── COL 1 ROW 2: HABITS ── */}
          <div className="db-panel" onClick={nav("/app/habits")} role="button"
            tabIndex={0} onKeyDown={onKey("/app/habits")} aria-label="Open habits">

            <div className="db-mfd">
              <span className={`db-dot ${habitDotCls}`} />
              ◈ HABITS
            </div>

            <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", marginBottom: "0.3rem" }}>
              <div className="db-bignum" style={{ fontSize: "2.8rem" }}>
                {habits.done}<span style={{ color: "var(--text-3)", fontSize: "1.8rem" }}>/{habits.total}</span>
              </div>
              <span className={`db-badge ${habitPct >= 0.8 ? "db-badge-ok" : habitPct >= 0.3 ? "db-badge-warn" : "db-badge-training"}`}>
                {habits.total > 0 ? `${Math.round(habitPct * 100)}%` : "—"}
              </span>
            </div>

            <hr className="db-hr" />

            <div style={{ flex: 1, overflow: "hidden" }}>
              {habits.list.slice(0, 5).map((h) => {
                const done = habits.loggedIds.has(h.id);
                return (
                  <div key={h.id} className="db-habit-row">
                    <div className="db-habit-dot" style={{ background: done ? "var(--ok)" : "var(--line-2)" }} />
                    <span className="db-habit-name">{h.name}</span>
                    <span className="db-habit-check" style={{ color: done ? "var(--ok)" : "var(--text-3)" }}>
                      {done ? "✓" : "○"}
                    </span>
                  </div>
                );
              })}
              {habits.list.length > 5 && (
                <div style={{ fontFamily: "var(--font-display)", fontSize: "0.72rem", color: "var(--text-3)", letterSpacing: "0.1em", marginTop: "0.25rem" }}>
                  +{habits.list.length - 5} MORE
                </div>
              )}
              {habits.total === 0 && (
                <div style={{ fontFamily: "var(--font-display)", fontSize: "0.65rem", color: "var(--text-3)" }}>
                  No habits configured.
                </div>
              )}
            </div>

            <div className="db-nav-hint">OPEN HABITS →</div>
          </div>

          {/* ── COL 3 ROW 2: CHECK-IN ── */}
          <div className="db-panel" onClick={nav("/app/check-ins")} role="button"
            tabIndex={0} onKeyDown={onKey("/app/check-ins")} aria-label="Open check-ins">

            <div className="db-mfd">
              <span className={`db-dot ${ciDotCls}`} />
              ◈ CHECK-IN
            </div>

            <div style={{ textAlign: "center", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.25rem" }}>
              <div className="db-countdown">{daysUntil}</div>
              <div className="db-countdown-unit">
                {daysUntil === 0 ? "Check-in day" : "days to check-in"}
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "0.9rem", color: "var(--text-3)", letterSpacing: "0.12em", marginTop: "0.3rem" }}>
                {(profile?.check_in_day || "Monday")}s
              </div>
            </div>

            <hr className="db-hr" />

            <div style={{ marginBottom: "0.5rem" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "0.82rem", letterSpacing: "0.12em", color: "var(--text-3)", marginBottom: "0.35rem" }}>
                Week progress
              </div>
              <div className="db-progress-track">
                <div className="db-progress-fill" style={{
                  width: `${ciProgress}%`,
                  background: daysUntil === 0 ? "var(--ok)" : daysUntil <= 2 ? "var(--warn)" : "var(--accent-2)",
                }} />
              </div>
            </div>

            {daysUntil === 0 && (
              <button className="db-cta-btn" onClick={(e) => { e.stopPropagation(); navigate("/app/check-ins"); }}>
                Go to check-in
              </button>
            )}

            <div className="db-nav-hint">OPEN CHECK-INS →</div>
          </div>

          {/* ── COL 4 ROW 2: THE PILOT ── */}
          <div className="db-panel" onClick={nav("/app/coach")} role="button"
            tabIndex={0} onKeyDown={onKey("/app/coach")} aria-label="Open AI coach">

            <div className="db-mfd">
              <span className="db-dot db-dot-green" />
              ◈ THE PILOT
            </div>

            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: "0.5rem" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "0.95rem", color: "var(--text-3)", letterSpacing: "0.04em", lineHeight: 1.7 }}>
                Ask anything about your training, nutrition, or progress. The Pilot has access to all of your data.
              </div>
            </div>

            <button className="db-cta-btn" onClick={(e) => { e.stopPropagation(); navigate("/app/coach"); }}>
              Open The Pilot
            </button>

            <div className="db-nav-hint">OPEN COACH →</div>
          </div>

        </div>
      </div>
    </>
  );
}
