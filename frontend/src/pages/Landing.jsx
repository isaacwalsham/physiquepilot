import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { LineChart, Line, ResponsiveContainer } from "recharts";

// ─── Demo data ────────────────────────────────────────────────────────────────

const WEIGHT_DATA = [
  { d: 1, v: 89.2 }, { d: 2, v: 89.0 }, { d: 3, v: 88.8 },
  { d: 4, v: 89.1 }, { d: 5, v: 88.6 }, { d: 6, v: 88.4 },
  { d: 7, v: 88.7 }, { d: 8, v: 88.3 }, { d: 9, v: 88.1 },
  { d: 10, v: 87.9 }, { d: 11, v: 87.7 }, { d: 12, v: 87.5 },
  { d: 13, v: 87.8 }, { d: 14, v: 87.4 }
];

const AI_MSGS = [
  "→ Calorie deficit held for 8 consecutive days. Protein on target.",
  "→ Step count dropped this week — recommend +150 kcal buffer today.",
  "→ Weight trending −0.6 kg/week. Cut is progressing well.",
  "→ Lower training volume detected. Consider adjusting carb intake.",
  "→ 3 check-ins logged. Body composition trending in the right direction.",
  "→ Recovery data suggests a deload window in approximately 2 weeks."
];

const FEATURES = [
  {
    code: "NUT",
    label: "Nutrition Tracking",
    blurb:
      "Log every meal. Track calories, macros, AND micronutrients down to vitamins and minerals — the level of detail normally only an experienced dietitian provides.",
    detail: "Calories · Macros · Micros · Water · Salt"
  },
  {
    code: "TRN",
    label: "Training Engine",
    blurb:
      "Build training blocks, follow structured weekly or rolling splits, and log every set and rep. Your program stays progressive and organised in one place.",
    detail: "Programs · Splits · Sets · Reps · Progressions"
  },
  {
    code: "WGT",
    label: "Weight Command",
    blurb:
      "Daily weigh-ins are noisy. PhysiquePilot shows you the real trend line — so you know whether your cut or bulk is actually working, without panicking over a bad day.",
    detail: "Trend Line · Daily Log · Pattern Recognition"
  },
  {
    code: "ACT",
    label: "Activity Monitor",
    blurb:
      "Steps, cardio sessions, and water intake all feed into the same system. Your total daily expenditure is calculated holistically — not just from gym sessions.",
    detail: "Steps · Cardio · TDEE · Water · Expenditure"
  },
  {
    code: "AI",
    label: "AI Flight Control",
    blurb:
      "The AI coach reads all your data — weight trend, training load, nutrition, and activity — and tells you exactly what to adjust and why. Ask it anything. It knows your history.",
    detail: "Coach Adjustments · Q&A · Data-Driven Decisions"
  },
  {
    code: "PRG",
    label: "Progress Archives",
    blurb:
      "Check-ins, body measurements, and progress photos all stored together with your metrics. See exactly how far you've come with data and visuals side by side.",
    detail: "Check-ins · Photos · Measurements · Timeline"
  }
];

const STEPS = [
  {
    num: "01",
    code: "PREFLIGHT",
    label: "Set your parameters",
    blurb:
      "Tell us your starting weight, goal, training schedule, and dietary preferences. Takes 5 minutes. The system is calibrated to you before you log a single meal."
  },
  {
    num: "02",
    code: "ENGINES ON",
    label: "Start logging everything",
    blurb:
      "Track your food, training, weight, steps, and cardio each day. Every data point you log makes the AI's coaching more accurate. No data goes to waste."
  },
  {
    num: "03",
    code: "CRUISE",
    label: "Get coached by your data",
    blurb:
      "The AI analyses patterns across all your logs and suggests specific adjustments — drop 100 calories, add a cardio session, increase protein. Real coaching, driven by your real numbers."
  }
];

