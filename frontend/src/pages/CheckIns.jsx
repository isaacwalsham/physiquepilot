import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import PhysiquePilotLoader from "../components/PhysiquePilotLoader";
import PageHeader from "../components/PageHeader";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const dayNameToIndex = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };

const formatISO = (d) => {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};

const addDays = (iso, n) => {
  const dt = new Date(`${iso}T00:00:00`);
  dt.setDate(dt.getDate() + n);
  return formatISO(dt);
};

const startOfCheckInWeek = (todayIso, checkInDayName) => {
  const target = dayNameToIndex[checkInDayName] ?? 1;
  const dt = new Date(`${todayIso}T00:00:00`);
  const diff = (dt.getDay() - target + 7) % 7;
  dt.setDate(dt.getDate() - diff);
  return formatISO(dt);
};

const round1 = (n) => Math.round(n * 10) / 10;

const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

const BACKEND = import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

const authFetch = async (path, opts = {}) => {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return fetch(`${BACKEND}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {})
    }
  });
};

// ─── Preset definitions ───────────────────────────────────────────────────────

const PRESETS = {
  standard: {
    label: "Standard",
    poses: ["Front Relaxed", "Back Relaxed"]
  },
  bodybuilding: {
    label: "Bodybuilding Poses",
    poses: [
      "Front Relaxed",
      "Front Double Bicep",
      "Quarter Turn",
      "Back Relaxed",
      "Back Double Bicep",
      "Rear Lat Spread",
      "Abs and Thighs",
      "Most Muscular"
    ]
  }
};

// ─── Rating config ────────────────────────────────────────────────────────────

const RATINGS = [
  { key: "hunger",        label: "Hunger",        desc: "1 = never hungry · 10 = always starving" },
  { key: "energy",        label: "Energy",         desc: "1 = exhausted · 10 = high energy all week" },
  { key: "performance",   label: "Performance",    desc: "1 = terrible sessions · 10 = personal bests" },
  { key: "recovery",      label: "Recovery",       desc: "1 = constantly sore · 10 = fully recovered daily" },
  { key: "adherence",     label: "Adherence",      desc: "1 = completely off plan · 10 = perfect compliance" },
  { key: "sleep_quality", label: "Sleep Quality",  desc: "1 = terrible sleep · 10 = slept perfectly" },
  { key: "mood",          label: "Mood",           desc: "1 = very low · 10 = great mood all week" },
  { key: "stress",        label: "Stress",         desc: "1 = no stress · 10 = extremely stressed" }
];

// ─── CSS ──────────────────────────────────────────────────────────────────────

const CSS = `
  .ci-page {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 1.1rem;
    font-family: var(--font-body);
  }

  /* ── Tabs ── */
  .ci-tab-bar {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  .ci-tab {
    font-family: var(--font-display);
    font-size: 0.72rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 0.42rem 1rem;
    border: 1px solid var(--line-1);
    background: transparent;
    color: var(--text-3);
    cursor: pointer;
    border-radius: var(--radius-sm);
    transition: all var(--motion-fast);
  }
  .ci-tab:hover { border-color: var(--line-2); color: var(--text-2); }
  .ci-tab.active {
    border-color: var(--accent-2);
    color: var(--accent-3);
    background: rgba(181,21,60,0.08);
    box-shadow: inset 0 0 12px rgba(181,21,60,0.1);
  }

  /* ── Week banner ── */
  .ci-week-banner {
    background: var(--surface-2);
    border: 1px solid var(--line-1);
    border-radius: var(--radius-md);
    padding: 0.75rem 1.1rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .ci-week-label {
    font-family: var(--font-display);
    font-size: 0.62rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--text-3);
  }
  .ci-week-range {
    font-family: var(--font-display);
    font-size: 0.82rem;
    letter-spacing: 0.06em;
    color: var(--text-1);
    font-weight: 600;
  }
  .ci-week-badge {
    font-family: var(--font-display);
    font-size: 0.62rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    padding: 0.28rem 0.7rem;
    border-radius: 99px;
    border: 1px solid var(--line-1);
    color: var(--text-3);
  }
  .ci-week-badge.submitted {
    border-color: var(--ok);
    color: var(--ok);
    box-shadow: 0 0 8px rgba(40,183,141,0.15);
  }

  /* ── Section header ── */
  .ci-section-head {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-bottom: 0.65rem;
  }
  .ci-section-bar {
    width: 3px;
    height: 14px;
    background: var(--accent-1);
    border-radius: 2px;
    flex-shrink: 0;
  }
  .ci-section-title {
    font-family: var(--font-display);
    font-size: 0.66rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--text-2);
    font-weight: 600;
  }

  /* ── Metric grid ── */
  .ci-metric-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.6rem;
  }
  @media (max-width: 900px) { .ci-metric-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 520px) { .ci-metric-grid { grid-template-columns: 1fr; } }

  .ci-metric-card {
    background: var(--surface-2);
    border: 1px solid var(--line-1);
    border-radius: var(--radius-sm);
    padding: 0.75rem 0.9rem;
    display: flex;
    flex-direction: column;
    gap: 0.22rem;
    position: relative;
    overflow: hidden;
    transition: border-color var(--motion-fast);
  }
  .ci-metric-card::before {
    content: "";
    position: absolute;
    top: 0; left: 0;
    width: 2px; height: 100%;
    background: var(--line-2);
  }
  .ci-metric-card.positive::before { background: var(--ok); }
  .ci-metric-card.negative::before { background: var(--bad); }
  .ci-metric-card.accent::before   { background: var(--accent-2); }

  .ci-metric-value {
    font-family: var(--font-display);
    font-size: 1.45rem;
    font-weight: 700;
    color: var(--text-1);
    line-height: 1;
    letter-spacing: 0.01em;
  }
  .ci-metric-value.dim { color: var(--text-3); font-size: 1.1rem; }
  .ci-metric-label {
    font-family: var(--font-display);
    font-size: 0.58rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-3);
    font-weight: 600;
  }
  .ci-metric-sub {
    font-size: 0.7rem;
    color: var(--text-3);
    margin-top: 0.08rem;
  }
  .ci-metric-sub.pos { color: var(--ok); }
  .ci-metric-sub.neg { color: var(--bad); }

  /* ── Ratings ── */
  .ci-ratings-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.7rem;
  }
  @media (max-width: 640px) { .ci-ratings-grid { grid-template-columns: 1fr; } }

  .ci-rating-item {
    background: var(--surface-2);
    border: 1px solid var(--line-1);
    border-radius: var(--radius-sm);
    padding: 0.75rem 0.9rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .ci-rating-name {
    font-family: var(--font-display);
    font-size: 0.66rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-2);
    font-weight: 600;
  }
  .ci-rating-desc {
    font-size: 0.68rem;
    color: var(--text-3);
    margin-top: -0.2rem;
  }
  .ci-rating-btns {
    display: flex;
    gap: 0.28rem;
    flex-wrap: wrap;
  }
  .ci-rbt {
    font-family: var(--font-display);
    font-size: 0.7rem;
    font-weight: 600;
    width: 30px; height: 30px;
    display: flex; align-items: center; justify-content: center;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-1);
    background: var(--surface-1);
    color: var(--text-3);
    cursor: pointer;
    transition: all var(--motion-fast);
    flex-shrink: 0;
  }
  .ci-rbt:hover { border-color: var(--line-2); color: var(--text-2); }
  .ci-rbt.low.active    { background: rgba(255,79,115,0.18); border-color: var(--bad);    color: var(--bad); }
  .ci-rbt.mid.active    { background: rgba(229,161,0,0.18);  border-color: var(--warn);   color: var(--warn); }
  .ci-rbt.high.active   { background: rgba(40,183,141,0.18); border-color: var(--ok);     color: var(--ok); }

  /* ── Notes ── */
  .ci-notes-wrap {
    background: var(--surface-2);
    border: 1px solid var(--line-1);
    border-radius: var(--radius-md);
    padding: 0.9rem 1.1rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .ci-notes-label {
    font-family: var(--font-display);
    font-size: 0.64rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--text-2);
    font-weight: 600;
  }
  .ci-notes-sub {
    font-size: 0.72rem;
    color: var(--text-3);
    margin-top: -0.2rem;
  }
  .ci-notes-ta {
    background: var(--surface-1);
    border: 1px solid var(--line-1);
    border-radius: var(--radius-sm);
    color: var(--text-1);
    font-family: var(--font-body);
    font-size: 0.9rem;
    padding: 0.75rem 0.9rem;
    resize: vertical;
    min-height: 100px;
    width: 100%;
    box-sizing: border-box;
    transition: border-color var(--motion-fast);
    outline: none;
  }
  .ci-notes-ta:focus { border-color: var(--accent-2); }

  /* ── Submit button ── */
  .ci-submit-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .ci-btn-primary {
    font-family: var(--font-display);
    font-size: 0.78rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 0.7rem 1.8rem;
    background: var(--accent-2);
    border: 1px solid var(--accent-3);
    border-radius: var(--radius-sm);
    color: #fff;
    cursor: pointer;
    transition: all var(--motion-fast);
    box-shadow: 0 0 18px rgba(181,21,60,0.28);
  }
  .ci-btn-primary:hover { background: var(--accent-3); box-shadow: 0 0 24px rgba(222,41,82,0.4); }
  .ci-btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }

  .ci-btn-ghost {
    font-family: var(--font-display);
    font-size: 0.72rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 0.58rem 1.2rem;
    background: transparent;
    border: 1px solid var(--line-1);
    border-radius: var(--radius-sm);
    color: var(--text-3);
    cursor: pointer;
    transition: all var(--motion-fast);
  }
  .ci-btn-ghost:hover { border-color: var(--line-2); color: var(--text-2); }
  .ci-btn-ghost:disabled { opacity: 0.4; cursor: not-allowed; }

  .ci-success-msg {
    font-size: 0.8rem;
    color: var(--ok);
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  /* ── Error ── */
  .ci-error {
    font-size: 0.85rem;
    color: var(--bad);
    padding: 0.65rem 0.9rem;
    border: 1px solid var(--bad);
    border-radius: var(--radius-sm);
    background: rgba(255,79,115,0.07);
  }

  /* ── Report tab ── */
  .ci-report-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .ci-report-row {
    background: var(--surface-2);
    border: 1px solid var(--line-1);
    border-radius: var(--radius-sm);
    padding: 0.75rem 1rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    cursor: pointer;
    transition: border-color var(--motion-fast), background var(--motion-fast);
  }
  .ci-report-row:hover { border-color: var(--line-2); background: var(--surface-3); }
  .ci-report-row.active { border-color: var(--accent-2); background: rgba(181,21,60,0.06); }

  .ci-report-week {
    font-family: var(--font-display);
    font-size: 0.72rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-1);
    font-weight: 600;
  }
  .ci-report-meta {
    font-size: 0.68rem;
    color: var(--text-3);
    margin-top: 0.2rem;
  }
  .ci-report-actions {
    display: flex;
    gap: 0.4rem;
    flex-shrink: 0;
  }
  .ci-report-btn {
    font-family: var(--font-display);
    font-size: 0.62rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 0.3rem 0.75rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-1);
    background: transparent;
    color: var(--text-3);
    cursor: pointer;
    transition: all var(--motion-fast);
  }
  .ci-report-btn:hover { border-color: var(--accent-2); color: var(--accent-3); }
  .ci-report-btn.email { border-color: var(--ok); color: var(--ok); }
  .ci-report-btn.email:hover { background: rgba(40,183,141,0.1); }

  .ci-report-preview {
    background: var(--surface-2);
    border: 1px solid var(--line-1);
    border-radius: var(--radius-md);
    padding: 1.4rem 1.6rem;
  }
  .ci-report-preview-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.2rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--line-1);
    flex-wrap: wrap;
  }
  .ci-report-title-block {}
  .ci-report-title {
    font-family: var(--font-display);
    font-size: 0.88rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--accent-3);
    font-weight: 700;
  }
  .ci-report-subtitle {
    font-size: 0.72rem;
    color: var(--text-3);
    margin-top: 0.3rem;
  }
  .ci-report-body {
    font-size: 0.9rem;
    line-height: 1.75;
    color: var(--text-2);
    white-space: pre-wrap;
  }

  .ci-empty-state {
    text-align: center;
    padding: 3rem 1rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }
  .ci-empty-icon {
    font-size: 2rem;
    opacity: 0.3;
  }
  .ci-empty-title {
    font-family: var(--font-display);
    font-size: 0.8rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-3);
    font-weight: 600;
  }
  .ci-empty-sub {
    font-size: 0.8rem;
    color: var(--text-3);
    max-width: 320px;
  }

  .ci-info-banner {
    background: rgba(181,21,60,0.06);
    border: 1px solid var(--line-2);
    border-radius: var(--radius-sm);
    padding: 0.7rem 1rem;
    font-size: 0.8rem;
    color: var(--text-3);
    line-height: 1.5;
  }
  .ci-info-banner strong { color: var(--text-2); }

  /* ── Photos tab ── */
  .ci-disclaimer {
    background: rgba(138,15,46,0.08);
    border: 1px solid var(--accent-1);
    border-radius: var(--radius-sm);
    padding: 0.8rem 1rem;
    display: flex;
    gap: 0.7rem;
    align-items: flex-start;
  }
  .ci-disclaimer-icon {
    font-size: 1rem;
    flex-shrink: 0;
    margin-top: 0.1rem;
    opacity: 0.7;
  }
  .ci-disclaimer-text {
    font-size: 0.78rem;
    color: var(--text-3);
    line-height: 1.55;
  }
  .ci-disclaimer-text strong { color: var(--text-2); }

  .ci-preset-pills {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
  }
  .ci-preset-pill {
    font-family: var(--font-display);
    font-size: 0.68rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 0.38rem 0.9rem;
    border: 1px solid var(--line-1);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-3);
    cursor: pointer;
    transition: all var(--motion-fast);
  }
  .ci-preset-pill:hover { border-color: var(--line-2); color: var(--text-2); }
  .ci-preset-pill.active {
    border-color: var(--accent-2);
    color: var(--accent-3);
    background: rgba(181,21,60,0.08);
  }

  .ci-pose-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.65rem;
  }
  @media (max-width: 900px) { .ci-pose-grid { grid-template-columns: repeat(3, 1fr); } }
  @media (max-width: 640px) { .ci-pose-grid { grid-template-columns: repeat(2, 1fr); } }

  .ci-pose-card {
    background: var(--surface-2);
    border: 1px solid var(--line-1);
    border-radius: var(--radius-sm);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transition: border-color var(--motion-fast);
    min-height: 180px;
  }
  .ci-pose-card:hover { border-color: var(--line-2); }
  .ci-pose-card.has-photo { border-color: var(--line-2); }

  .ci-pose-photo {
    flex: 1;
    position: relative;
    background: var(--surface-1);
    min-height: 140px;
    overflow: hidden;
  }
  .ci-pose-img {
    width: 100%; height: 100%;
    object-fit: cover;
    display: block;
  }
  .ci-pose-placeholder {
    width: 100%; height: 100%;
    min-height: 140px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    cursor: pointer;
    transition: background var(--motion-fast);
  }
  .ci-pose-placeholder:hover { background: var(--surface-2); }
  .ci-pose-placeholder-icon {
    font-size: 1.6rem;
    opacity: 0.2;
  }
  .ci-pose-placeholder-text {
    font-family: var(--font-display);
    font-size: 0.58rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-3);
  }

  .ci-pose-footer {
    padding: 0.45rem 0.6rem;
    background: var(--surface-2);
    border-top: 1px solid var(--line-1);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.4rem;
  }
  .ci-pose-name {
    font-family: var(--font-display);
    font-size: 0.58rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-2);
    font-weight: 600;
    line-height: 1.3;
    flex: 1;
  }
  .ci-pose-date {
    font-size: 0.62rem;
    color: var(--text-3);
  }
  .ci-pose-actions {
    display: flex;
    gap: 0.25rem;
    flex-shrink: 0;
  }
  .ci-pose-action-btn {
    width: 22px; height: 22px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 4px;
    border: 1px solid var(--line-1);
    background: transparent;
    color: var(--text-3);
    font-size: 0.7rem;
    cursor: pointer;
    transition: all var(--motion-fast);
  }
  .ci-pose-action-btn:hover { border-color: var(--line-2); color: var(--text-2); }
  .ci-pose-action-btn.del:hover { border-color: var(--bad); color: var(--bad); }

  /* hidden file input */
  .ci-file-input { display: none; }

  /* ── Photo Comparison ── */
  .ci-compare-section {
    background: var(--surface-2);
    border: 1px solid var(--line-1);
    border-radius: var(--radius-md);
    padding: 1rem 1.1rem;
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }
  .ci-compare-controls {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 0.75rem;
    align-items: end;
  }
  @media (max-width: 640px) { .ci-compare-controls { grid-template-columns: 1fr; } }

  .ci-compare-field {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .ci-compare-field-label {
    font-family: var(--font-display);
    font-size: 0.6rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-3);
    font-weight: 600;
  }
  .ci-compare-select {
    background: var(--surface-1);
    border: 1px solid var(--line-1);
    border-radius: var(--radius-sm);
    color: var(--text-1);
    font-family: var(--font-display);
    font-size: 0.75rem;
    padding: 0.5rem 0.7rem;
    outline: none;
    cursor: pointer;
    transition: border-color var(--motion-fast);
    width: 100%;
  }
  .ci-compare-select:focus { border-color: var(--accent-2); }

  .ci-compare-stage {
    position: relative;
    width: 100%;
    background: var(--surface-1);
    border: 1px solid var(--line-1);
    border-radius: var(--radius-sm);
    overflow: hidden;
    user-select: none;
  }
  .ci-compare-before {
    display: block;
    width: 100%;
    max-height: 520px;
    object-fit: contain;
  }
  .ci-compare-after {
    position: absolute;
    top: 0; left: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .ci-compare-line {
    position: absolute;
    top: 0; bottom: 0;
    width: 2px;
    background: var(--accent-3);
    box-shadow: 0 0 8px rgba(222,41,82,0.6);
    pointer-events: none;
    transform: translateX(-50%);
  }
  .ci-compare-handle {
    position: absolute;
    top: 50%; transform: translate(-50%,-50%);
    width: 32px; height: 32px;
    border-radius: 50%;
    background: var(--accent-3);
    box-shadow: 0 0 12px rgba(222,41,82,0.5), 0 2px 8px rgba(0,0,0,0.4);
    display: flex; align-items: center; justify-content: center;
    pointer-events: none;
    color: #fff;
    font-size: 0.7rem;
  }
  .ci-compare-slider-input {
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
    opacity: 0;
    cursor: ew-resize;
    margin: 0;
  }
  .ci-compare-labels {
    display: flex;
    justify-content: space-between;
    padding: 0.4rem 0.6rem;
    background: var(--surface-2);
    border-top: 1px solid var(--line-1);
  }
  .ci-compare-lbl {
    font-family: var(--font-display);
    font-size: 0.6rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-3);
  }
  .ci-compare-empty {
    padding: 3rem 1rem;
    text-align: center;
    color: var(--text-3);
    font-size: 0.82rem;
  }

  /* Photo modal */
  .ci-photo-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.88);
    backdrop-filter: blur(6px);
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
  }
  .ci-photo-modal {
    position: relative;
    max-width: 90vw;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }
  .ci-photo-modal-img {
    max-width: 100%;
    max-height: 80vh;
    object-fit: contain;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-2);
  }
  .ci-photo-modal-close {
    position: absolute;
    top: -14px; right: -14px;
    width: 30px; height: 30px;
    border-radius: 50%;
    background: var(--surface-3);
    border: 1px solid var(--line-2);
    color: var(--text-2);
    font-size: 0.9rem;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    transition: all var(--motion-fast);
  }
  .ci-photo-modal-close:hover { background: var(--bad); color: #fff; border-color: var(--bad); }

  /* ── Coach tab ── */
  .ci-coach-layout {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    height: calc(100vh - 200px);
    max-height: 700px;
    min-height: 400px;
  }
  .ci-coach-header {
    background: var(--surface-2);
    border: 1px solid var(--line-1);
    border-radius: var(--radius-md);
    padding: 0.85rem 1.1rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }
  .ci-coach-title-wrap {
    display: flex;
    align-items: center;
    gap: 0.7rem;
  }
  .ci-coach-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: var(--ok);
    box-shadow: 0 0 8px rgba(40,183,141,0.6);
    animation: pp-blink 2s ease-in-out infinite;
    flex-shrink: 0;
  }
  .ci-coach-name {
    font-family: var(--font-display);
    font-size: 0.82rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-1);
    font-weight: 700;
  }
  .ci-coach-sub {
    font-size: 0.7rem;
    color: var(--text-3);
  }
  .ci-coach-clear-btn {
    font-family: var(--font-display);
    font-size: 0.6rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 0.3rem 0.7rem;
    border: 1px solid var(--line-1);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-3);
    cursor: pointer;
    transition: all var(--motion-fast);
  }
  .ci-coach-clear-btn:hover { border-color: var(--bad); color: var(--bad); }

  .ci-coach-messages {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
    padding: 0.6rem;
    background: var(--surface-1);
    border: 1px solid var(--line-1);
    border-radius: var(--radius-md);
    scroll-behavior: smooth;
  }
  .ci-coach-messages::-webkit-scrollbar { width: 4px; }
  .ci-coach-messages::-webkit-scrollbar-track { background: transparent; }
  .ci-coach-messages::-webkit-scrollbar-thumb { background: var(--line-2); border-radius: 2px; }

  .ci-msg {
    display: flex;
    gap: 0.6rem;
    align-items: flex-end;
    max-width: 85%;
  }
  .ci-msg.user { align-self: flex-end; flex-direction: row-reverse; }
  .ci-msg.assistant { align-self: flex-start; }

  .ci-msg-avatar {
    width: 28px; height: 28px;
    border-radius: 50%;
    flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-family: var(--font-display);
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.05em;
  }
  .ci-msg.user .ci-msg-avatar { background: var(--accent-2); color: #fff; }
  .ci-msg.assistant .ci-msg-avatar { background: var(--surface-3); border: 1px solid var(--line-2); color: var(--accent-3); font-size: 0.55rem; }

  .ci-msg-bubble {
    padding: 0.65rem 0.85rem;
    border-radius: var(--radius-sm);
    font-size: 0.88rem;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .ci-msg.user .ci-msg-bubble {
    background: var(--accent-2);
    color: #fff;
    border-bottom-right-radius: 3px;
  }
  .ci-msg.assistant .ci-msg-bubble {
    background: var(--surface-3);
    border: 1px solid var(--line-1);
    color: var(--text-1);
    border-bottom-left-radius: 3px;
  }

  .ci-coach-typing {
    align-self: flex-start;
    display: flex;
    gap: 0.5rem;
    align-items: center;
    padding: 0 0.6rem;
  }
  .ci-typing-dots {
    display: flex;
    gap: 3px;
  }
  .ci-typing-dots span {
    width: 5px; height: 5px;
    border-radius: 50%;
    background: var(--accent-2);
    animation: ci-bounce 1.1s ease-in-out infinite;
  }
  .ci-typing-dots span:nth-child(2) { animation-delay: 0.2s; }
  .ci-typing-dots span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes ci-bounce {
    0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
    30% { transform: translateY(-5px); opacity: 1; }
  }

  .ci-coach-input-row {
    display: flex;
    gap: 0.5rem;
    align-items: flex-end;
  }
  .ci-coach-input {
    flex: 1;
    background: var(--surface-2);
    border: 1px solid var(--line-1);
    border-radius: var(--radius-sm);
    color: var(--text-1);
    font-family: var(--font-body);
    font-size: 0.9rem;
    padding: 0.65rem 0.9rem;
    resize: none;
    min-height: 44px;
    max-height: 120px;
    outline: none;
    transition: border-color var(--motion-fast);
    line-height: 1.5;
  }
  .ci-coach-input:focus { border-color: var(--accent-2); }
  .ci-coach-input::placeholder { color: var(--text-3); }

  .ci-coach-send-btn {
    width: 44px; height: 44px;
    border-radius: var(--radius-sm);
    background: var(--accent-2);
    border: 1px solid var(--accent-3);
    color: #fff;
    font-size: 1rem;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    transition: all var(--motion-fast);
    box-shadow: 0 0 12px rgba(181,21,60,0.3);
  }
  .ci-coach-send-btn:hover { background: var(--accent-3); }
  .ci-coach-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .ci-coach-disclaimer {
    font-size: 0.68rem;
    color: var(--text-3);
    text-align: center;
    line-height: 1.5;
  }

  .ci-coach-welcome {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    flex: 1;
    padding: 2rem;
    text-align: center;
  }
  .ci-coach-welcome-icon {
    font-size: 2.2rem;
    opacity: 0.25;
  }
  .ci-coach-welcome-title {
    font-family: var(--font-display);
    font-size: 0.82rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--text-2);
    font-weight: 600;
  }
  .ci-coach-welcome-sub {
    font-size: 0.8rem;
    color: var(--text-3);
    max-width: 320px;
  }
`;

// ─── PhotoCompare subcomponent ────────────────────────────────────────────────

function PhotoCompare({ photos }) {
  const [pose, setPose]       = useState(PRESETS.standard.poses[0]);
  const [beforeDate, setBeforeDate] = useState("");
  const [afterDate, setAfterDate]   = useState("");
  const [sliderVal, setSliderVal]   = useState(50);
  const [beforeUrl, setBeforeUrl]   = useState(null);
  const [afterUrl, setAfterUrl]     = useState(null);
  const [loading, setLoading]       = useState(false);

  // Unique dates that have photos for a given pose
  const poseDates = useMemo(() => {
    const seen = new Set();
    return (photos || [])
      .filter(p => p.pose_name === pose)
      .map(p => p.taken_on)
      .filter(d => { if (seen.has(d)) return false; seen.add(d); return true; })
      .sort((a, b) => (a < b ? 1 : -1));
  }, [photos, pose]);

  // All pose names that exist in photos
  const availablePoses = useMemo(() => {
    const s = new Set();
    (photos || []).forEach(p => { if (p.pose_name) s.add(p.pose_name); });
    return [...s];
  }, [photos]);

  const getSignedUrl = async (imagePath) => {
    const { data } = await supabase.storage
      .from("progress-photos")
      .createSignedUrl(imagePath, 600);
    return data?.signedUrl || null;
  };

  const loadImages = useCallback(async () => {
    if (!beforeDate || !afterDate) { setBeforeUrl(null); setAfterUrl(null); return; }
    setLoading(true);
    const bf = photos.find(p => p.pose_name === pose && p.taken_on === beforeDate);
    const af = photos.find(p => p.pose_name === pose && p.taken_on === afterDate);
    const [bu, au] = await Promise.all([
      bf ? getSignedUrl(bf.image_path) : Promise.resolve(null),
      af ? getSignedUrl(af.image_path) : Promise.resolve(null)
    ]);
    setBeforeUrl(bu);
    setAfterUrl(au);
    setLoading(false);
  }, [beforeDate, afterDate, pose, photos]);

  useEffect(() => { loadImages(); }, [loadImages]);

  const allPoses = useMemo(() => {
    const combined = new Set([
      ...PRESETS.standard.poses,
      ...PRESETS.bodybuilding.poses,
      ...availablePoses
    ]);
    return [...combined];
  }, [availablePoses]);

  return (
    <div className="ci-compare-section">
      <div className="ci-section-head">
        <div className="ci-section-bar" />
        <span className="ci-section-title">Photo Comparison</span>
      </div>
      <div className="ci-compare-controls">
        <div className="ci-compare-field">
          <div className="ci-compare-field-label">Pose</div>
          <select className="ci-compare-select" value={pose} onChange={e => { setPose(e.target.value); setBeforeDate(""); setAfterDate(""); }}>
            {allPoses.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="ci-compare-field">
          <div className="ci-compare-field-label">Before (older)</div>
          <select className="ci-compare-select" value={beforeDate} onChange={e => setBeforeDate(e.target.value)}>
            <option value="">— select date —</option>
            {poseDates.map(d => <option key={d} value={d}>{fmtDate(d)}</option>)}
          </select>
        </div>
        <div className="ci-compare-field">
          <div className="ci-compare-field-label">After (newer)</div>
          <select className="ci-compare-select" value={afterDate} onChange={e => setAfterDate(e.target.value)}>
            <option value="">— select date —</option>
            {poseDates.map(d => <option key={d} value={d}>{fmtDate(d)}</option>)}
          </select>
        </div>
      </div>

      {loading && (
        <div className="ci-compare-empty">Loading images…</div>
      )}

      {!loading && (!beforeUrl || !afterUrl) && (
        <div className="ci-compare-empty">
          {poseDates.length < 2
            ? "Upload at least 2 photos of the same pose on different dates to compare."
            : "Select two dates above to compare your progress."}
        </div>
      )}

      {!loading && beforeUrl && afterUrl && (
        <div>
          <div className="ci-compare-stage">
            <img src={beforeUrl} className="ci-compare-before" alt="Before" draggable={false} />
            <img
              src={afterUrl}
              className="ci-compare-after"
              alt="After"
              style={{ clipPath: `inset(0 ${100 - sliderVal}% 0 0)` }}
              draggable={false}
            />
            <div className="ci-compare-line" style={{ left: `${sliderVal}%` }} />
            <div className="ci-compare-handle" style={{ left: `${sliderVal}%` }}>⇔</div>
            <input
              type="range"
              min={0} max={100}
              value={sliderVal}
              onChange={e => setSliderVal(Number(e.target.value))}
              className="ci-compare-slider-input"
            />
          </div>
          <div className="ci-compare-labels">
            <span className="ci-compare-lbl">◀ After — {fmtDate(afterDate)}</span>
            <span className="ci-compare-lbl">Before — {fmtDate(beforeDate)} ▶</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CheckIns() {
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState("week");
  const [error, setError]           = useState("");
  const [submitOk, setSubmitOk]     = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Identity + week
  const [userId, setUserId]       = useState(null);
  const [checkInDay, setCheckInDay] = useState("Monday");
  const [weekStart, setWeekStart] = useState("");
  const [weekEnd, setWeekEnd]     = useState("");

  // Metrics
  const [metrics, setMetrics] = useState({
    avgWeightKg: null, weightChangeKg: null,
    avgCalories: null, avgProteinG: null, avgCarbsG: null, avgFatG: null,
    trainingCompleted: 0, avgSteps: 0, cardioSessions: 0
  });

  // Form
  const defaultForm = { hunger: 5, energy: 5, performance: 5, recovery: 5, adherence: 5, sleep_quality: 5, mood: 5, stress: 5, notes: "" };
  const [form, setForm]                     = useState(defaultForm);
  const [existingThisWeek, setExistingThisWeek] = useState(null);

  // Photos
  const [photos, setPhotos]             = useState([]);
  const [activePreset, setActivePreset] = useState("standard");
  const [photoModal, setPhotoModal]     = useState(null); // { url, pose, date }
  const [uploadingPose, setUploadingPose] = useState(null);
  const fileInputRefs = useRef({});

  // Reports
  const [reports, setReports]               = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [emailingReport, setEmailingReport]     = useState(null);

  // Coach
  const [messages, setMessages]   = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending]     = useState(false);
  const messagesEndRef             = useRef(null);

  const todayIso = useMemo(() => formatISO(new Date()), []);

  // ── Load all data ────────────────────────────────────────────────────────────

  const loadPhotos = useCallback(async (uid) => {
    const { data } = await supabase
      .from("progress_photos")
      .select("id, taken_on, image_path, caption, pose_preset, pose_name, created_at")
      .eq("user_id", uid)
      .order("taken_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200);
    setPhotos(data || []);
  }, []);

  const loadReports = useCallback(async () => {
    const r = await authFetch("/api/checkins/reports");
    if (r.ok) {
      const d = await r.json();
      setReports(d.reports || []);
      if (d.reports?.length && !selectedReport) setSelectedReport(d.reports[0]);
    }
  }, [selectedReport]);

  const loadCoachHistory = useCallback(async () => {
    const r = await authFetch("/api/coach/history?limit=50");
    if (r.ok) {
      const d = await r.json();
      setMessages(d.messages || []);
    }
  }, []);

  const computeMacrosAvg = async (uid, ws, we) => {
    const { data } = await supabase
      .from("daily_nutrition")
      .select("log_date, calories, protein_g, carbs_g, fat_g")
      .eq("user_id", uid)
      .gte("log_date", ws)
      .lte("log_date", we);
    if (!data?.length) return { avgCalories: null, avgProteinG: null, avgCarbsG: null, avgFatG: null };
    const valid = data.filter(r => Number(r.calories) > 0);
    const n = valid.length || 1;
    const sum = (key) => valid.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
    return {
      avgCalories: Math.round(sum("calories") / n) || null,
      avgProteinG: Math.round(sum("protein_g") / n) || null,
      avgCarbsG:   Math.round(sum("carbs_g")   / n) || null,
      avgFatG:     Math.round(sum("fat_g")      / n) || null
    };
  };

  const computeWeightMetrics = async (uid, ws, we) => {
    const { data: logs } = await supabase.from("weight_logs").select("weight_kg").eq("user_id", uid).gte("log_date", ws).lte("log_date", we);
    const arr = (logs || []).map(l => Number(l.weight_kg)).filter(isFinite);
    const avg = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    const { data: prev } = await supabase.from("weight_logs").select("weight_kg").eq("user_id", uid).gte("log_date", addDays(ws, -7)).lte("log_date", addDays(ws, -1));
    const prevArr = (prev || []).map(l => Number(l.weight_kg)).filter(isFinite);
    const prevAvg = prevArr.length ? prevArr.reduce((a, b) => a + b, 0) / prevArr.length : null;
    return { avgWeightKg: avg !== null ? round1(avg) : null, weightChangeKg: avg !== null && prevAvg !== null ? round1(avg - prevAvg) : null };
  };

  const computeTraining = async (uid, ws, we) => {
    const { data } = await supabase.from("workout_sessions").select("id").eq("user_id", uid).gte("session_date", ws).lte("session_date", we).not("completed_at", "is", null);
    return { completed: (data || []).length };
  };

  const computeSteps = async (uid, ws, we) => {
    const { data } = await supabase.from("steps_logs").select("steps").eq("user_id", uid).gte("log_date", ws).lte("log_date", we);
    const arr = (data || []).map(r => Number(r.steps)).filter(n => isFinite(n) && n >= 0);
    return { avgSteps: arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0 };
  };

  const computeCardio = async (uid, ws, we) => {
    const { data } = await supabase.from("cardio_logs").select("id").eq("user_id", uid).gte("log_date", ws).lte("log_date", we);
    return { count: (data || []).length };
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      const { data: sessionR } = await supabase.auth.getSession();
      const user = sessionR?.session?.user;
      if (!user) { setError("Not logged in."); setLoading(false); return; }
      setUserId(user.id);

      const { data: profile } = await supabase.from("profiles").select("check_in_day").eq("user_id", user.id).maybeSingle();
      const cid = profile?.check_in_day || "Monday";
      setCheckInDay(cid);
      const ws = startOfCheckInWeek(todayIso, cid);
      const we = addDays(ws, 6);
      setWeekStart(ws);
      setWeekEnd(we);

      const { data: existing } = await supabase.from("weekly_check_ins").select("*").eq("user_id", user.id).eq("week_start", ws).maybeSingle();

      if (existing) {
        setExistingThisWeek(existing);
        setForm({
          hunger:        existing.hunger_rating        ?? 5,
          energy:        existing.energy_rating        ?? 5,
          performance:   existing.performance_rating   ?? 5,
          recovery:      existing.recovery_rating      ?? 5,
          adherence:     existing.adherence_rating     ?? 5,
          sleep_quality: existing.sleep_quality_rating ?? 5,
          mood:          existing.mood_rating          ?? 5,
          stress:        existing.stress_rating        ?? 5,
          notes:         existing.notes               || ""
        });
        setMetrics({
          avgWeightKg:      existing.avg_weight_kg          ?? null,
          weightChangeKg:   existing.weight_change_kg       ?? null,
          avgCalories:      existing.avg_calories           ?? null,
          avgProteinG:      existing.avg_protein_g          ?? null,
          avgCarbsG:        existing.avg_carbs_g            ?? null,
          avgFatG:          existing.avg_fat_g              ?? null,
          trainingCompleted: existing.training_sessions_completed ?? 0,
          avgSteps:         existing.avg_steps              ?? 0,
          cardioSessions:   existing.cardio_sessions        ?? 0
        });
      } else {
        const [weight, macros, training, steps, cardio] = await Promise.all([
          computeWeightMetrics(user.id, ws, we),
          computeMacrosAvg(user.id, ws, we),
          computeTraining(user.id, ws, we),
          computeSteps(user.id, ws, we),
          computeCardio(user.id, ws, we)
        ]);
        setMetrics({
          avgWeightKg:      weight.avgWeightKg,
          weightChangeKg:   weight.weightChangeKg,
          avgCalories:      macros.avgCalories,
          avgProteinG:      macros.avgProteinG,
          avgCarbsG:        macros.avgCarbsG,
          avgFatG:          macros.avgFatG,
          trainingCompleted: training.completed,
          avgSteps:         steps.avgSteps,
          cardioSessions:   cardio.count
        });
      }

      await Promise.all([
        loadPhotos(user.id),
        loadReports(),
        loadCoachHistory()
      ]);

      setLoading(false);
    };
    load();
  }, [todayIso, loadPhotos]);

  // ── Submit check-in ──────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!userId || !weekStart || !weekEnd) return;
    setSubmitting(true);
    setError("");
    setSubmitOk(false);

    const payload = {
      user_id: userId, week_start: weekStart, week_end: weekEnd,
      avg_weight_kg:             metrics.avgWeightKg,
      weight_change_kg:          metrics.weightChangeKg,
      avg_calories:              metrics.avgCalories,
      avg_protein_g:             metrics.avgProteinG,
      avg_carbs_g:               metrics.avgCarbsG,
      avg_fat_g:                 metrics.avgFatG,
      training_sessions_completed: metrics.trainingCompleted,
      avg_steps:                 metrics.avgSteps,
      cardio_sessions:           metrics.cardioSessions,
      hunger_rating:        Number(form.hunger),
      energy_rating:        Number(form.energy),
      performance_rating:   Number(form.performance),
      recovery_rating:      Number(form.recovery),
      adherence_rating:     Number(form.adherence),
      sleep_quality_rating: Number(form.sleep_quality),
      mood_rating:          Number(form.mood),
      stress_rating:        Number(form.stress),
      notes: form.notes || ""
    };

    const { error: upsertErr } = await supabase
      .from("weekly_check_ins")
      .upsert(payload, { onConflict: "user_id,week_start" });

    if (upsertErr) { setError(upsertErr.message); setSubmitting(false); return; }

    setExistingThisWeek(payload);
    setSubmitOk(true);
    setSubmitting(false);
  };

  // ── Photos ───────────────────────────────────────────────────────────────────

  const handlePoseUpload = async (file, presetKey, poseName) => {
    if (!userId || !file) return;
    setUploadingPose(`${presetKey}:${poseName}`);
    setError("");

    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
    const taken = formatISO(new Date());
    const filename = `${crypto.randomUUID()}.${safeExt}`;
    const path = `${userId}/${taken}/${filename}`;

    const { error: upErr } = await supabase.storage.from("progress-photos")
      .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type || "image/jpeg" });
    if (upErr) { setError(upErr.message); setUploadingPose(null); return; }

    const { error: rowErr } = await supabase.from("progress_photos")
      .insert({ user_id: userId, taken_on: taken, image_path: path, pose_preset: presetKey, pose_name: poseName });
    if (rowErr) { setError(rowErr.message); setUploadingPose(null); return; }

    setUploadingPose(null);
    await loadPhotos(userId);
  };

  const deletePhoto = async (photo) => {
    if (!userId) return;
    await supabase.from("progress_photos").delete().eq("id", photo.id).eq("user_id", userId);
    await supabase.storage.from("progress-photos").remove([photo.image_path]);
    await loadPhotos(userId);
  };

  const openPhotoModal = async (photo) => {
    const { data } = await supabase.storage.from("progress-photos").createSignedUrl(photo.image_path, 600);
    if (data?.signedUrl) setPhotoModal({ url: data.signedUrl, pose: photo.pose_name, date: photo.taken_on });
  };

  // Latest photo per pose for the active preset
  const latestPhotoByPose = useMemo(() => {
    const map = {};
    const preset = PRESETS[activePreset];
    for (const poseName of preset.poses) {
      const match = photos.find(p => p.pose_name === poseName);
      if (match) map[poseName] = match;
    }
    return map;
  }, [photos, activePreset]);

  // ── Reports ──────────────────────────────────────────────────────────────────

  const handleGenerateReport = async () => {
    if (!weekStart || !weekEnd) return;
    setGeneratingReport(true);
    setError("");
    const r = await authFetch("/api/checkins/generate-report", {
      method: "POST",
      body: JSON.stringify({ week_start: weekStart, week_end: weekEnd })
    });
    const d = await r.json();
    if (!r.ok || !d.ok) { setError(d.error || "Failed to generate report"); setGeneratingReport(false); return; }
    await loadReports();
    setSelectedReport(d.report);
    setTab("report");
    setGeneratingReport(false);
  };

  const handleDownloadPDF = (reportId) => {
    authFetch(`/api/checkins/reports/${reportId}/pdf`, { headers: {} }).then(async r => {
      if (!r.ok) return;
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `physique-pilot-report-${selectedReport?.week_start || reportId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  const handleSendEmail = async (reportId) => {
    setEmailingReport(reportId);
    const r = await authFetch(`/api/checkins/reports/${reportId}/send-email`, { method: "POST" });
    const d = await r.json();
    if (!r.ok || !d.ok) setError(d.error || "Failed to send email");
    else await loadReports();
    setEmailingReport(null);
  };

  // ── Coach chat ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (tab === "coach") {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [tab, messages]);

  const sendMessage = async () => {
    const text = chatInput.trim();
    if (!text || sending) return;
    setChatInput("");
    setSending(true);
    setMessages(prev => [...prev, { role: "user", content: text, created_at: new Date().toISOString() }]);

    const r = await authFetch("/api/coach/chat", {
      method: "POST",
      body: JSON.stringify({ message: text })
    });
    const d = await r.json();
    if (r.ok && d.ok) {
      setMessages(prev => [...prev, { role: "assistant", content: d.reply, created_at: new Date().toISOString() }]);
    } else {
      setMessages(prev => [...prev, { role: "assistant", content: `Sorry, I encountered an error: ${d.error || "Unknown error"}`, created_at: new Date().toISOString() }]);
    }
    setSending(false);
  };

  const clearHistory = async () => {
    if (!window.confirm("Clear your entire conversation history with The Physique Pilot?")) return;
    await authFetch("/api/coach/history", { method: "DELETE" });
    setMessages([]);
  };

  const handleChatKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) return <PhysiquePilotLoader />;

  const preset = PRESETS[activePreset];
  const getRatingClass = (n) => n <= 3 ? "low" : n <= 6 ? "mid" : "high";

  const weightChangeColor = metrics.weightChangeKg === null ? "" : metrics.weightChangeKg > 0 ? "positive" : "negative";

  const metricCards = [
    { label: "Avg Weight", value: metrics.avgWeightKg !== null ? `${metrics.avgWeightKg} kg` : "—", sub: metrics.weightChangeKg !== null ? `${metrics.weightChangeKg > 0 ? "+" : ""}${metrics.weightChangeKg} kg vs last week` : null, subClass: weightChangeColor, accent: "accent" },
    { label: "Avg Calories", value: metrics.avgCalories !== null ? `${metrics.avgCalories}` : "—", sub: "kcal / day", accent: "" },
    { label: "Avg Protein", value: metrics.avgProteinG !== null ? `${metrics.avgProteinG}g` : "—", sub: "per day", accent: "" },
    { label: "Avg Carbs", value: metrics.avgCarbsG !== null ? `${metrics.avgCarbsG}g` : "—", sub: "per day", accent: "" },
    { label: "Avg Fat", value: metrics.avgFatG !== null ? `${metrics.avgFatG}g` : "—", sub: "per day", accent: "" },
    { label: "Training Sessions", value: metrics.trainingCompleted, sub: "completed this week", accent: metrics.trainingCompleted > 0 ? "positive" : "" },
    { label: "Avg Daily Steps", value: metrics.avgSteps > 0 ? metrics.avgSteps.toLocaleString() : "—", sub: "steps / day", accent: "" },
    { label: "Cardio Sessions", value: metrics.cardioSessions, sub: "this week", accent: metrics.cardioSessions > 0 ? "positive" : "" }
  ];

  return (
    <>
      <style>{CSS}</style>
      <div className="ci-page">
        <PageHeader
          title="Check-Ins"
          right={
            <div className="ci-tab-bar">
              {[
                { key: "week",   label: "This Week" },
                { key: "report", label: "Report" },
                { key: "photos", label: "Progress Photos" }
              ].map(t => (
                <button
                  key={t.key}
                  className={`ci-tab${tab === t.key ? " active" : ""}`}
                  onClick={() => setTab(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          }
        />

        {error && <div className="ci-error">{error}</div>}

        {/* ── THIS WEEK ── */}
        {tab === "week" && (
          <>
            <div className="ci-week-banner">
              <div>
                <div className="ci-week-label">Current Check-in Week</div>
                <div className="ci-week-range">{fmtDate(weekStart)} — {fmtDate(weekEnd)}</div>
                <div style={{ fontSize: "0.7rem", color: "var(--text-3)", marginTop: "0.2rem" }}>
                  Check-in day: {checkInDay} · Change in Settings
                </div>
              </div>
              <div className={`ci-week-badge${existingThisWeek ? " submitted" : ""}`}>
                {existingThisWeek ? "✓ Submitted" : "Pending"}
              </div>
            </div>

            {/* Tracked metrics */}
            <div>
              <div className="ci-section-head">
                <div className="ci-section-bar" />
                <span className="ci-section-title">Tracked This Week</span>
              </div>
              <div className="ci-metric-grid">
                {metricCards.map(card => (
                  <div key={card.label} className={`ci-metric-card ${card.accent}`}>
                    <div className={`ci-metric-value${!card.value || card.value === "—" ? " dim" : ""}`}>
                      {card.value || "—"}
                    </div>
                    <div className="ci-metric-label">{card.label}</div>
                    {card.sub && (
                      <div className={`ci-metric-sub ${card.subClass || ""}`}>{card.sub}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Subjective ratings */}
            <div>
              <div className="ci-section-head">
                <div className="ci-section-bar" />
                <span className="ci-section-title">Rate Your Week</span>
              </div>
              <div className="ci-ratings-grid">
                {RATINGS.map(r => (
                  <div key={r.key} className="ci-rating-item">
                    <div>
                      <div className="ci-rating-name">{r.label}</div>
                      <div className="ci-rating-desc">{r.desc}</div>
                    </div>
                    <div className="ci-rating-btns">
                      {[1,2,3,4,5,6,7,8,9,10].map(n => {
                        const cls = getRatingClass(n);
                        const isActive = form[r.key] === n;
                        return (
                          <button
                            key={n}
                            className={`ci-rbt ${cls}${isActive ? " active" : ""}`}
                            onClick={() => setForm(f => ({ ...f, [r.key]: n }))}
                          >
                            {n}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="ci-notes-wrap">
              <div>
                <div className="ci-notes-label">Notes for Your AI Coach</div>
                <div className="ci-notes-sub">Share anything your data doesn't capture — how you felt, what was hard, lifestyle context. The Physique Pilot reads this when generating your report and during chat.</div>
              </div>
              <textarea
                className="ci-notes-ta"
                placeholder="e.g. Had a stressful week at work which affected sleep. Felt strong in the gym on Wednesday. Struggled to hit protein on the weekend..."
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={4}
              />
            </div>

            <div className="ci-submit-row">
              <button
                className="ci-btn-primary"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? "Saving…" : existingThisWeek ? "Update Check-In" : "Submit Check-In"}
              </button>
              {existingThisWeek && (
                <button
                  className="ci-btn-ghost"
                  onClick={handleGenerateReport}
                  disabled={generatingReport}
                >
                  {generatingReport ? "Generating…" : "Generate Report"}
                </button>
              )}
              {submitOk && (
                <div className="ci-success-msg">✓ Check-in saved</div>
              )}
            </div>
          </>
        )}

        {/* ── REPORT ── */}
        {tab === "report" && (
          <>
            <div className="ci-info-banner">
              <strong>Reports are generated automatically on your check-in day</strong> once all weekly data has been collected. You can also generate one manually after submitting your check-in. Reports are sent to your registered email and can be downloaded as PDF.
            </div>

            {reports.length === 0 ? (
              <div className="ci-empty-state">
                <div className="ci-empty-icon">◈</div>
                <div className="ci-empty-title">No Reports Yet</div>
                <div className="ci-empty-sub">Submit your check-in and generate your first report. Reports include a full AI-written analysis of your week.</div>
                {existingThisWeek && (
                  <button
                    className="ci-btn-primary"
                    style={{ marginTop: "0.5rem" }}
                    onClick={handleGenerateReport}
                    disabled={generatingReport}
                  >
                    {generatingReport ? "Generating…" : "Generate First Report"}
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: "1rem", alignItems: "start" }}>
                {/* Report list */}
                <div className="ci-report-list">
                  {reports.map(rpt => (
                    <div
                      key={rpt.id}
                      className={`ci-report-row${selectedReport?.id === rpt.id ? " active" : ""}`}
                      onClick={() => setSelectedReport(rpt)}
                    >
                      <div>
                        <div className="ci-report-week">Week of {fmtDate(rpt.week_start)}</div>
                        <div className="ci-report-meta">
                          {fmtDate(rpt.week_start)} — {fmtDate(rpt.week_end)}
                          {rpt.email_sent && <span style={{ color: "var(--ok)", marginLeft: "0.4rem" }}>✓ Sent</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Report preview */}
                {selectedReport && (
                  <div className="ci-report-preview">
                    <div className="ci-report-preview-header">
                      <div className="ci-report-title-block">
                        <div className="ci-report-title">Physique Pilot — Weekly Report</div>
                        <div className="ci-report-subtitle">
                          {fmtDate(selectedReport.week_start)} — {fmtDate(selectedReport.week_end)}
                        </div>
                      </div>
                      <div className="ci-report-actions">
                        <button
                          className={`ci-report-btn email`}
                          onClick={() => handleSendEmail(selectedReport.id)}
                          disabled={emailingReport === selectedReport.id}
                        >
                          {emailingReport === selectedReport.id ? "Sending…" : selectedReport.email_sent ? "Re-send Email" : "Send Email"}
                        </button>
                        <button
                          className="ci-report-btn"
                          onClick={() => handleDownloadPDF(selectedReport.id)}
                        >
                          Download PDF
                        </button>
                      </div>
                    </div>
                    <div className="ci-report-body">{selectedReport.report_text}</div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── PROGRESS PHOTOS ── */}
        {tab === "photos" && (
          <>
            <div className="ci-disclaimer">
              <span className="ci-disclaimer-icon">🔒</span>
              <div className="ci-disclaimer-text">
                <strong>Your photos are private and secure.</strong> Progress photos are stored with end-to-end encryption in your private storage bucket. <strong>No one else can view them</strong> — not coaches, not support staff, and not any AI system. They are for your personal progress tracking only. Access links expire after 10 minutes.
              </div>
            </div>

            <div>
              <div className="ci-section-head">
                <div className="ci-section-bar" />
                <span className="ci-section-title">Select Preset</span>
              </div>
              <div className="ci-preset-pills">
                {Object.entries(PRESETS).map(([key, p]) => (
                  <button
                    key={key}
                    className={`ci-preset-pill${activePreset === key ? " active" : ""}`}
                    onClick={() => setActivePreset(key)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="ci-section-head">
                <div className="ci-section-bar" />
                <span className="ci-section-title">{preset.label}</span>
              </div>
              {activePreset === "standard" && (
                <div style={{ fontSize: "0.76rem", color: "var(--text-3)", marginBottom: "0.65rem" }}>
                  Remove your shirt for standard photos to accurately track physique changes.
                </div>
              )}
              <div className="ci-pose-grid">
                {preset.poses.map(poseName => {
                  const photo = latestPhotoByPose[poseName];
                  const inputKey = `${activePreset}:${poseName}`;
                  const isUploading = uploadingPose === inputKey;

                  return (
                    <div key={poseName} className={`ci-pose-card${photo ? " has-photo" : ""}`}>
                      <div className="ci-pose-photo">
                        {photo ? (
                          <PosePhotoCell
                            photo={photo}
                            onClick={() => openPhotoModal(photo)}
                          />
                        ) : (
                          <div
                            className="ci-pose-placeholder"
                            onClick={() => !isUploading && fileInputRefs.current[inputKey]?.click()}
                          >
                            <span className="ci-pose-placeholder-icon">{isUploading ? "⏳" : "+"}</span>
                            <span className="ci-pose-placeholder-text">{isUploading ? "Uploading…" : "Upload Photo"}</span>
                          </div>
                        )}
                      </div>
                      <div className="ci-pose-footer">
                        <div>
                          <div className="ci-pose-name">{poseName}</div>
                          {photo && <div className="ci-pose-date">{fmtDate(photo.taken_on)}</div>}
                        </div>
                        <div className="ci-pose-actions">
                          {photo ? (
                            <>
                              <button
                                className="ci-pose-action-btn"
                                title="Replace"
                                onClick={() => fileInputRefs.current[inputKey]?.click()}
                              >↑</button>
                              <button
                                className="ci-pose-action-btn del"
                                title="Delete"
                                onClick={() => window.confirm(`Delete this ${poseName} photo?`) && deletePhoto(photo)}
                              >✕</button>
                            </>
                          ) : (
                            <button
                              className="ci-pose-action-btn"
                              title="Upload"
                              onClick={() => fileInputRefs.current[inputKey]?.click()}
                              disabled={isUploading}
                            >+</button>
                          )}
                        </div>
                      </div>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="ci-file-input"
                        ref={el => { fileInputRefs.current[inputKey] = el; }}
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (f) handlePoseUpload(f, activePreset, poseName);
                          e.target.value = "";
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <PhotoCompare photos={photos} />
          </>
        )}

      </div>

      {/* Photo viewer modal */}
      {photoModal && (
        <div className="ci-photo-overlay" onClick={() => setPhotoModal(null)}>
          <div className="ci-photo-modal" onClick={e => e.stopPropagation()}>
            <button className="ci-photo-modal-close" onClick={() => setPhotoModal(null)}>✕</button>
            <img src={photoModal.url} className="ci-photo-modal-img" alt={photoModal.pose} />
            <div style={{ fontFamily: "var(--font-display)", fontSize: "0.68rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-3)" }}>
              {photoModal.pose} · {fmtDate(photoModal.date)}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Lazy-loads a signed URL for display ───────────────────────────────────────
function PosePhotoCell({ photo, onClick }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let active = true;
    supabase.storage.from("progress-photos").createSignedUrl(photo.image_path, 600)
      .then(({ data }) => { if (active && data?.signedUrl) setUrl(data.signedUrl); });
    return () => { active = false; };
  }, [photo.image_path]);

  if (!url) {
    return (
      <div style={{ width: "100%", minHeight: "140px", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface-1)" }}>
        <span style={{ color: "var(--text-3)", fontSize: "0.72rem", fontFamily: "var(--font-display)", letterSpacing: "0.1em" }}>Loading…</span>
      </div>
    );
  }

  return (
    <img
      src={url}
      className="ci-pose-img"
      alt={photo.pose_name}
      onClick={onClick}
      style={{ cursor: "pointer" }}
      draggable={false}
    />
  );
}
