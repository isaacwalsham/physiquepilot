import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { supabase } from "../supabaseClient";
import { useProfile } from "../context/ProfileContext";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";
import PhysiquePilotLoader from "../components/PhysiquePilotLoader";

/* ─── colour tokens ──────────────────────────────────────── */
const CRIMSON = "#e8274b";   // steps / primary metric
const GREEN   = "#39d353";   // cardio / target achieved

/* ─── helpers ────────────────────────────────────────────── */
const pad     = (n) => String(n).padStart(2, "0");
const fmtISO  = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const todayISO = () => fmtISO(new Date());
const shortDate = (iso) => { const [,m,d] = iso.split("-"); return `${parseInt(d)}/${parseInt(m)}`; };

/* ─── cardio types ───────────────────────────────────────── */
const CARDIO_TYPES = [
  { id: "liss",     label: "LISS",   icon: "◎" },
  { id: "hiit",     label: "HIIT",   icon: "⚡" },
  { id: "running",  label: "Run",    icon: "▶" },
  { id: "cycling",  label: "Cycle",  icon: "⟳" },
  { id: "swimming", label: "Swim",   icon: "≈" },
  { id: "rowing",   label: "Row",    icon: "⇄" },
  { id: "walking",  label: "Walk",   icon: "∿" },
  { id: "other",    label: "Other",  icon: "◆" },
];

/* ─── HR zones ───────────────────────────────────────────── */
const ZONE_COLORS = ["#4a9eff", GREEN, "#f7c547", "#f5832a", CRIMSON];

const defaultZoneBounds = (maxHR) => [
  Math.round(maxHR * 0.50),
  Math.round(maxHR * 0.60),
  Math.round(maxHR * 0.70),
  Math.round(maxHR * 0.80),
  Math.round(maxHR * 0.90),
];

// Build 5-zone array from lower-bound array + maxHR
const buildZones = (bounds, maxHR) =>
  bounds.map((lo, i) => ({
    label: `Zone ${i + 1}`,
    color: ZONE_COLORS[i],
    lo,
    hi: i < bounds.length - 1 ? bounds[i + 1] : maxHR,
  }));

const STORAGE_KEY = "pp_hr_zone_bounds";

const loadStoredBounds = (maxHR) => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length === 5 && parsed.every(Number.isFinite)) {
        return parsed;
      }
    }
  } catch (_) {}
  return defaultZoneBounds(maxHR);
};

const getZone = (hr, zones) => {
  if (!hr || !zones?.length) return null;
  return (
    zones.find((z) => hr >= z.lo && hr < z.hi) ||
    (hr >= zones[zones.length - 1].lo ? zones[zones.length - 1] : null)
  );
};