const REPLACES = [
  { app: "MyFitnessPal Premium", cost: "~£8/mo", what: "Food tracking" },
  { app: "Cronometer Gold", cost: "~£7/mo", what: "Micronutrient detail" },
  { app: "HappyScale / Libra", cost: "~£3/mo", what: "Weight trend tracking" },
  { app: "Online PT / Coach", cost: "£100–400/mo", what: "Coaching & adjustments" }
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function RingGauge({ value, max }) {
  const r = 34;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(1, value / max);
  const dash = circ * pct;
  return (
    <div style={{ position: "relative", width: 88, height: 88, flexShrink: 0 }}>
      <svg width="88" height="88" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
        <circle
          cx="44" cy="44" r={r} fill="none"
          stroke="var(--accent-3)"
          strokeWidth="6"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 44 44)"
          style={{ filter: "drop-shadow(0 0 6px var(--accent-2))", transition: "stroke-dasharray 1.4s ease" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1rem", lineHeight: 1, color: "var(--text-1)" }}>
          {Math.round(pct * 100)}%
        </span>
        <span style={{ fontFamily: "var(--font-display)", fontSize: "0.52rem", letterSpacing: "0.1em", color: "var(--text-3)", marginTop: 2 }}>CAL</span>
      </div>
    </div>
  );
}

function MacroBar({ label, val, unit, pct, color }) {
  return (
    <div style={{ marginBottom: "0.55rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: "0.6rem", letterSpacing: "0.1em", color: "var(--text-3)" }}>{label}</span>
        <span style={{ fontFamily: "var(--font-display)", fontSize: "0.65rem", color: "var(--text-2)" }}>{val}{unit}</span>
      </div>
      <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 2, boxShadow: `0 0 5px ${color}`, transition: "width 1.4s ease" }} />
      </div>
    </div>
  );
}

function ReadoutCell({ label, value, unit, blink }) {
  return (
    <div className="ld-readout">
      <div className="ld-readout-label">{label}</div>
      <div className="ld-readout-value">
        {blink && <span className="ld-blink-dot" style={{ marginRight: 4 }} />}
        {value}<span style={{ fontSize: "0.6rem", marginLeft: 2, color: "var(--text-3)" }}>{unit}</span>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CSS = `
  /* ── Root ── */
  .ld-root {
    width: 100%;
    min-height: 100vh;
    position: relative;
    color: var(--text-1);
    font-family: var(--font-body);
    overflow-x: hidden;
  }

  /* ── Scan-line overlay ── */
  .ld-root::before {
    content: "";
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    background: repeating-linear-gradient(
      0deg,
      rgba(0, 0, 0, 0) 0px,
      rgba(0, 0, 0, 0) 3px,
      rgba(0, 0, 0, 0.07) 4px
    );
  }

  /* ── Centered content container ── */
  .ld-inner {
    width: 100%;
    max-width: 1180px;
    margin: 0 auto;
    padding: 0 2rem;
    position: relative;
    z-index: 1;
  }

  /* ── Nav ── */
  .ld-nav {
    position: sticky;
    top: 0;
    z-index: 50;
    border-bottom: 1px solid rgba(165, 21, 21, 0.18);
    background: rgba(9, 5, 6, 0.88);
    backdrop-filter: blur(12px);
  }

  .ld-nav-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.9rem 2rem;
    max-width: 1180px;
    margin: 0 auto;
    gap: 1rem;
  }

  .ld-brand {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 1.05rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    display: flex;
    align-items: center;
    gap: 0.55rem;
    color: var(--text-1);
  }

  .ld-brand-indicator {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--accent-3);
    box-shadow: 0 0 8px var(--accent-2);
    animation: ldBlink 2s ease-in-out infinite;
  }

  .ld-nav-actions { display: flex; gap: 0.65rem; align-items: center; }

  /* ── Buttons ── */
  .ld-btn-ghost {
    padding: 0.52rem 1rem;
    background: transparent;
    border: 1px solid var(--line-1);
    color: var(--text-2);
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-family: var(--font-display);
    font-size: 0.8rem;
    letter-spacing: 0.06em;
    transition: border-color 0.18s, color 0.18s, box-shadow 0.18s;
  }
  .ld-btn-ghost:hover {
    border-color: var(--accent-2);
    color: var(--text-1);
    box-shadow: 0 0 12px rgba(165,21,21,0.22);
  }

  .ld-btn-primary {
    padding: 0.55rem 1.25rem;
    background: linear-gradient(135deg, var(--accent-2), var(--accent-1));
    border: 1px solid var(--accent-2);
    color: #fff;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-family: var(--font-display);
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    transition: box-shadow 0.2s, transform 0.15s;
    box-shadow: 0 0 16px rgba(165,21,21,0.32);
  }
  .ld-btn-primary:hover {
    box-shadow: 0 0 28px rgba(204,32,32,0.55), 0 8px 20px rgba(0,0,0,0.4);
    transform: translateY(-2px);
  }

  .ld-btn-primary-lg {
    padding: 0.85rem 2.2rem;
    font-size: 0.92rem;
  }

  .ld-btn-ghost-lg {
    padding: 0.85rem 2rem;
    font-size: 0.88rem;
  }

  /* ── Section layouts ── */
  .ld-section {
    padding: 5rem 0;
    position: relative;
    z-index: 1;
  }

  .ld-section-divider {
    border-top: 1px solid rgba(165, 21, 21, 0.1);
  }

  .ld-section-label {
    font-family: var(--font-display);
    font-size: 0.65rem;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--accent-3);
    margin-bottom: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .ld-section-label::before {
    content: "";
    display: inline-block;
    width: 20px;
    height: 1px;
    background: var(--accent-3);
    box-shadow: 0 0 6px var(--accent-2);
  }

  .ld-h2 {
    font-family: var(--font-display);
    font-size: clamp(1.6rem, 2.8vw, 2.4rem);
    font-weight: 700;
    margin: 0 0 1rem;
    line-height: 1.1;
    letter-spacing: 0.02em;
  }

  .ld-lead {
    font-size: 1.05rem;
    color: var(--text-2);
    line-height: 1.75;
    max-width: 62ch;
    margin: 0;
  }

  /* ── Hero ── */
  .ld-hero {
    padding: 5rem 0 4rem;
    position: relative;
    z-index: 1;
  }

  .ld-hero::after {
    content: "";
    position: absolute;
    top: -40%;
    left: 50%;
    transform: translateX(-50%);
    width: 900px;
    height: 600px;
    background: radial-gradient(ellipse, rgba(165,21,21,0.14) 0%, transparent 70%);
    pointer-events: none;
    z-index: 0;
  }

  .ld-hero-grid {
    display: grid;
    grid-template-columns: 1.1fr 0.9fr;
    gap: 3rem;
    align-items: center;
  }

  .ld-hero-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-family: var(--font-display);
    font-size: 0.65rem;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--accent-3);
    border: 1px solid rgba(165,21,21,0.3);
    border-radius: 99px;
    padding: 0.3rem 0.75rem;
    margin-bottom: 1.4rem;
  }

  .ld-hero-h1 {
    font-family: var(--font-display);
    font-size: clamp(2.2rem, 4vw, 3.6rem);
    font-weight: 700;
    line-height: 1.06;
    letter-spacing: 0.02em;
    margin: 0 0 1.25rem;
  }

  .ld-hero-h1 em {
    font-style: normal;
    color: var(--accent-3);
    text-shadow: 0 0 24px rgba(204,32,32,0.45);
  }

  .ld-hero-sub {
    font-size: 1.1rem;
    color: var(--text-2);
    line-height: 1.72;
    max-width: 56ch;
    margin: 0 0 1.8rem;
  }

  .ld-hero-ctas {
    display: flex;
    gap: 0.8rem;
    flex-wrap: wrap;
    align-items: center;
  }

  .ld-hero-fine {
    font-size: 0.78rem;
    color: var(--text-3);
    margin-top: 0.9rem;
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  /* ── Dashboard demo panel ── */
  .ld-cluster {
    border: 1px solid rgba(165,21,21,0.25);
    border-radius: var(--radius-lg);
    background: rgba(8, 3, 5, 0.92);
    overflow: hidden;
    box-shadow: 0 0 0 1px rgba(165,21,21,0.08), 0 24px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.02);
  }

  .ld-cluster-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.7rem 1rem;
    border-bottom: 1px solid rgba(165,21,21,0.15);
    background: rgba(165,21,21,0.04);
  }

  .ld-cluster-title {
    font-family: var(--font-display);
    font-size: 0.62rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--text-3);
  }

  .ld-cluster-status {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-family: var(--font-display);
    font-size: 0.6rem;
    letter-spacing: 0.12em;
    color: var(--ok);
  }

  .ld-cluster-body {
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .ld-cluster-row {
    display: flex;
    gap: 1rem;
    align-items: flex-start;
  }

  .ld-cluster-macros {
    flex: 1;
    min-width: 0;
  }

  .ld-cluster-macros-title {
    font-family: var(--font-display);
    font-size: 0.58rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-3);
    margin-bottom: 0.65rem;
  }

  .ld-weight-panel {
    border: 1px solid rgba(165,21,21,0.12);
    border-radius: var(--radius-sm);
    padding: 0.75rem;
    background: rgba(165,21,21,0.03);
  }

  .ld-weight-panel-top {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 0.5rem;
  }

  .ld-readout-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
  }

  .ld-readout {
    border: 1px solid rgba(165,21,21,0.12);
    border-radius: 6px;
    padding: 0.5rem 0.6rem;
    background: rgba(165,21,21,0.03);
  }

  .ld-readout-label {
    font-family: var(--font-display);
    font-size: 0.52rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-3);
    margin-bottom: 3px;
  }

  .ld-readout-value {
    font-family: var(--font-display);
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-1);
    display: flex;
    align-items: center;
  }

  .ld-ai-panel {
    border: 1px solid rgba(165,21,21,0.2);
    border-radius: var(--radius-sm);
    padding: 0.7rem 0.9rem;
    background: rgba(165,21,21,0.05);
  }

  .ld-ai-panel-label {
    font-family: var(--font-display);
    font-size: 0.55rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--accent-3);
    margin-bottom: 0.4rem;
  }

  .ld-ai-panel-msg {
    font-family: var(--font-display);
    font-size: 0.7rem;
    color: var(--text-2);
    line-height: 1.5;
    min-height: 2.2em;
  }

  /* ── Pitch / replace section ── */
  .ld-pitch-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
    align-items: center;
  }

  .ld-replace-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .ld-replace-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border: 1px solid var(--line-1);
    border-radius: var(--radius-sm);
    background: rgba(165,21,21,0.02);
  }

  .ld-replace-item-left { display: flex; flex-direction: column; gap: 0.15rem; }
  .ld-replace-app { font-size: 0.9rem; font-weight: 500; color: var(--text-2); }
  .ld-replace-what { font-size: 0.72rem; color: var(--text-3); }
  .ld-replace-cost { font-family: var(--font-display); font-size: 0.78rem; color: var(--bad); }

  .ld-vs-arrow {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    font-family: var(--font-display);
    font-size: 0.65rem;
    letter-spacing: 0.12em;
    color: var(--text-3);
    text-transform: uppercase;
    position: relative;
  }

  .ld-replace-card {
    border: 1px solid rgba(165,21,21,0.4);
    border-radius: var(--radius-lg);
    padding: 2rem;
    background: linear-gradient(135deg, rgba(122,13,13,0.12), rgba(9,5,6,0.9));
    box-shadow: 0 0 40px rgba(165,21,21,0.15), inset 0 1px 0 rgba(255,255,255,0.025);
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .ld-replace-card-label {
    font-family: var(--font-display);
    font-size: 0.6rem;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--accent-3);
  }

  .ld-replace-card-name {
    font-family: var(--font-display);
    font-size: 1.6rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--text-1);
    line-height: 1.1;
  }

  .ld-replace-check-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }

  .ld-replace-check-list li {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-size: 0.88rem;
    color: var(--text-2);
  }

  .ld-check-icon {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: rgba(165,21,21,0.18);
    border: 1px solid var(--accent-2);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 0.55rem;
    color: var(--accent-3);
  }

  /* ── Features ── */
  .ld-feature-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
  }

  .ld-feature-card {
    border: 1px solid var(--line-1);
    border-radius: var(--radius-md);
    padding: 1.5rem;
    background: rgba(8,3,5,0.6);
    cursor: default;
    transition: border-color 0.2s, box-shadow 0.2s, transform 0.18s;
    position: relative;
    overflow: hidden;
  }

  .ld-feature-card::before {
    content: "";
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(204,32,32,0), transparent);
    transition: background 0.3s;
  }

  .ld-feature-card:hover {
    border-color: var(--accent-2);
    box-shadow: 0 0 24px rgba(165,21,21,0.22), 0 12px 30px rgba(0,0,0,0.4);
    transform: translateY(-3px);
  }

  .ld-feature-card:hover::before {
    background: linear-gradient(90deg, transparent, rgba(204,32,32,0.6), transparent);
  }

  .ld-feature-code {
    font-family: var(--font-display);
    font-size: 0.58rem;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--accent-3);
    margin-bottom: 0.5rem;
  }

  .ld-feature-name {
    font-family: var(--font-display);
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-1);
    margin-bottom: 0.65rem;
    letter-spacing: 0.02em;
  }

  .ld-feature-blurb {
    font-size: 0.84rem;
    color: var(--text-2);
    line-height: 1.7;
    margin-bottom: 0.9rem;
  }

  .ld-feature-detail {
    font-family: var(--font-display);
    font-size: 0.6rem;
    letter-spacing: 0.1em;
    color: var(--text-3);
    border-top: 1px solid var(--line-1);
    padding-top: 0.65rem;
  }

  /* ── Steps ── */
  .ld-steps-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.5rem;
    position: relative;
  }

  .ld-steps-grid::before {
    content: "";
    position: absolute;
    top: 2rem;
    left: calc(16.6% + 0.75rem);
    right: calc(16.6% + 0.75rem);
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(165,21,21,0.4), rgba(165,21,21,0.4), transparent);
    pointer-events: none;
  }

  .ld-step {
    border: 1px solid var(--line-1);
    border-radius: var(--radius-md);
    padding: 1.5rem;
    background: rgba(8,3,5,0.5);
    position: relative;
  }

  .ld-step-num {
    font-family: var(--font-display);
    font-size: 2rem;
    font-weight: 700;
    color: rgba(165,21,21,0.22);
    line-height: 1;
    margin-bottom: 0.25rem;
  }

  .ld-step-code {
    font-family: var(--font-display);
    font-size: 0.58rem;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--accent-3);
    margin-bottom: 0.5rem;
  }

  .ld-step-label {
    font-family: var(--font-display);
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-1);
    margin-bottom: 0.6rem;
  }

  .ld-step-blurb {
    font-size: 0.84rem;
    color: var(--text-2);
    line-height: 1.7;
  }

  /* ── Pricing ── */
  .ld-pricing-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
    max-width: 760px;
  }

  .ld-price-card {
    border: 1px solid var(--line-1);
    border-radius: var(--radius-lg);
    padding: 2rem;
    background: rgba(8,3,5,0.7);
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .ld-price-card.is-featured {
    border-color: rgba(165,21,21,0.45);
    background: linear-gradient(160deg, rgba(122,13,13,0.14), rgba(8,3,5,0.85));
    box-shadow: 0 0 36px rgba(165,21,21,0.18), inset 0 1px 0 rgba(255,255,255,0.025);
  }

  .ld-price-tier {
    font-family: var(--font-display);
    font-size: 0.62rem;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--text-3);
  }

  .ld-price-card.is-featured .ld-price-tier { color: var(--accent-3); }

  .ld-price-amount {
    display: flex;
    align-items: baseline;
    gap: 0.3rem;
  }

  .ld-price-big {
    font-family: var(--font-display);
    font-size: 2.4rem;
    font-weight: 700;
    color: var(--text-1);
    line-height: 1;
  }

  .ld-price-small {
    font-size: 0.85rem;
    color: var(--text-3);
  }

  .ld-price-features {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex: 1;
  }

  .ld-price-features li {
    display: flex;
    align-items: flex-start;
    gap: 0.55rem;
    font-size: 0.88rem;
    color: var(--text-2);
  }

  .ld-price-check { color: var(--accent-3); flex-shrink: 0; font-size: 0.75rem; margin-top: 2px; }

  .ld-price-fine {
    font-size: 0.75rem;
    color: var(--text-3);
    text-align: center;
    margin-top: 0.5rem;
  }

  /* ── Final CTA ── */
  .ld-cta-banner {
    padding: 5rem 2rem;
    text-align: center;
    position: relative;
    border-top: 1px solid rgba(165,21,21,0.12);
    overflow: hidden;
  }

  .ld-cta-banner::before {
    content: "";
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 900px 500px at 50% 100%, rgba(165,21,21,0.1) 0%, transparent 70%);
    pointer-events: none;
  }

  .ld-cta-title {
    font-family: var(--font-display);
    font-size: clamp(1.8rem, 3.5vw, 3rem);
    font-weight: 700;
    letter-spacing: 0.04em;
    margin: 0 0 1rem;
    text-transform: uppercase;
  }

  /* ── Footer ── */
  .ld-footer {
    border-top: 1px solid rgba(165,21,21,0.1);
    padding: 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    max-width: 1180px;
    margin: 0 auto;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .ld-footer-brand {
    font-family: var(--font-display);
    font-size: 0.8rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-3);
  }

  .ld-footer-links {
    display: flex;
    gap: 1.5rem;
    flex-wrap: wrap;
  }

  .ld-footer-links span {
    font-size: 0.8rem;
    color: var(--text-3);
    cursor: default;
  }

  /* ── Blinking dot ── */
  .ld-blink-dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--ok);
    box-shadow: 0 0 6px var(--ok);
    animation: ldBlink 1.6s ease-in-out infinite;
  }

  /* ── Keyframes ── */
  @keyframes ldBlink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.15; }
  }

  @keyframes ldFadeUp {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .ld-anim-1 { animation: ldFadeUp 0.55s ease both; }
  .ld-anim-2 { animation: ldFadeUp 0.55s ease 0.1s both; }
  .ld-anim-3 { animation: ldFadeUp 0.55s ease 0.2s both; }

  @media (prefers-reduced-motion: reduce) {
    .ld-anim-1, .ld-anim-2, .ld-anim-3 { animation: none; }
    .ld-blink-dot, .ld-brand-indicator { animation: none; }
  }

  /* ── Responsive ── */
  @media (max-width: 900px) {
    .ld-hero-grid { grid-template-columns: 1fr; }
    .ld-feature-grid { grid-template-columns: 1fr 1fr; }
    .ld-steps-grid { grid-template-columns: 1fr; }
    .ld-steps-grid::before { display: none; }
    .ld-pitch-grid { grid-template-columns: 1fr; }
    .ld-pricing-grid { grid-template-columns: 1fr; max-width: 100%; }
    .ld-readout-grid { grid-template-columns: repeat(3, 1fr); }
    .ld-inner { padding: 0 1.25rem; }
    .ld-nav-inner { padding: 0.8rem 1.25rem; }
    .ld-section { padding: 3rem 0; }
  }

  @media (max-width: 580px) {
    /* Nav — prevent wrapping */
    .ld-brand {
      font-size: 0.82rem;
      letter-spacing: 0.1em;
      white-space: nowrap;
    }
    .ld-nav-login { display: none; }
    .ld-btn-primary { font-size: 0.72rem; padding: 0.48rem 0.85rem; }

    /* Hero */
    .ld-hero { padding: 2.25rem 0 2rem; }
    .ld-hero-h1 { font-size: 2rem; }
    .ld-hero-sub { font-size: 0.95rem; }
    .ld-hero-ctas { flex-direction: column; align-items: stretch; }
    .ld-btn-primary-lg, .ld-btn-ghost-lg { padding: 0.85rem 1.25rem; font-size: 0.85rem; text-align: center; }

    /* Dashboard cluster — compact on mobile */
    .ld-cluster-row { flex-direction: row; align-items: center; }
    .ld-cluster-body { gap: 0.75rem; }
    .ld-weight-panel { display: none; }

    /* Features — stay 2 columns */
    .ld-feature-grid { grid-template-columns: 1fr 1fr; gap: 0.65rem; }
    .ld-feature-card { padding: 1rem; }
    .ld-feature-blurb { display: none; }

    /* Steps — tighter */
    .ld-step { padding: 1rem; }

    /* Sections */
    .ld-section { padding: 2.25rem 0; }
    .ld-h2 { font-size: 1.5rem; }
    .ld-lead { font-size: 0.92rem; }

    /* Pricing — stack full width */
    .ld-price-card { padding: 1.5rem; }

    /* CTA */
    .ld-cta-banner { padding: 2.75rem 1.25rem; }
    .ld-cta-title { font-size: 1.6rem; }
  }
`;

// ─── Component ────────────────────────────────────────────────────────────────

function Landing() {
  const navigate = useNavigate();
  const [aiIdx, setAiIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setAiIdx(i => (i + 1) % AI_MSGS.length), 3800);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="ld-root">
      <style>{CSS}</style>

      {/* ── NAV ─────────────────────────────────────────────────────────── */}
      <nav className="ld-nav">
        <div className="ld-nav-inner">
          <div className="ld-brand">
            <span className="ld-brand-indicator" />
            Physique Pilot
          </div>
          <div className="ld-nav-actions">
            <button className="ld-btn-ghost ld-nav-login" onClick={() => navigate("/login")}>Log in</button>
            <button className="ld-btn-primary" onClick={() => navigate("/register")}>Start Free Trial</button>
          </div>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section className="ld-hero">
        <div className="ld-inner">
          <div className="ld-hero-grid">

            {/* Left — copy */}
            <div className="ld-anim-1">
              <div className="ld-hero-eyebrow">
                <span className="ld-blink-dot" />
                AI-Powered Bodybuilding System
              </div>

              <h1 className="ld-hero-h1">
                The app that acts as your<br />
                <em>personal bodybuilding coach.</em>
              </h1>

              <p className="ld-hero-sub">
                Track your food, training, weight, cardio, and steps — all in one place.
                PhysiquePilot analyses your data and tells you exactly what to adjust to
                reach your bodybuilding goals. No guesswork. No spreadsheets.
                No expensive coach required.
              </p>

              <div className="ld-hero-ctas">
                <button className="ld-btn-primary ld-btn-primary-lg" onClick={() => navigate("/register")}>
                  Start 1 Month Free
                </button>
                <button className="ld-btn-ghost ld-btn-ghost-lg" onClick={() => navigate("/login")}>
                  Log in
                </button>
              </div>

            </div>

            {/* Right — animated dashboard demo */}
            <div className="ld-anim-2">
              <div className="ld-cluster">
                {/* Topbar */}
                <div className="ld-cluster-topbar">
                  <span className="ld-cluster-title">Pilot Dashboard</span>
                  <span className="ld-cluster-status">
                    <span className="ld-blink-dot" />
                    System Active
                  </span>
                </div>

                <div className="ld-cluster-body">
                  {/* Calorie ring + macro bars */}
                  <div className="ld-cluster-row">
                    <RingGauge value={1842} max={2400} />
                    <div className="ld-cluster-macros">
                      <div className="ld-cluster-macros-title">Macros Today</div>
                      <MacroBar label="PROTEIN" val={156} unit="g" pct={82} color="var(--accent-3)" />
                      <MacroBar label="CARBS"   val={210} unit="g" pct={70} color="#4d8eff" />
                      <MacroBar label="FATS"    val={68}  unit="g" pct={68} color="#ffaa33" />
                    </div>
                  </div>

                  {/* Weight trend mini-chart */}
                  <div className="ld-weight-panel">
                    <div className="ld-weight-panel-top">
                      <span style={{ fontFamily: "var(--font-display)", fontSize: "0.58rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-3)" }}>
                        Weight Trend — 14 Days
                      </span>
                      <span style={{ fontFamily: "var(--font-display)", fontSize: "0.78rem", color: "var(--accent-3)" }}>−1.8 kg</span>
                    </div>
                    <div style={{ height: 52 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={WEIGHT_DATA}>
                          <Line
                            type="monotone" dataKey="v" dot={false}
                            stroke="var(--accent-3)" strokeWidth={2}
                            style={{ filter: "drop-shadow(0 0 4px var(--accent-2))" }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Small readouts */}
                  <div className="ld-readout-grid">
                    <ReadoutCell label="Steps" value="8,247" unit="today" />
                    <ReadoutCell label="Water" value="1.8" unit="L" />
                    <ReadoutCell label="Training" value="Day 4" unit="" blink />
                  </div>

                  {/* AI coach message */}
                  <div className="ld-ai-panel">
                    <div className="ld-ai-panel-label">AI Coach</div>
                    <div className="ld-ai-panel-msg" key={aiIdx} style={{ animation: "ldFadeUp 0.4s ease both" }}>
                      {AI_MSGS[aiIdx]}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── WHAT IT REPLACES ────────────────────────────────────────────── */}
      <section className="ld-section ld-section-divider ld-anim-3">
        <div className="ld-inner">
          <div className="ld-pitch-grid">

            <div>
              <div className="ld-section-label">The Problem</div>
              <h2 className="ld-h2">Stop paying for 4 different apps.</h2>
              <p className="ld-lead">
                Serious bodybuilders typically juggle a food tracker, a weight app,
                a coaching service, and a training log — each in a different app, with no
                connection between them. PhysiquePilot is all of that, unified, with an AI
                coach that joins the dots.
              </p>

              <ul className="ld-replace-list" style={{ marginTop: "1.5rem" }}>
                {REPLACES.map(r => (
                  <li key={r.app} className="ld-replace-item">
                    <div className="ld-replace-item-left">
                      <span className="ld-replace-app">{r.app}</span>
                      <span className="ld-replace-what">{r.what}</span>
                    </div>
                    <span className="ld-replace-cost">{r.cost}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="ld-replace-card">
                <div className="ld-replace-card-label">The Solution</div>
                <div className="ld-replace-card-name">Physique<br />Pilot</div>
                <p style={{ color: "var(--text-2)", fontSize: "0.9rem", lineHeight: 1.7, margin: 0 }}>
                  One flat monthly subscription. Every tool. An AI coach that learns
                  from all of it and tells you what to change.
                </p>
                <ul className="ld-replace-check-list">
                  {[
                    "Macro & micronutrient food tracking",
                    "Intelligent weight trend analysis",
                    "Structured training programs",
                    "Steps, cardio & water logging",
                    "AI coach powered by your real data",
                    "Progress check-ins & photo archive"
                  ].map(item => (
                    <li key={item}>
                      <span className="ld-check-icon">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <button className="ld-btn-primary" onClick={() => navigate("/register")} style={{ alignSelf: "flex-start", marginTop: "0.5rem" }}>
                  Start Free — 1 Month
                </button>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────────────────────────── */}
      <section className="ld-section ld-section-divider">
        <div className="ld-inner">
          <div className="ld-section-label">Your Cockpit</div>
          <h2 className="ld-h2">Six instruments. One system.</h2>
          <p className="ld-lead" style={{ marginBottom: "2.25rem" }}>
            Every feature is designed to work together. Your training data informs
            your nutrition targets. Your step count factors into your calorie needs.
            Your weight trend shapes your AI coach's recommendations. Nothing works in isolation.
          </p>

          <div className="ld-feature-grid">
            {FEATURES.map(f => (
              <div key={f.code} className="ld-feature-card">
                <div className="ld-feature-code">{f.code}</div>
                <div className="ld-feature-name">{f.label}</div>
                <p className="ld-feature-blurb">{f.blurb}</p>
                <div className="ld-feature-detail">{f.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────────────── */}
      <section className="ld-section ld-section-divider">
        <div className="ld-inner">
          <div className="ld-section-label">Mission Briefing</div>
          <h2 className="ld-h2">How it works.</h2>
          <p className="ld-lead" style={{ marginBottom: "2.5rem" }}>
            Getting started takes five minutes. After that, the more you log, the smarter the coaching gets.
          </p>

          <div className="ld-steps-grid">
            {STEPS.map(s => (
              <div key={s.num} className="ld-step">
                <div className="ld-step-num">{s.num}</div>
                <div className="ld-step-code">{s.code}</div>
                <div className="ld-step-label">{s.label}</div>
                <p className="ld-step-blurb">{s.blurb}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ─────────────────────────────────────────────────────── */}
      <section className="ld-section ld-section-divider">
        <div className="ld-inner">
          <div className="ld-section-label">Pricing</div>
          <h2 className="ld-h2">Simple. No surprises.</h2>
          <p className="ld-lead" style={{ marginBottom: "2.5rem" }}>
            One free month. One flat rate after that. No tiers, no upsells,
            no features locked behind a higher plan.
          </p>

          <div className="ld-pricing-grid">
            {/* Trial card */}
            <div className="ld-price-card is-featured">
              <div>
                <div className="ld-price-tier">Free Trial</div>
                <div className="ld-price-amount">
                  <span className="ld-price-big">£0</span>
                  <span className="ld-price-small">/ first month</span>
                </div>
              </div>
              <ul className="ld-price-features">
                {[
                  "Full access to every feature",
                  "AI coach from day one",
                  "All tracking tools included",
                  "Cancel anytime"
                ].map(f => (
                  <li key={f}><span className="ld-price-check">✓</span>{f}</li>
                ))}
              </ul>
              <button className="ld-btn-primary" onClick={() => navigate("/register")}>
                Start Free Now
              </button>
              <p className="ld-price-fine">No card needed. Cancellable anytime.</p>
            </div>

            {/* Pro card */}
            <div className="ld-price-card">
              <div>
                <div className="ld-price-tier">Pilot Pro</div>
                <div className="ld-price-amount">
                  <span className="ld-price-big">TBA</span>
                  <span className="ld-price-small">/ month</span>
                </div>
              </div>
              <ul className="ld-price-features">
                {[
                  "Everything in the free trial",
                  "Continued AI coaching",
                  "Full data history & trends",
                  "Priority feature updates"
                ].map(f => (
                  <li key={f}><span className="ld-price-check">✓</span>{f}</li>
                ))}
              </ul>
              <button className="ld-btn-ghost" onClick={() => navigate("/register")}>
                Start with Free Trial
              </button>
              <p className="ld-price-fine">Try free first — upgrade when ready.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ───────────────────────────────────────────────────── */}
      <div className="ld-cta-banner">
        <div className="ld-section-label" style={{ justifyContent: "center", marginBottom: "1.25rem" }}>
          Begin Your Mission
        </div>
        <h2 className="ld-cta-title">
          Your data is waiting.<br />Let the AI fly it.
        </h2>
        <p style={{ color: "var(--text-2)", maxWidth: "52ch", margin: "0 auto 2rem", fontSize: "1.05rem", lineHeight: 1.7 }}>
          Join PhysiquePilot free for a full month. Track everything.
          Get coached by real data. See the difference a connected system makes.
        </p>
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
          <button className="ld-btn-primary ld-btn-primary-lg" onClick={() => navigate("/register")}>
            Start 1 Month Free — No Card
          </button>
          <button className="ld-btn-ghost ld-btn-ghost-lg" onClick={() => navigate("/login")}>
            Already have an account
          </button>
        </div>
      </div>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer style={{ position: "relative", zIndex: 1 }}>
        <div className="ld-footer">
          <div className="ld-footer-brand">
            <span className="ld-brand-indicator" style={{ display: "inline-block", marginRight: "0.4rem" }} />
            Physique Pilot © {new Date().getFullYear()}
          </div>
          <div className="ld-footer-links">
            <span>Nutrition</span>
            <span>Training</span>
            <span>Weight</span>
            <span>AI Coach</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Landing;