/* ─── CSS ────────────────────────────────────────────────── */
const CSS = `
  .ac-wrap {
    width: 100%;
    min-height: 100%;
    display: flex;
    flex-direction: column;
    font-family: var(--font-body, 'Space Grotesk', sans-serif);
    color: var(--text-1, #e8e8f0);
  }

  /* header */
  .ac-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--line-1, #1e1e2e);
    margin-bottom: 1rem;
  }
  .ac-title {
    font-family: var(--font-display, 'Chakra Petch', sans-serif);
    font-size: 1.65rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin: 0;
  }
  .ac-subtitle {
    font-size: 0.72rem;
    color: var(--text-3, #555);
    letter-spacing: 0.07em;
    text-transform: uppercase;
    margin-top: 0.25rem;
  }
  .ac-status { display: flex; align-items: center; gap: 0.5rem; }
  .ac-status-label {
    font-family: var(--font-display, 'Chakra Petch', sans-serif);
    font-size: 0.65rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-3, #555);
  }
  .ac-dot {
    width: 7px; height: 7px; border-radius: 50%;
    background: ${GREEN};
    box-shadow: 0 0 8px ${GREEN};
    animation: ac-blink 2.5s ease-in-out infinite;
  }
  .ac-dot.busy {
    background: #f7c547;
    box-shadow: 0 0 8px #f7c547;
    animation: ac-blink 0.4s ease-in-out infinite;
  }
  @keyframes ac-blink { 0%,100%{opacity:1} 50%{opacity:0.25} }

  /* error */
  .ac-error {
    padding: 0.6rem 0.9rem;
    background: #ff445514;
    border: 1px solid #ff445540;
    border-radius: 4px;
    color: #ff8899;
    font-size: 0.82rem;
    margin-bottom: 0.75rem;
  }

  /* grid */
  .ac-grid {
    display: grid;
    grid-template-columns: 6fr 4fr;
    gap: 0.875rem;
    align-items: stretch;
    flex: 1;
    min-height: 0;
  }
  .ac-col {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
    min-width: 0;
    min-height: 0;
  }
  .ac-col-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }

  /* panel */
  .ac-panel {
    background: var(--surface-1, #0b0b12);
    border: 1px solid var(--line-1, #1e1e2e);
    border-radius: var(--radius-md, 8px);
    padding: 1rem 1.25rem;
    position: relative;
    overflow: hidden;
  }
  .ac-panel::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; height: 1px;
    background: linear-gradient(90deg, transparent 0%, ${CRIMSON}33 40%, ${GREEN}33 60%, transparent 100%);
  }
  .ac-panel.no-shine::before { display: none; }
  .ac-panel.scanlines::after {
    content: '';
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.055) 2px, rgba(0,0,0,0.055) 4px);
    pointer-events: none;
    border-radius: inherit;
  }
  .ac-panel-label {
    font-family: var(--font-display, 'Chakra Petch', sans-serif);
    font-size: 0.65rem;
    letter-spacing: 0.13em;
    text-transform: uppercase;
    color: var(--text-3, #555);
    margin-bottom: 0.85rem;
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  /* ring */
  .ac-ring-wrap { display: flex; flex-direction: column; align-items: center; gap: 0.9rem; }
  .ac-ring-svg-wrap { position: relative; width: 210px; height: 210px; flex-shrink: 0; }
  .ac-ring-svg-wrap svg { width: 100%; height: 100%; transform: rotate(-90deg); }
  .ac-ring-svg-wrap.glow-ok   svg { animation: ac-glow-ok   2.2s ease-in-out infinite; }
  .ac-ring-svg-wrap.glow-live svg { animation: ac-glow-live 3s   ease-in-out infinite; }
  @keyframes ac-glow-ok   { 0%,100%{filter:drop-shadow(0 0 7px ${GREEN}66)} 50%{filter:drop-shadow(0 0 22px ${GREEN}aa)} }
  @keyframes ac-glow-live { 0%,100%{filter:drop-shadow(0 0 5px ${CRIMSON}44)} 50%{filter:drop-shadow(0 0 16px ${CRIMSON}88)} }

  .ac-ring-center {
    position: absolute; inset: 0;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    pointer-events: none;
  }
  .ac-ring-num {
    font-family: var(--font-display, 'Chakra Petch', sans-serif);
    font-size: 2.4rem; font-weight: 700; line-height: 1;
    transition: color 0.5s ease;
  }
  .ac-ring-unit {
    font-family: var(--font-display, 'Chakra Petch', sans-serif);
    font-size: 0.62rem; letter-spacing: 0.14em; text-transform: uppercase;
    color: var(--text-3, #555); margin-top: 0.3rem;
  }
  .ac-ring-pct {
    font-family: var(--font-display, 'Chakra Petch', sans-serif);
    font-size: 0.85rem; margin-top: 0.15rem; letter-spacing: 0.04em;
  }

  .ac-ring-meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; width: 100%; }
  .ac-ring-meta-card {
    text-align: center; padding: 0.5rem 0.25rem;
    background: var(--surface-2, #0a0a11);
    border: 1px solid var(--line-1, #1e1e2e);
    border-radius: 4px;
  }
  .ac-ring-meta-val {
    font-family: var(--font-display, 'Chakra Petch', sans-serif);
    font-size: 1.1rem; font-weight: 700; line-height: 1;
  }
  .ac-ring-meta-lbl {
    font-size: 0.6rem; letter-spacing: 0.09em; text-transform: uppercase;
    color: var(--text-3, #555); margin-top: 0.3rem;
  }

  /* progress bar */
  .ac-progress-track {
    height: 5px; background: #0d0d18; border-radius: 3px;
    overflow: hidden; width: 100%; position: relative;
  }
  .ac-progress-fill {
    height: 100%; border-radius: 3px;
    transition: width 1s cubic-bezier(0.4,0,0.2,1), background 0.4s ease;
    position: relative; overflow: hidden;
  }
  .ac-progress-fill::after {
    content: '';
    position: absolute; top: 0; left: -60%; width: 40%; height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent);
    animation: ac-shimmer 2.8s ease infinite;
  }
  @keyframes ac-shimmer { 0%{left:-60%} 100%{left:120%} }

  /* badge */
  .ac-badge {
    display: inline-flex; align-items: center; gap: 0.3rem;
    font-family: var(--font-display, 'Chakra Petch', sans-serif);
    font-size: 0.62rem; letter-spacing: 0.09em; text-transform: uppercase;
    padding: 0.18rem 0.55rem; border-radius: 99px; border: 1px solid;
  }
  .ac-badge.ok   { color:${GREEN};   border-color:${GREEN}55;   background:${GREEN}10;   animation: ac-badge-pulse 2s ease-in-out infinite; }
  .ac-badge.warn { color:#f7c547; border-color:#f7c54755; background:#f7c54710; }
  .ac-badge.bad  { color:${CRIMSON}; border-color:${CRIMSON}55; background:${CRIMSON}10; }
  @keyframes ac-badge-pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }

  /* today cardio sessions */
  .ac-session-row {
    display: flex; align-items: center; gap: 0.6rem;
    padding: 0.45rem 0;
    border-bottom: 1px solid var(--line-1, #1e1e2e);
  }
  .ac-session-row:last-child { border-bottom: none; }
  .ac-session-type {
    font-family: var(--font-display, 'Chakra Petch', sans-serif);
    font-size: 0.62rem; letter-spacing: 0.07em; text-transform: uppercase;
    padding: 0.18rem 0.55rem; border-radius: 3px;
    border: 1px solid ${GREEN}55; background: ${GREEN}10; color: ${GREEN};
    flex-shrink: 0; min-width: 68px; text-align: center;
  }
  .ac-session-mins {
    font-family: var(--font-display, 'Chakra Petch', sans-serif);
    font-size: 1.05rem; color: ${GREEN}; flex: 1;
  }
  .ac-session-mins span { font-size: 0.65rem; color: var(--text-3, #555); margin-left: 0.2rem; }
  .ac-zone-pill {
    font-family: var(--font-display, 'Chakra Petch', sans-serif);
    font-size: 0.6rem; letter-spacing: 0.07em;
    padding: 0.15rem 0.45rem; border-radius: 99px; border: 1px solid;
    font-weight: 700; flex-shrink: 0;
  }

  /* stats row */
  .ac-stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.625rem; }
  .ac-stat {
    background: var(--surface-1, #0b0b12);
    border: 1px solid var(--line-1, #1e1e2e);
    border-radius: 6px; padding: 0.75rem 1rem;
    position: relative; overflow: hidden; transition: border-color 0.2s;
  }
  .ac-stat:hover { border-color: var(--line-2, #2a2a3e); }
  .ac-stat::after {
    content: ''; position: absolute; top: 0; left: 0; right: 0;
    height: 2px; border-radius: 2px 2px 0 0;
  }
  .ac-stat.cr::after { background: ${CRIMSON}; }
  .ac-stat.gr::after { background: ${GREEN}; }
  .ac-stat-lbl { font-size: 0.65rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-3, #555); }
  .ac-stat-val {
    font-family: var(--font-display, 'Chakra Petch', sans-serif);
    font-size: 1.55rem; font-weight: 700; line-height: 1; margin-top: 0.3rem;
  }
  .ac-stat-val.cr { color: ${CRIMSON}; }
  .ac-stat-val.gr { color: ${GREEN}; }
  .ac-stat-sub { font-size: 0.65rem; color: var(--text-3, #555); margin-top: 0.3rem; }

  /* charts */
  .ac-chart-h { flex: 1; min-height: 0; }
  .ac-chart-label {
    font-family: var(--font-display, 'Chakra Petch', sans-serif);
    font-size: 0.62rem; letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--text-3, #555); margin-bottom: 0.5rem;
  }
  .ac-tooltip {
    background: #090912; border: 1px solid #2a2a3e; border-radius: 4px;
    padding: 0.35rem 0.65rem;
    font-family: var(--font-display, 'Chakra Petch', sans-serif);
    font-size: 0.7rem; letter-spacing: 0.06em; color: var(--text-1, #e8e8f0);
    pointer-events: none;
  }

  /* inputs */
  .ac-input {
    width: 100%; padding: 0.6rem 0.75rem;
    background: var(--surface-2, #0a0a11);
    color: var(--text-1, #e8e8f0);
    border: 1px solid var(--line-1, #1e1e2e);
    border-radius: 4px;
    font-family: var(--font-body, 'Space Grotesk', sans-serif);
    font-size: 0.95rem; outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
    box-sizing: border-box;
  }
  .ac-input:focus { border-color: ${CRIMSON}44; box-shadow: 0 0 0 2px ${CRIMSON}18; }
  .ac-input.cardio:focus { border-color: ${GREEN}44; box-shadow: 0 0 0 2px ${GREEN}18; }
  .ac-input.zone-edit { font-size: 0.85rem; padding: 0.4rem 0.55rem; }
  .ac-input.zone-edit:focus { border-color: #f7c54744; box-shadow: 0 0 0 2px #f7c54718; }
  .ac-input::placeholder { color: var(--text-3, #555); }
  .ac-input-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
  .ac-input-label { font-size: 0.65rem; letter-spacing: 0.09em; text-transform: uppercase; color: var(--text-3, #555); margin-bottom: 0.3rem; }
  .ac-field { display: flex; flex-direction: column; }

  /* type selector */
  .ac-type-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.35rem; }
  .ac-type-btn {
    display: flex; flex-direction: column; align-items: center; gap: 0.2rem;
    padding: 0.45rem 0.2rem;
    background: var(--surface-2, #0a0a11);
    border: 1px solid var(--line-1, #1e1e2e);
    border-radius: 4px; color: var(--text-3, #555);
    font-family: var(--font-display, 'Chakra Petch', sans-serif);
    font-size: 0.58rem; letter-spacing: 0.06em; text-transform: uppercase;
    cursor: pointer; transition: all 0.15s ease;
  }
  .ac-type-btn .icon { font-size: 0.9rem; line-height: 1; }
  .ac-type-btn:hover { border-color: ${GREEN}44; color: ${GREEN}aa; }
  .ac-type-btn.on { background: ${GREEN}14; border-color: ${GREEN}66; color: ${GREEN}; box-shadow: 0 0 10px ${GREEN}1a; }

  /* buttons */
  .ac-btn {
    width: 100%; padding: 0.68rem 1rem; background: transparent;
    color: var(--text-1, #e8e8f0);
    border: 1px solid var(--line-1, #1e1e2e);
    border-radius: 4px;
    font-family: var(--font-display, 'Chakra Petch', sans-serif);
    font-size: 0.72rem; letter-spacing: 0.12em; text-transform: uppercase;
    cursor: pointer; transition: all 0.15s ease; margin-top: 0.5rem;
  }
  .ac-btn.cr { border-color: ${CRIMSON}44; color: ${CRIMSON}; }
  .ac-btn.gr { border-color: ${GREEN}44;   color: ${GREEN}; }
  .ac-btn.cr:hover:not(:disabled) { background: ${CRIMSON}0d; border-color: ${CRIMSON}88; box-shadow: 0 0 12px ${CRIMSON}1a; }
  .ac-btn.gr:hover:not(:disabled) { background: ${GREEN}0d;   border-color: ${GREEN}88;   box-shadow: 0 0 12px ${GREEN}1a; }
  .ac-btn:disabled { opacity: 0.38; cursor: not-allowed; }

  /* small icon button */
  .ac-icon-btn {
    background: none; border: 1px solid var(--line-1, #1e1e2e);
    border-radius: 3px; padding: 0.15rem 0.45rem;
    font-family: var(--font-display, 'Chakra Petch', sans-serif);
    font-size: 0.58rem; letter-spacing: 0.08em; text-transform: uppercase;
    color: var(--text-3, #555); cursor: pointer; transition: all 0.15s;
  }
  .ac-icon-btn:hover { color: var(--text-1, #e8e8f0); border-color: var(--line-2, #2a2a3e); }
  .ac-icon-btn.active { color: #f7c547; border-color: #f7c54755; background: #f7c54710; }

  /* inline save/cancel row */
  .ac-inline-actions { display: flex; gap: 0.4rem; margin-top: 0.6rem; }
  .ac-inline-btn {
    flex: 1; padding: 0.45rem; background: none;
    font-family: var(--font-display, 'Chakra Petch', sans-serif);
    font-size: 0.65rem; letter-spacing: 0.1em; text-transform: uppercase;
    border-radius: 3px; cursor: pointer; transition: all 0.15s;
  }
  .ac-inline-btn.save  { border: 1px solid ${GREEN}55; color: ${GREEN}; }
  .ac-inline-btn.save:hover  { background: ${GREEN}12; border-color: ${GREEN}99; }
  .ac-inline-btn.cancel { border: 1px solid var(--line-1,#1e1e2e); color: var(--text-3,#555); }
  .ac-inline-btn.cancel:hover { color: var(--text-2,#aaa); }

  /* zone row */
  .ac-zone-row {
    display: flex; align-items: center; gap: 0.6rem;
    padding: 0.35rem 0.55rem; border-radius: 4px;
    transition: all 0.2s ease; border: 1px solid transparent;
  }
  .ac-zone-pip { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
  .ac-zone-code {
    font-family: var(--font-display, 'Chakra Petch', sans-serif);
    font-size: 0.68rem; letter-spacing: 0.07em; flex-shrink: 0; min-width: 44px;
  }
  .ac-zone-name { flex: 1; font-size: 0.8rem; color: var(--text-2, #aaa); }
  .ac-zone-range {
    font-family: var(--font-display, 'Chakra Petch', sans-serif);
    font-size: 0.62rem; color: var(--text-3, #555); letter-spacing: 0.04em; flex-shrink: 0;
  }
  /* zone edit row */
  .ac-zone-edit-row {
    display: grid;
    grid-template-columns: 5px 44px 1fr 90px;
    align-items: center; gap: 0.6rem;
    padding: 0.3rem 0.55rem;
  }
  .ac-zone-edit-hint {
    font-size: 0.62rem; color: var(--text-3, #555); letter-spacing: 0.05em;
    margin: 0.4rem 0.55rem 0;
    font-style: italic;
  }

  /* scheduled cardio */
  .ac-scheduled-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }
  .ac-day-type-pill {
    font-family: var(--font-display, 'Chakra Petch', sans-serif);
    font-size: 0.6rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 0.18rem 0.55rem;
    border-radius: 99px;
    border: 1px solid;
    flex-shrink: 0;
  }
  .ac-day-type-pill.training { color: ${CRIMSON}; border-color: ${CRIMSON}55; background: ${CRIMSON}10; }
  .ac-day-type-pill.rest     { color: ${GREEN};   border-color: ${GREEN}55;   background: ${GREEN}10; }

  .ac-prescription {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.65rem 0.85rem;
    background: var(--surface-2, #0a0a11);
    border: 1px solid var(--line-1, #1e1e2e);
    border-radius: 5px;
    margin-bottom: 0.6rem;
    transition: border-color 0.2s;
  }
  .ac-prescription.complete {
    border-color: ${GREEN}44;
    background: ${GREEN}08;
  }
  .ac-prescription.pending {
    border-color: ${CRIMSON}33;
  }
  .ac-prescription-icon {
    font-size: 1.25rem;
    flex-shrink: 0;
    line-height: 1;
  }
  .ac-prescription-body { flex: 1; min-width: 0; }
  .ac-prescription-main {
    font-family: var(--font-display, 'Chakra Petch', sans-serif);
    font-size: 0.92rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
  }
  .ac-prescription-sub {
    font-size: 0.68rem;
    color: var(--text-3, #555);
    margin-top: 0.2rem;
    letter-spacing: 0.04em;
  }
  .ac-prescription-status {
    font-family: var(--font-display, 'Chakra Petch', sans-serif);
    font-size: 0.65rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    flex-shrink: 0;
  }
  .ac-quickfill-btn {
    width: 100%;
    padding: 0.5rem;
    background: transparent;
    border: 1px dashed var(--line-1, #1e1e2e);
    border-radius: 4px;
    font-family: var(--font-display, 'Chakra Petch', sans-serif);
    font-size: 0.65rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-3, #555);
    cursor: pointer;
    transition: all 0.15s;
  }
  .ac-quickfill-btn:hover {
    border-color: ${CRIMSON}55;
    color: ${CRIMSON};
    border-style: solid;
  }
  .ac-no-schedule {
    font-size: 0.78rem;
    color: var(--text-3, #555);
    letter-spacing: 0.05em;
    text-align: center;
    padding: 0.5rem 0;
  }

  /* history scrollable */
  .ac-hist-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
  .ac-hist-scroll::-webkit-scrollbar { width: 3px; }
  .ac-hist-scroll::-webkit-scrollbar-track { background: transparent; }
  .ac-hist-scroll::-webkit-scrollbar-thumb { background: var(--line-1, #1e1e2e); border-radius: 2px; }

  /* tabs */
  .ac-tabs { display: flex; border-bottom: 1px solid var(--line-1, #1e1e2e); margin-bottom: 0.75rem; }
  .ac-tab {
    padding: 0.35rem 1rem;
    font-family: var(--font-display, 'Chakra Petch', sans-serif);
    font-size: 0.65rem; letter-spacing: 0.1em; text-transform: uppercase;
    color: var(--text-3, #555); cursor: pointer;
    border: none; background: none;
    border-bottom: 2px solid transparent; margin-bottom: -1px; transition: all 0.15s;
  }
  .ac-tab:hover { color: var(--text-2, #aaa); }
  .ac-tab.on-cr { color: ${CRIMSON}; border-bottom-color: ${CRIMSON}; }
  .ac-tab.on-gr { color: ${GREEN};   border-bottom-color: ${GREEN}; }

  /* history rows */
  .ac-hist-row {
    display: flex; align-items: center; gap: 0.5rem;
    padding: 0.45rem 0.35rem; border-radius: 4px;
    transition: background 0.1s;
    border-bottom: 1px solid var(--line-1, #1e1e2e);
  }
  .ac-hist-row:last-child { border-bottom: none; }
  .ac-hist-row:hover { background: #0a0a14; }
  .ac-hist-date {
    font-family: var(--font-display, 'Chakra Petch', sans-serif);
    font-size: 0.68rem; letter-spacing: 0.05em; color: var(--text-3, #555);
    flex-shrink: 0; min-width: 48px;
  }
  .ac-hist-main { flex: 1; min-width: 0; }
  .ac-hist-primary { font-size: 0.9rem; display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }
  .ac-hist-secondary { font-size: 0.68rem; color: var(--text-3, #555); margin-top: 0.15rem; }
  .ac-del-btn {
    padding: 0.25rem 0.5rem; background: transparent;
    color: var(--text-3, #555);
    border: 1px solid var(--line-1, #1e1e2e);
    border-radius: 3px;
    font-family: var(--font-display, 'Chakra Petch', sans-serif);
    font-size: 0.6rem; letter-spacing: 0.07em; text-transform: uppercase;
    cursor: pointer; transition: all 0.15s; flex-shrink: 0;
  }
  .ac-del-btn:hover { color: ${CRIMSON}; border-color: ${CRIMSON}66; }

  .ac-empty {
    text-align: center; padding: 1.5rem 0;
    font-size: 0.78rem; color: var(--text-3, #555);
    letter-spacing: 0.06em;
    font-family: var(--font-display, 'Chakra Petch', sans-serif); text-transform: uppercase;
  }

  /* loading */
  .ac-loading {
    display: flex; align-items: center; justify-content: center; min-height: 240px;
    font-family: var(--font-display, 'Chakra Petch', sans-serif);
    font-size: 0.75rem; letter-spacing: 0.18em; text-transform: uppercase;
    color: var(--text-3, #555); animation: ac-blink 1.4s ease-in-out infinite;
  }

  @media (max-width: 880px) {
    .ac-grid { grid-template-columns: 1fr; }
  }
  @media (max-width: 560px) {
    .ac-stats-row { grid-template-columns: 1fr 1fr; }
    .ac-input-pair { grid-template-columns: 1fr; }
    .ac-type-grid { grid-template-columns: repeat(4, 1fr); }
  }
`;

/* ══════════════════════════════════════════════════════════ */
export default function CardioSteps() {
  const { profile, todayDayType } = useProfile();

  const [loading,       setLoading]       = useState(true);
  const [savingSteps,   setSavingSteps]   = useState(false);
  const [savingCardio,  setSavingCardio]  = useState(false);
  const [error,         setError]         = useState("");

  const [userId,        setUserId]        = useState(null);
  const [stepsTarget,   setStepsTarget]   = useState(null);
  const [maxHR,         setMaxHR]         = useState(200); // default 220–age, fallback 200

  // steps
  const [stepsInput,    setStepsInput]    = useState("");
  const [stepsToday,    setStepsToday]    = useState(null);
  const [recentSteps,   setRecentSteps]   = useState([]);

  // cardio
  const [cardioType,    setCardioType]    = useState("liss");
  const [minsInput,     setMinsInput]     = useState("");
  const [hrInput,       setHrInput]       = useState("");
  const [todaySessions, setTodaySessions] = useState([]);
  const [recentCardio,  setRecentCardio]  = useState([]);

  // HR zones (editable)
  const [zoneBounds,    setZoneBounds]    = useState(() => loadStoredBounds(200));
  const [editingZones,  setEditingZones]  = useState(false);
  const [editBounds,    setEditBounds]    = useState(null); // draft while editing

  // UI
  const [histTab, setHistTab] = useState("cardio");

  /* build zone objects */
  const zones = useMemo(() => buildZones(zoneBounds, maxHR), [zoneBounds, maxHR]);

  /* profile → target + maxHR */
  useEffect(() => {
    if (!profile) return;
    const t = profile.baseline_steps_per_day ?? profile.steps_target ?? null;
    setStepsTarget(t !== null ? Number(t) : null);
    const age = profile.age ?? null;
    if (age && age > 10 && age < 100) {
      const mhr = 220 - age;
      setMaxHR(mhr);
      // only reset stored bounds if none saved yet
      if (!localStorage.getItem(STORAGE_KEY)) {
        setZoneBounds(defaultZoneBounds(mhr));
      }
    }
  }, [profile]);

  /* load */
  useEffect(() => {
    const boot = async () => {
      setLoading(true); setError("");
      const { data: sess } = await supabase.auth.getSession();
      const user = sess?.session?.user;
      if (!user) { setError("Not logged in."); setLoading(false); return; }
      setUserId(user.id);
      await refreshAll(user.id);
      setLoading(false);
    };
    boot();
  }, []);

  const refreshAll = useCallback(async (uid) => {
    const today = todayISO();

    const { data: sr } = await supabase
      .from("steps_logs").select("steps")
      .eq("user_id", uid).eq("log_date", today).maybeSingle();
    setStepsToday(sr?.steps ?? null);
    setStepsInput(sr?.steps ? String(sr.steps) : "");

    const { data: sRec } = await supabase
      .from("steps_logs").select("log_date, steps")
      .eq("user_id", uid).order("log_date", { ascending: false }).limit(14);
    setRecentSteps(sRec || []);

    // cardio today (graceful fallback if cardio_type col missing)
    let todayC = [];
    {
      const { data, error: e } = await supabase
        .from("cardio_logs").select("id, minutes, avg_hr, cardio_type")
        .eq("user_id", uid).eq("log_date", today)
        .order("created_at", { ascending: true });
      if (e?.code === "42703") {
        const { data: d2 } = await supabase
          .from("cardio_logs").select("id, minutes, avg_hr")
          .eq("user_id", uid).eq("log_date", today)
          .order("created_at", { ascending: true });
        todayC = d2 || [];
      } else { todayC = data || []; }
    }
    setTodaySessions(todayC);

    // recent cardio
    {
      const { data, error: e } = await supabase
        .from("cardio_logs")
        .select("id, log_date, minutes, avg_hr, cardio_type, created_at")
        .eq("user_id", uid)
        .order("log_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(20);
      if (e?.code === "42703") {
        const { data: d2 } = await supabase
          .from("cardio_logs").select("id, log_date, minutes, avg_hr, created_at")
          .eq("user_id", uid)
          .order("log_date", { ascending: false })
          .order("created_at", { ascending: false }).limit(20);
        setRecentCardio(d2 || []);
      } else { setRecentCardio(data || []); }
    }
  }, []);

  const saveSteps = async () => {
    if (!userId) return;
    setSavingSteps(true); setError("");
    const n = Number(stepsInput);
    if (!Number.isFinite(n) || n < 0) { setSavingSteps(false); setError("Enter a valid step count."); return; }
    await supabase.from("steps_logs").upsert(
      { user_id: userId, log_date: todayISO(), steps: Math.round(n) },
      { onConflict: "user_id,log_date" }
    );
    setSavingSteps(false);
    await refreshAll(userId);
  };

  const addCardio = async () => {
    if (!userId) return;
    setSavingCardio(true); setError("");
    const mins = Number(minsInput);
    if (!Number.isFinite(mins) || mins <= 0) { setSavingCardio(false); setError("Enter cardio minutes."); return; }
    const hr = hrInput === "" ? null : Number(hrInput);
    if (hr !== null && (!Number.isFinite(hr) || hr < 40 || hr > 220)) {
      setSavingCardio(false); setError("Avg HR must be 40–220."); return;
    }
    const payload = {
      user_id: userId, log_date: todayISO(),
      minutes: Math.round(mins),
      avg_hr: hr ? Math.round(hr) : null,
      cardio_type: cardioType,
    };
    const { error: e } = await supabase.from("cardio_logs").insert(payload);
    if (e?.code === "42703") {
      const { cardio_type: _ct, ...rest } = payload;
      const { error: e2 } = await supabase.from("cardio_logs").insert(rest);
      if (e2) { setSavingCardio(false); setError(e2.message); return; }
    } else if (e) { setSavingCardio(false); setError(e.message); return; }
    setSavingCardio(false);
    setMinsInput(""); setHrInput("");
    await refreshAll(userId);
  };

  const deleteCardio = async (id) => {
    if (!userId) return;
    await supabase.from("cardio_logs").delete().eq("id", id).eq("user_id", userId);
    await refreshAll(userId);
  };

  const deleteSteps = async (date) => {
    if (!userId) return;
    await supabase.from("steps_logs").delete().eq("user_id", userId).eq("log_date", date);
    await refreshAll(userId);
  };

  /* ── zone editing ── */
  const startEditZones = () => {
    setEditBounds([...zoneBounds]);
    setEditingZones(true);
  };
  const cancelEditZones = () => { setEditingZones(false); setEditBounds(null); };
  const saveZones = () => {
    // validate: must be ascending, all numbers 40–maxHR
    const sorted = [...editBounds].map(Number);
    if (sorted.some(v => !Number.isFinite(v) || v < 40 || v > maxHR)) {
      setError("Zone bounds must be numbers between 40 and max HR."); return;
    }
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] <= sorted[i - 1]) {
        setError("Zone lower bounds must be strictly ascending."); return;
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
    setZoneBounds(sorted);
    setEditingZones(false);
    setEditBounds(null);
  };
  const resetZones = () => {
    const defaults = defaultZoneBounds(maxHR);
    setEditBounds(defaults);
  };

  /* ── computed ── */
  const avgSteps7 = useMemo(() => {
    const rows = recentSteps.slice(0, 7);
    if (!rows.length) return null;
    return Math.round(rows.reduce((a, r) => a + Number(r.steps || 0), 0) / rows.length);
  }, [recentSteps]);

  const weeklySteps    = useMemo(() => recentSteps.slice(0, 7).reduce((a, r) => a + Number(r.steps || 0), 0), [recentSteps]);
  const todayCardioMin = useMemo(() => todaySessions.reduce((a, s) => a + Number(s.minutes || 0), 0), [todaySessions]);
  const weeklyCardioMin = useMemo(() => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
    return recentCardio.filter(r => new Date(r.log_date) >= cutoff).reduce((a, r) => a + Number(r.minutes || 0), 0);
  }, [recentCardio]);

  const stepsChart = useMemo(() => {
    const map = {};
    recentSteps.forEach(r => { map[r.log_date] = r.steps; });
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (13 - i));
      const iso = fmtISO(d);
      return { date: shortDate(iso), steps: map[iso] || 0 };
    });
  }, [recentSteps]);

  const cardioChart = useMemo(() => {
    const map = {};
    recentCardio.forEach(r => { map[r.log_date] = (map[r.log_date] || 0) + Number(r.minutes || 0); });
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      const iso = fmtISO(d);
      return { date: shortDate(iso), minutes: map[iso] || 0 };
    });
  }, [recentCardio]);

  const avgHRToday  = useMemo(() => {
    const s = todaySessions.filter(x => x.avg_hr);
    if (!s.length) return null;
    return Math.round(s.reduce((a, x) => a + x.avg_hr, 0) / s.length);
  }, [todaySessions]);

  const todayZone   = avgHRToday  ? getZone(avgHRToday,  zones) : null;

  /* ── scheduled cardio from coach / profile ── */
  const scheduledCardio = useMemo(() => {
    if (!profile) return null;
    const isTraining     = todayDayType === "training";
    const lissOptIn      = profile.default_liss_opt_in ?? true;
    const weeklyBaseline = profile.baseline_cardio_minutes_per_week ?? null;
    const baselineHR     = profile.baseline_cardio_avg_hr ?? null;
    const dayLabel       = isTraining ? "Training Day" : "Rest Day";

    // Training day + LISS opt-in → prescribe LISS
    if (isTraining && lissOptIn) {
      return {
        type: "liss", label: "LISS",
        icon: "◎",
        minutes: 15,
        hr: baselineHR,
        dayLabel,
        isTraining,
        reason: "Post-session LISS — preserves recovery while maximising NEAT.",
      };
    }
    // Rest day with weekly cardio baseline → spread across week
    if (!isTraining && weeklyBaseline && weeklyBaseline > 0) {
      const dailyMins = Math.round(weeklyBaseline / 5); // spread over 5 days
      return {
        type: "liss", label: "LISS",
        icon: "◎",
        minutes: Math.max(dailyMins, 10),
        hr: baselineHR,
        dayLabel,
        isTraining,
        reason: `Rest day cardio · ${weeklyBaseline} min/week baseline ÷ 5 active days.`,
      };
    }
    // Training day, no LISS opt-in
    if (isTraining && !lissOptIn) {
      return {
        type: null, label: null, icon: "—",
        minutes: null, hr: null,
        dayLabel,
        isTraining,
        reason: "No cardio prescribed on training days per your preference.",
      };
    }
    // Rest day, no baseline
    return {
      type: null, label: null, icon: "—",
      minutes: null, hr: null,
      dayLabel,
      isTraining,
      reason: "No cardio baseline set. Update your profile to enable recommendations.",
    };
  }, [profile, todayDayType]);

  // Whether today's prescription has been fulfilled
  const prescriptionDone = useMemo(() => {
    if (!scheduledCardio?.minutes) return false;
    return todayCardioMin >= scheduledCardio.minutes;
  }, [scheduledCardio, todayCardioMin]);

  const quickFill = useCallback(() => {
    if (!scheduledCardio) return;
    if (scheduledCardio.type)    setCardioType(scheduledCardio.type);
    if (scheduledCardio.minutes) setMinsInput(String(scheduledCardio.minutes));
    if (scheduledCardio.hr)      setHrInput(String(scheduledCardio.hr));
    // scroll to add cardio panel
    document.getElementById("ac-add-cardio-panel")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [scheduledCardio]);

  const previewZone = useMemo(() => {
    const n = Number(hrInput);
    if (!hrInput || !Number.isFinite(n) || n < 40 || n > 220) return null;
    return getZone(n, zones);
  }, [hrInput, zones]);

  /* ── ring gauge ── */
  const R    = 82;
  const CIRC = 2 * Math.PI * R;
  const stepFill = stepsTarget && stepsToday !== null ? Math.min(stepsToday / stepsTarget, 1) : 0;
  const ringColor =
    stepsToday !== null && stepsTarget && stepsToday >= stepsTarget ? GREEN :
    stepsToday !== null && stepsToday > 0 ? CRIMSON : "#1a1a2a";
  const ringGlow =
    stepsToday !== null && stepsTarget && stepsToday >= stepsTarget ? "glow-ok" :
    stepsToday !== null && stepsToday > 0 ? "glow-live" : "";
  const pctLabel = stepsTarget && stepsToday !== null
    ? `${Math.round((stepsToday / stepsTarget) * 100)}%` : "—";

  const ticks = Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * 2 * Math.PI;
    const major = i % 6 === 0;
    return {
      x1: 105 + (major ? R - 7 : R - 4) * Math.cos(a),
      y1: 105 + (major ? R - 7 : R - 4) * Math.sin(a),
      x2: 105 + (R + 1) * Math.cos(a),
      y2: 105 + (R + 1) * Math.sin(a),
      major,
    };
  });

  if (loading) return <PhysiquePilotLoader />;

  return (
    <>
      <style>{CSS}</style>
      <div className="ac-wrap">

        {/* ── HEADER ── */}
        <div className="ac-header">
          <div>
            <h1 className="ac-title">Activity</h1>
            <div className="ac-subtitle">
              Step &amp; Cardio Telemetry ·{" "}
              {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}
            </div>
          </div>
          <div className="ac-status">
            <span className="ac-status-label">{savingSteps || savingCardio ? "syncing" : "live"}</span>
            <div className={`ac-dot${savingSteps || savingCardio ? " busy" : ""}`} />
          </div>
        </div>

        {error && <div className="ac-error">{error}</div>}

        <div className="ac-grid">

          {/* ══════════════════════════════════════
              LEFT — HUD COLUMN
          ══════════════════════════════════════ */}
          <div className="ac-col">

            {/* STEP RING */}
            <div className="ac-panel scanlines" style={{ paddingBottom: "1.25rem" }}>
              <div className="ac-panel-label">Step Count · Today</div>
              <div className="ac-ring-wrap">
                <div className={`ac-ring-svg-wrap ${ringGlow}`}>
                  <svg viewBox="0 0 210 210">
                    {/* outer dashed decoration */}
                    <circle cx="105" cy="105" r={R + 14} fill="none"
                      stroke="#1a1a2a" strokeWidth="1" strokeDasharray="2 6" />
                    {/* track */}
                    <circle cx="105" cy="105" r={R} fill="none" stroke="#131320" strokeWidth="14" />
                    {/* glow halo */}
                    {stepFill > 0 && (
                      <circle cx="105" cy="105" r={R} fill="none"
                        stroke={ringColor} strokeWidth="20" strokeLinecap="round"
                        strokeDasharray={`${stepFill * CIRC} ${CIRC}`}
                        opacity="0.18"
                        style={{ transition: "stroke-dasharray 1s cubic-bezier(0.4,0,0.2,1)" }}
                      />
                    )}
                    {/* main arc */}
                    <circle cx="105" cy="105" r={R} fill="none"
                      stroke={ringColor} strokeWidth="11" strokeLinecap="round"
                      strokeDasharray={`${stepFill * CIRC} ${CIRC}`}
                      style={{ transition: "stroke-dasharray 1s cubic-bezier(0.4,0,0.2,1), stroke 0.5s ease" }}
                    />
                    {/* ticks */}
                    {ticks.map((t, i) => (
                      <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
                        stroke={t.major ? "#2a2a3e" : "#18182a"}
                        strokeWidth={t.major ? 1.5 : 1}
                      />
                    ))}
                    {/* target marker */}
                    {stepsTarget && (
                      <circle
                        cx={105 + (R + 1) * Math.cos(0)}
                        cy={105 + (R + 1) * Math.sin(0)}
                        r="3.5" fill={GREEN}
                      />
                    )}
                  </svg>
                  <div className="ac-ring-center">
                    <div className="ac-ring-num" style={{ color: ringColor }}>
                      {stepsToday !== null ? stepsToday.toLocaleString() : "—"}
                    </div>
                    <div className="ac-ring-unit">steps today</div>
                    <div className="ac-ring-pct" style={{ color: ringColor }}>{pctLabel}</div>
                  </div>
                </div>

                {/* meta row */}
                <div className="ac-ring-meta">
                  <div className="ac-ring-meta-card">
                    <div className="ac-ring-meta-val" style={{ color: CRIMSON }}>
                      {stepsTarget ? stepsTarget.toLocaleString() : "—"}
                    </div>
                    <div className="ac-ring-meta-lbl">Target</div>
                  </div>
                  <div className="ac-ring-meta-card">
                    <div className="ac-ring-meta-val" style={{ color: GREEN }}>
                      {avgSteps7 !== null ? avgSteps7.toLocaleString() : "—"}
                    </div>
                    <div className="ac-ring-meta-lbl">7-Day Avg</div>
                  </div>
                  <div className="ac-ring-meta-card">
                    <div className="ac-ring-meta-val" style={{ color: GREEN }}>
                      {weeklySteps ? weeklySteps.toLocaleString() : "—"}
                    </div>
                    <div className="ac-ring-meta-lbl">Week Total</div>
                  </div>
                </div>

                {/* progress bar */}
                {stepsTarget && (
                  <div className="ac-progress-track" style={{ width: "100%" }}>
                    <div className="ac-progress-fill" style={{
                      width: `${Math.min(100, (stepsToday || 0) / stepsTarget * 100)}%`,
                      background: ringColor,
                    }} />
                  </div>
                )}

                {/* badges */}
                <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", justifyContent: "center" }}>
                  {stepsTarget && stepsToday !== null && stepsToday >= stepsTarget && (
                    <span className="ac-badge ok">✓ Target Hit</span>
                  )}
                  {stepsTarget && stepsToday !== null && stepsToday >= stepsTarget * 1.8 && (
                    <span className="ac-badge warn">⚠ Very High</span>
                  )}
                  {stepsTarget && stepsToday !== null && stepsToday > 0 && stepsToday < stepsTarget * 0.5 && (
                    <span className="ac-badge bad">{(stepsTarget - stepsToday).toLocaleString()} to go</span>
                  )}
                </div>
              </div>
            </div>

            {/* TODAY'S CARDIO */}
            <div className="ac-panel">
              <div className="ac-panel-label">
                Cardio · Today
                {todayCardioMin > 0 && (
                  <span style={{ color: GREEN }}>{todayCardioMin} min total</span>
                )}
              </div>
              {!todaySessions.length
                ? <div className="ac-empty" style={{ padding: "0.5rem 0" }}>No sessions logged today</div>
                : todaySessions.map(s => {
                  const t = CARDIO_TYPES.find(x => x.id === s.cardio_type) || CARDIO_TYPES[7];
                  const z = s.avg_hr ? getZone(s.avg_hr, zones) : null;
                  return (
                    <div key={s.id} className="ac-session-row">
                      <span className="ac-session-type">{t.icon} {t.label}</span>
                      <span className="ac-session-mins">{s.minutes}<span>min</span></span>
                      {z && (
                        <span className="ac-zone-pill" style={{ color: z.color, borderColor: z.color + "55", background: z.color + "14" }}>
                          {z.label} · {s.avg_hr}
                        </span>
                      )}
                      {!z && s.avg_hr && (
                        <span style={{ fontSize: "0.7rem", color: "var(--text-3)" }}>{s.avg_hr} bpm</span>
                      )}
                    </div>
                  );
                })
              }
              {todayCardioMin >= 180 && (
                <div style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "#f7c547" }}>
                  ⚠ Very high cardio volume — monitor recovery.
                </div>
              )}
            </div>

            {/* WEEKLY STATS */}
            <div className="ac-stats-row">
              <div className="ac-stat cr">
                <div className="ac-stat-lbl">Weekly Steps</div>
                <div className="ac-stat-val cr">{weeklySteps ? weeklySteps.toLocaleString() : "—"}</div>
                <div className="ac-stat-sub">
                  {stepsTarget
                    ? `${Math.round(weeklySteps / (stepsTarget * 7) * 100)}% of week target`
                    : "Last 7 days"}
                </div>
              </div>
              <div className="ac-stat gr">
                <div className="ac-stat-lbl">Weekly Cardio</div>
                <div className="ac-stat-val gr">{weeklyCardioMin ? `${weeklyCardioMin}m` : "—"}</div>
                <div className="ac-stat-sub">Last 7 days</div>
              </div>
              <div className="ac-stat gr">
                <div className="ac-stat-lbl">Daily Avg Steps</div>
                <div className="ac-stat-val gr">{avgSteps7 !== null ? avgSteps7.toLocaleString() : "—"}</div>
                <div className="ac-stat-sub">7-day rolling</div>
              </div>
            </div>

            {/* STEP CHART */}
            <div className="ac-panel no-shine" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
              <div className="ac-chart-label">14-Day Step Trend</div>
              <div className="ac-chart-h">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stepsChart} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} barSize={10}>
                    <XAxis dataKey="date"
                      tick={{ fontSize: 8, fill: "#444", fontFamily: "Chakra Petch, monospace" }}
                      axisLine={false} tickLine={false}
                    />
                    <YAxis hide />
                    <Tooltip cursor={{ fill: "#ffffff07" }}
                      content={({ active, payload, label }) =>
                        active && payload?.length
                          ? <div className="ac-tooltip">{label} · {(payload[0].value || 0).toLocaleString()} steps</div>
                          : null
                      }
                    />
                    {stepsTarget && <ReferenceLine y={stepsTarget} stroke={`${GREEN}44`} strokeDasharray="3 3" />}
                    <Bar dataKey="steps" radius={[2, 2, 0, 0]}>
                      {stepsChart.map((e, i) => (
                        <Cell key={i}
                          fill={stepsTarget && e.steps >= stepsTarget ? GREEN : CRIMSON}
                          fillOpacity={e.steps > 0 ? 0.82 : 0.12}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* CARDIO CHART */}
            <div className="ac-panel no-shine" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
              <div className="ac-chart-label">7-Day Cardio Volume (min)</div>
              <div className="ac-chart-h">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cardioChart} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} barSize={18}>
                    <XAxis dataKey="date"
                      tick={{ fontSize: 8, fill: "#444", fontFamily: "Chakra Petch, monospace" }}
                      axisLine={false} tickLine={false}
                    />
                    <YAxis hide />
                    <Tooltip cursor={{ fill: "#ffffff07" }}
                      content={({ active, payload, label }) =>
                        active && payload?.length
                          ? <div className="ac-tooltip">{label} · {payload[0].value} min</div>
                          : null
                      }
                    />
                    <Bar dataKey="minutes" radius={[2, 2, 0, 0]}>
                      {cardioChart.map((e, i) => (
                        <Cell key={i} fill={GREEN} fillOpacity={e.minutes > 0 ? 0.82 : 0.12} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>{/* end hud col */}

          {/* ══════════════════════════════════════
              RIGHT — LOG COLUMN
          ══════════════════════════════════════ */}
          <div className="ac-col">

            {/* SCHEDULED CARDIO */}
            {scheduledCardio && (
              <div className="ac-panel">
                <div className="ac-scheduled-header">
                  <div className="ac-panel-label" style={{ margin: 0 }}>Scheduled Cardio · Today</div>
                  <span className={`ac-day-type-pill ${scheduledCardio.isTraining ? "training" : "rest"}`}>
                    {scheduledCardio.dayLabel}
                  </span>
                </div>

                {scheduledCardio.type ? (
                  <>
                    <div className={`ac-prescription ${prescriptionDone ? "complete" : "pending"}`}>
                      <div className="ac-prescription-icon">{scheduledCardio.icon}</div>
                      <div className="ac-prescription-body">
                        <div className="ac-prescription-main">
                          <span style={{ color: prescriptionDone ? GREEN : CRIMSON }}>
                            {scheduledCardio.label}
                          </span>
                          <span style={{ color: "var(--text-1)", fontSize: "1.1rem", fontWeight: 700 }}>
                            {scheduledCardio.minutes} min
                          </span>
                          {scheduledCardio.hr && (
                            <span style={{ fontSize: "0.72rem", color: "var(--text-3)" }}>
                              · ~{scheduledCardio.hr} bpm
                            </span>
                          )}
                        </div>
                        <div className="ac-prescription-sub">{scheduledCardio.reason}</div>
                      </div>
                      <div className="ac-prescription-status" style={{ color: prescriptionDone ? GREEN : "var(--text-3)" }}>
                        {prescriptionDone ? "✓ done" : `${Math.max(0, scheduledCardio.minutes - todayCardioMin)} min left`}
                      </div>
                    </div>

                    {!prescriptionDone && (
                      <button className="ac-quickfill-btn" onClick={quickFill}>
                        ⟶ Quick-fill cardio form with today's prescription
                      </button>
                    )}
                  </>
                ) : (
                  <div className="ac-no-schedule">{scheduledCardio.reason}</div>
                )}
              </div>
            )}

            {/* LOG STEPS */}
            <div className="ac-panel">
              <div className="ac-panel-label">Log Steps</div>
              <div className="ac-field">
                <div className="ac-input-label">Step Count</div>
                <input
                  className="ac-input"
                  type="number" min="0"
                  placeholder="e.g. 8 500"
                  value={stepsInput}
                  onChange={e => setStepsInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && saveSteps()}
                />
              </div>
              <button className="ac-btn cr" onClick={saveSteps} disabled={savingSteps}>
                {savingSteps ? "Saving…" : "Save Steps"}
              </button>
              {stepsTarget && stepsToday !== null && stepsToday >= stepsTarget * 1.8 && (
                <div style={{ marginTop: "0.6rem", fontSize: "0.75rem", color: "#f7c547" }}>
                  ⚠ Very high activity. Pull back if recovery drops.
                </div>
              )}
            </div>

            {/* ADD CARDIO */}
            <div className="ac-panel" id="ac-add-cardio-panel">
              <div className="ac-panel-label">Add Cardio Session</div>

              <div style={{ marginBottom: "0.7rem" }}>
                <div className="ac-input-label">Type</div>
                <div className="ac-type-grid">
                  {CARDIO_TYPES.map(t => (
                    <button key={t.id}
                      className={`ac-type-btn${cardioType === t.id ? " on" : ""}`}
                      onClick={() => setCardioType(t.id)}
                    >
                      <span className="icon">{t.icon}</span>
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="ac-input-pair" style={{ marginBottom: "0.5rem" }}>
                <div className="ac-field">
                  <div className="ac-input-label">Minutes</div>
                  <input className="ac-input cardio" type="number" min="1"
                    placeholder="e.g. 35" value={minsInput}
                    onChange={e => setMinsInput(e.target.value)} />
                </div>
                <div className="ac-field">
                  <div className="ac-input-label">Avg HR (opt)</div>
                  <input className="ac-input cardio" type="number" min="40" max="220"
                    placeholder="e.g. 135" value={hrInput}
                    onChange={e => setHrInput(e.target.value)} />
                </div>
              </div>

              {previewZone && (
                <div style={{ marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontSize: "0.65rem", color: "var(--text-3)", letterSpacing: "0.07em", textTransform: "uppercase" }}>Zone:</span>
                  <span className="ac-zone-pill" style={{ color: previewZone.color, borderColor: previewZone.color + "55", background: previewZone.color + "14" }}>
                    {previewZone.label}
                  </span>
                </div>
              )}

              <button className="ac-btn gr" onClick={addCardio} disabled={savingCardio}>
                {savingCardio ? "Saving…" : "+ Add Session"}
              </button>
            </div>

            {/* HR ZONES */}
            <div className="ac-panel">
              <div className="ac-panel-label">
                <span>
                  HR Zones · Max {maxHR} bpm
                  {todayZone && (
                    <span style={{ color: todayZone.color, marginLeft: "0.5rem" }}>
                      · Today: {todayZone.label}
                    </span>
                  )}
                </span>
                <button
                  className={`ac-icon-btn${editingZones ? " active" : ""}`}
                  onClick={editingZones ? cancelEditZones : startEditZones}
                  style={{ marginLeft: "auto" }}
                >
                  {editingZones ? "✕ cancel" : "✎ edit"}
                </button>
              </div>

              {!editingZones ? (
                /* display mode */
                <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                  {zones.map(z => {
                    const active = todayZone?.label === z.label;
                    return (
                      <div key={z.label} className="ac-zone-row"
                        style={active ? { background: z.color + "10", borderColor: z.color + "33" } : {}}
                      >
                        <div className="ac-zone-pip" style={{ background: z.color, boxShadow: active ? `0 0 6px ${z.color}` : "none" }} />
                        <span className="ac-zone-code" style={{ color: active ? z.color : "var(--text-3)" }}>{z.label}</span>
                        <span className="ac-zone-name" style={{ color: active ? "var(--text-1)" : "var(--text-2)" }}>
                          {z.lo}–{z.hi} bpm
                        </span>
                        <span className="ac-zone-range">
                          {Math.round((z.lo / maxHR) * 100)}–{Math.round((z.hi / maxHR) * 100)}%
                        </span>
                      </div>
                    );
                  })}
                  {avgHRToday && todayZone && (
                    <div style={{ marginTop: "0.5rem", fontSize: "0.73rem", color: todayZone.color, paddingLeft: "0.55rem" }}>
                      Today's avg: {avgHRToday} bpm — {todayZone.label}
                    </div>
                  )}
                </div>
              ) : (
                /* edit mode */
                <div>
                  <div className="ac-zone-edit-hint">
                    Set the lower BPM threshold for each zone. Zones must ascend.
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem", marginTop: "0.6rem" }}>
                    {zones.map((z, i) => (
                      <div key={z.label} className="ac-zone-edit-row">
                        <div className="ac-zone-pip" style={{ background: z.color }} />
                        <span className="ac-zone-code" style={{ color: z.color }}>{z.label}</span>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-2)" }}>
                          starts at
                        </div>
                        <input
                          className="ac-input zone-edit"
                          type="number"
                          min="40" max={maxHR}
                          value={editBounds?.[i] ?? ""}
                          onChange={e => {
                            const next = [...editBounds];
                            next[i] = e.target.value === "" ? "" : Number(e.target.value);
                            setEditBounds(next);
                          }}
                          placeholder="bpm"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="ac-inline-actions">
                    <button className="ac-inline-btn cancel" onClick={resetZones}>Reset defaults</button>
                    <button className="ac-inline-btn save" onClick={saveZones}>Save zones</button>
                  </div>
                </div>
              )}
            </div>

            {/* HISTORY */}
            <div className="ac-panel" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
              <div className="ac-tabs">
                <button className={`ac-tab${histTab === "cardio" ? " on-gr" : ""}`}
                  onClick={() => setHistTab("cardio")}>Cardio Log</button>
                <button className={`ac-tab${histTab === "steps"  ? " on-cr" : ""}`}
                  onClick={() => setHistTab("steps")}>Steps Log</button>
              </div>

              <div className="ac-hist-scroll">
                {histTab === "cardio" ? (
                  !recentCardio.length
                    ? <div className="ac-empty">No sessions yet</div>
                    : recentCardio.map(r => {
                      const t = CARDIO_TYPES.find(x => x.id === r.cardio_type) || CARDIO_TYPES[7];
                      const z = r.avg_hr ? getZone(r.avg_hr, zones) : null;
                      return (
                        <div key={r.id} className="ac-hist-row">
                          <div className="ac-hist-date">{shortDate(r.log_date)}</div>
                          <div className="ac-hist-main">
                            <div className="ac-hist-primary">
                              <span style={{ color: GREEN, fontFamily: "var(--font-display)", fontSize: "0.88rem" }}>
                                {r.minutes} min
                              </span>
                              <span style={{ fontSize: "0.72rem", color: "var(--text-3)" }}>
                                {t.icon} {t.label}
                              </span>
                            </div>
                            {r.avg_hr && (
                              <div className="ac-hist-secondary">
                                {r.avg_hr} bpm
                                {z && <span style={{ color: z.color }}> · {z.label}</span>}
                              </div>
                            )}
                          </div>
                          <button className="ac-del-btn" onClick={() => deleteCardio(r.id)}>del</button>
                        </div>
                      );
                    })
                ) : (
                  !recentSteps.length
                    ? <div className="ac-empty">No steps logged yet</div>
                    : recentSteps.map(r => {
                      const pct = stepsTarget ? Math.round((r.steps / stepsTarget) * 100) : null;
                      const hit = stepsTarget && r.steps >= stepsTarget;
                      return (
                        <div key={r.log_date} className="ac-hist-row">
                          <div className="ac-hist-date">{shortDate(r.log_date)}</div>
                          <div className="ac-hist-main">
                            <div className="ac-hist-primary">
                              <span style={{ color: hit ? GREEN : CRIMSON, fontFamily: "var(--font-display)", fontSize: "0.88rem" }}>
                                {r.steps.toLocaleString()}
                              </span>
                              {pct !== null && (
                                <span style={{ fontSize: "0.68rem", color: "var(--text-3)" }}>{pct}%</span>
                              )}
                              {hit && <span style={{ fontSize: "0.68rem", color: GREEN }}>✓</span>}
                            </div>
                            {stepsTarget && (
                              <div className="ac-progress-track" style={{ marginTop: "0.25rem" }}>
                                <div className="ac-progress-fill" style={{
                                  width: `${Math.min(100, (r.steps / stepsTarget) * 100)}%`,
                                  background: hit ? GREEN : CRIMSON,
                                }} />
                              </div>
                            )}
                          </div>
                          <button className="ac-del-btn" onClick={() => deleteSteps(r.log_date)}>del</button>
                        </div>
                      );
                    })
                )}
              </div>
            </div>

          </div>{/* end log col */}
        </div>
      </div>
    </>
  );
}
