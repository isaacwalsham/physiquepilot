/*
 * WeightTracking.jsx — Full Happy Scale-style weight tracking page
 *
 * ─── REQUIRED SQL MIGRATIONS ─────────────────────────────────────────────────
 * Run the following in your Supabase SQL editor before using this page:
 *
 *   ALTER TABLE public.weight_logs ADD COLUMN IF NOT EXISTS notes text;
 *   ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wt_goal_weight_kg numeric;
 *   ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wt_fresh_start_date date;
 *   ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wt_cards_hidden text[] DEFAULT '{}';
 *   ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wt_chart_compare_days integer DEFAULT 30;
 *   ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wt_prediction_mode text DEFAULT 'current';
 *   ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wt_commitment_rate_kg numeric DEFAULT 0.5;
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Area,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "../supabaseClient";
import {
  addDays,
  bmiCategory,
  bmiThresholds,
  calcBMI,
  calculateTrend,
  dateToDayX,
  dayXToISO,
  displayWeight,
  formatDisplayDate,
  getMilestoneProgress,
  getTenDayBest,
  kgToLb,
  lbToKg,
  linearRegression,
  round1,
  round2,
  stoneLbToKg,
  todayISO,
  weeklyRateKg,
} from "./weight/wt-utils";

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
/* ── Layout ── */
.wt-page { width: 100%; padding-bottom: 100px; }

.wt-section-label {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-family: var(--font-display);
  font-size: 0.65rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--accent-3);
  margin-bottom: 1.4rem;
}
.wt-section-label::before {
  content: "";
  display: block;
  width: 20px;
  height: 2px;
  background: var(--accent-3);
  flex-shrink: 0;
}

/* ── Tab bar ── */
.wt-tabs {
  display: flex;
  gap: 0.35rem;
  margin-bottom: 1.5rem;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: none;
}
.wt-tabs::-webkit-scrollbar { display: none; }
.wt-tab {
  font-family: var(--font-display);
  font-size: 0.62rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  padding: 0.4rem 0.9rem;
  border-radius: 999px;
  border: 1px solid var(--line-1);
  background: transparent;
  color: var(--text-3);
  cursor: pointer;
  transition: all var(--motion-fast);
  white-space: nowrap;
  flex-shrink: 0;
}
.wt-tab.active {
  background: linear-gradient(135deg, var(--accent-1), var(--accent-2));
  border-color: var(--accent-2);
  color: #fff;
  box-shadow: 0 0 12px rgba(181,21,60,0.4);
}
.wt-tab:hover:not(.active) {
  border-color: var(--line-2);
  color: var(--text-2);
}

/* ── Cards ── */
.wt-card {
  border: 1px solid var(--line-1);
  border-radius: var(--radius-md);
  background: var(--surface-1);
  overflow: hidden;
}
.wt-card-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.65rem 1rem;
  border-bottom: 1px solid var(--line-1);
  background: linear-gradient(90deg, rgba(138,15,46,0.18), rgba(138,15,46,0.06));
}
.wt-card-topbar-title {
  font-family: var(--font-display);
  font-size: 0.62rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--accent-3);
}
.wt-card-topbar-sub {
  font-family: var(--font-display);
  font-size: 0.58rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-3);
}

/* ── Stat cards grid ── */
.wt-stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.85rem;
  margin-bottom: 1.25rem;
}
.wt-stat-card {
  border: 1px solid var(--line-1);
  border-radius: var(--radius-md);
  background: var(--surface-1);
  padding: 1.15rem 1rem;
  text-align: center;
  position: relative;
  overflow: hidden;
  cursor: default;
}
.wt-stat-card::before {
  content: "";
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--accent-2), transparent);
  opacity: 0.45;
}
.wt-stat-value {
  font-family: var(--font-display);
  font-size: 1.65rem;
  font-weight: 700;
  line-height: 1;
  color: var(--text-1);
  letter-spacing: 0.02em;
  word-break: break-all;
}
.wt-stat-value.ok   { color: var(--ok); }
.wt-stat-value.bad  { color: var(--bad); }
.wt-stat-value.warn { color: var(--warn); }
.wt-stat-label {
  font-family: var(--font-display);
  font-size: 0.54rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-3);
  margin-top: 0.5rem;
}
.wt-stat-sub {
  font-size: 0.7rem;
  color: var(--text-3);
  margin-top: 0.3rem;
}
.wt-bmi-badge {
  display: inline-block;
  font-family: var(--font-display);
  font-size: 0.52rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 0.18rem 0.5rem;
  border-radius: 999px;
  margin-top: 0.4rem;
}

/* Gear / visibility toggle */
.wt-gear-row {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 0.6rem;
}
.wt-gear-btn {
  background: transparent;
  border: 1px solid var(--line-1);
  border-radius: var(--radius-sm);
  color: var(--text-3);
  padding: 0.3rem 0.6rem;
  cursor: pointer;
  font-size: 0.85rem;
  transition: all var(--motion-fast);
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-family: var(--font-display);
  font-size: 0.56rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.wt-gear-btn:hover { border-color: var(--line-2); color: var(--text-1); }

.wt-visibility-panel {
  border: 1px solid var(--line-1);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  padding: 0.75rem 1rem;
  margin-bottom: 0.85rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.wt-vis-toggle {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-family: var(--font-display);
  font-size: 0.56rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-2);
  cursor: pointer;
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  border: 1px solid var(--line-1);
  background: transparent;
  transition: all var(--motion-fast);
}
.wt-vis-toggle.hidden { color: var(--text-3); opacity: 0.5; }
.wt-vis-toggle:hover { border-color: var(--line-2); }

/* ── Milestone arc ── */
.wt-milestone-section {
  margin-top: 1.25rem;
  border: 1px solid var(--line-1);
  border-radius: var(--radius-md);
  background: var(--surface-1);
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 2rem;
}
.wt-milestone-arc-wrap {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.wt-milestone-info {
  flex: 1;
}
.wt-milestone-label {
  font-family: var(--font-display);
  font-size: 0.6rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--accent-3);
  margin-bottom: 0.4rem;
}
.wt-milestone-pct {
  font-family: var(--font-display);
  font-size: 2.2rem;
  font-weight: 700;
  color: var(--text-1);
  line-height: 1;
}
.wt-milestone-sub {
  font-size: 0.78rem;
  color: var(--text-3);
  margin-top: 0.4rem;
}

/* ── Chart controls ── */
.wt-chart-wrap {
  padding: 0.75rem 0.25rem 0.5rem 0;
  height: 280px;
}
.wt-range-pills {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}
.wt-pill {
  font-family: var(--font-display);
  font-size: 0.58rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  padding: 0.3rem 0.65rem;
  border-radius: 999px;
  border: 1px solid var(--line-1);
  background: transparent;
  color: var(--text-3);
  cursor: pointer;
  transition: all var(--motion-fast);
}
.wt-pill.active {
  background: linear-gradient(135deg, var(--accent-1), var(--accent-2));
  border-color: var(--accent-2);
  color: #fff;
  box-shadow: 0 0 10px rgba(181,21,60,0.35);
}
.wt-pill:hover:not(.active) { border-color: var(--line-2); color: var(--text-2); }

.wt-chart-controls {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}
.wt-chart-controls-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.wt-control-label {
  font-family: var(--font-display);
  font-size: 0.52rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-3);
}

/* ── Logbook ── */
.wt-logbook-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.85rem;
}
.wt-log-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.7rem 1rem;
  border-bottom: 1px solid var(--line-1);
  gap: 0.75rem;
  transition: background var(--motion-fast);
  cursor: pointer;
  position: relative;
}
.wt-log-row:last-child { border-bottom: none; }
.wt-log-row:hover { background: rgba(138,15,46,0.07); }
.wt-log-date {
  font-family: var(--font-display);
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  color: var(--text-3);
  min-width: 88px;
  flex-shrink: 0;
}
.wt-log-weight {
  font-family: var(--font-display);
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-1);
  flex: 1;
}
.wt-log-trend {
  font-size: 0.75rem;
  color: var(--text-3);
  min-width: 60px;
  text-align: right;
  flex-shrink: 0;
}
.wt-log-delta {
  font-size: 0.72rem;
  min-width: 52px;
  text-align: right;
  flex-shrink: 0;
}
.wt-log-delta.up { color: var(--bad); }
.wt-log-delta.down { color: var(--ok); }
.wt-log-badges {
  display: flex;
  gap: 0.25rem;
  align-items: center;
  flex-shrink: 0;
}
.wt-badge-note {
  font-size: 0.7rem;
  opacity: 0.6;
}
.wt-badge-best {
  font-size: 0.7rem;
}

/* Context menu */
.wt-ctx-menu {
  position: fixed;
  background: var(--surface-2);
  border: 1px solid var(--line-2);
  border-radius: var(--radius-sm);
  z-index: 9900;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(0,0,0,0.5);
  min-width: 130px;
}
.wt-ctx-item {
  display: block;
  width: 100%;
  padding: 0.65rem 1rem;
  background: transparent;
  border: none;
  color: var(--text-2);
  font-family: var(--font-display);
  font-size: 0.6rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  text-align: left;
  cursor: pointer;
  transition: background var(--motion-fast);
}
.wt-ctx-item:hover { background: rgba(138,15,46,0.12); color: var(--text-1); }
.wt-ctx-item.danger { color: var(--bad); }
.wt-ctx-item.danger:hover { background: rgba(255,79,115,0.1); }

/* Fresh start section */
.wt-fresh-section {
  margin-top: 1.25rem;
  padding: 1rem 1.1rem;
  border: 1px solid var(--line-1);
  border-radius: var(--radius-md);
  background: var(--surface-1);
}
.wt-fresh-banner {
  font-size: 0.75rem;
  color: var(--warn);
  background: rgba(229,161,0,0.06);
  border: 1px solid rgba(229,161,0,0.2);
  border-radius: var(--radius-sm);
  padding: 0.5rem 0.75rem;
  margin-bottom: 0.75rem;
}

/* ── Predict tab ── */
.wt-predict-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1.25rem;
}
.wt-predict-card {
  border: 1px solid var(--line-1);
  border-radius: var(--radius-md);
  background: var(--surface-1);
  padding: 1.25rem;
}
.wt-predict-title {
  font-family: var(--font-display);
  font-size: 0.62rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--accent-3);
  margin-bottom: 1rem;
}
.wt-predict-result {
  margin-top: 0.85rem;
  padding: 0.75rem;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  border: 1px solid var(--line-1);
  font-size: 0.85rem;
  color: var(--text-1);
  line-height: 1.5;
}
.wt-predict-result.ok { border-color: rgba(40,183,141,0.3); background: rgba(40,183,141,0.06); }
.wt-predict-result.bad { border-color: rgba(255,79,115,0.3); background: rgba(255,79,115,0.06); }
.wt-predict-result.warn { border-color: rgba(229,161,0,0.3); background: rgba(229,161,0,0.06); }

/* ── Modal ── */
.wt-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.72);
  z-index: 9000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}
.wt-modal {
  background: var(--surface-2);
  border: 1px solid var(--line-2);
  border-radius: var(--radius-lg);
  padding: 1.75rem;
  width: 100%;
  max-width: 400px;
  position: relative;
  box-shadow: 0 20px 60px rgba(0,0,0,0.6);
}
.wt-modal-title {
  font-family: var(--font-display);
  font-size: 0.7rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--accent-3);
  margin-bottom: 1.25rem;
}
.wt-modal-fields {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}
.wt-field-label {
  font-family: var(--font-display);
  font-size: 0.55rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-3);
  margin-bottom: 0.35rem;
}
.wt-modal-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1.25rem;
}
.wt-modal-actions .wt-btn-primary { flex: 1; }

/* ── Buttons ── */
.wt-btn-primary {
  padding: 0.7rem 1rem;
  border-radius: var(--radius-sm);
  background: linear-gradient(135deg, var(--accent-1) 0%, var(--accent-2) 60%, var(--accent-3) 100%);
  color: #fff;
  border: none;
  font-family: var(--font-display);
  font-size: 0.62rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(181,21,60,0.35);
  transition: all var(--motion-fast);
}
.wt-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.wt-btn-primary:hover:not(:disabled) {
  box-shadow: 0 6px 20px rgba(222,41,82,0.45);
  transform: translateY(-1px);
}
.wt-btn-ghost {
  padding: 0.5rem 0.85rem;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-2);
  border: 1px solid var(--line-1);
  font-family: var(--font-display);
  font-size: 0.58rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all var(--motion-fast);
}
.wt-btn-ghost:hover { border-color: var(--line-2); color: var(--text-1); }
.wt-btn-danger {
  padding: 0.5rem 0.85rem;
  border-radius: var(--radius-sm);
  background: rgba(255,79,115,0.08);
  color: var(--bad);
  border: 1px solid rgba(255,79,115,0.28);
  font-family: var(--font-display);
  font-size: 0.58rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all var(--motion-fast);
}
.wt-btn-danger:hover { background: rgba(255,79,115,0.16); border-color: var(--bad); }

/* ── Inputs ── */
.wt-input {
  background: rgba(9,5,6,0.9) !important;
  border: 1px solid var(--line-1) !important;
  color: var(--text-1) !important;
  border-radius: var(--radius-sm) !important;
  padding: 0.6rem 0.8rem !important;
  width: 100%;
  font-family: var(--font-body);
  font-size: 0.95rem;
  box-sizing: border-box;
  transition: border-color var(--motion-fast), box-shadow var(--motion-fast);
}
.wt-input:focus {
  outline: none !important;
  border-color: var(--accent-3) !important;
  box-shadow: 0 0 0 2px rgba(222,41,82,0.28) !important;
}
.wt-input-row {
  display: flex;
  gap: 0.5rem;
}
.wt-input-row .wt-input { flex: 1; }
.wt-textarea {
  resize: vertical;
  min-height: 72px;
}

/* ── FAB ── */
.wt-fab {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--accent-1), var(--accent-3));
  border: none;
  color: #fff;
  font-size: 1.55rem;
  cursor: pointer;
  box-shadow: 0 6px 20px rgba(181,21,60,0.5);
  transition: all var(--motion-fast);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 800;
}
.wt-fab:hover {
  transform: scale(1.08);
  box-shadow: 0 8px 28px rgba(222,41,82,0.6);
}

/* ── Toast ── */
.wt-toast {
  position: fixed;
  bottom: 5.5rem;
  left: 50%;
  transform: translateX(-50%) translateY(0);
  background: var(--surface-2);
  border: 1px solid var(--line-2);
  border-radius: var(--radius-md);
  padding: 0.75rem 1.25rem;
  font-family: var(--font-display);
  font-size: 0.65rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-1);
  box-shadow: 0 8px 24px rgba(0,0,0,0.5);
  z-index: 9500;
  animation: wt-toast-in var(--motion-med) ease both;
  white-space: nowrap;
}
.wt-toast.fade-out { animation: wt-toast-out var(--motion-med) ease both; }
@keyframes wt-toast-in {
  from { opacity: 0; transform: translateX(-50%) translateY(12px); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0); }
}
@keyframes wt-toast-out {
  from { opacity: 1; transform: translateX(-50%) translateY(0); }
  to   { opacity: 0; transform: translateX(-50%) translateY(-8px); }
}

/* ── Loading / empty ── */
.wt-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  font-family: var(--font-display);
  font-size: 0.68rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--text-3);
}
.wt-empty {
  padding: 2rem 1rem;
  text-align: center;
  color: var(--text-3);
  font-family: var(--font-display);
  font-size: 0.62rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.wt-error {
  font-size: 0.8rem;
  color: var(--bad);
  padding: 0.5rem 0.75rem;
  border: 1px solid rgba(255,79,115,0.3);
  border-radius: var(--radius-sm);
  background: rgba(255,79,115,0.06);
  margin-bottom: 0.75rem;
}

/* ── Responsive ── */
@media (max-width: 720px) {
  .wt-stats-grid { grid-template-columns: repeat(2, 1fr); }
  .wt-milestone-section { flex-direction: column; align-items: flex-start; gap: 1rem; }
  .wt-predict-grid { grid-template-columns: 1fr; }
  .wt-chart-controls { flex-direction: column; }
}
@media (max-width: 480px) {
  .wt-stats-grid { grid-template-columns: repeat(2, 1fr); gap: 0.6rem; }
  .wt-stat-value { font-size: 1.3rem; }
  .wt-fab { bottom: 1.25rem; right: 1.25rem; }
  .wt-log-trend { display: none; }
}
`;

// ─── Custom tooltip for Recharts ──────────────────────────────────────────────
function ChartTooltip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null;
  const raw = payload.find((p) => p.dataKey === "weight_kg");
  const trend = payload.find((p) => p.dataKey === "trend");
  return (
    <div
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--line-2)",
        borderRadius: "var(--radius-sm)",
        padding: "0.65rem 0.9rem",
        fontSize: "0.75rem",
        color: "var(--text-2)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "0.58rem",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--text-3)",
          marginBottom: "0.35rem",
        }}
      >
        {label}
      </div>
      {raw && (
        <div>
          Raw: <span style={{ color: "var(--text-1)", fontWeight: 600 }}>{displayWeight(raw.value, unit)}</span>
        </div>
      )}
      {trend && (
        <div>
          Trend:{" "}
          <span style={{ color: "var(--accent-3)", fontWeight: 600 }}>{displayWeight(trend.value, unit)}</span>
        </div>
      )}
    </div>
  );
}

// ─── useWeightData hook ───────────────────────────────────────────────────────
function useWeightData() {
  const [logs, setLogs] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await (async () => { const { data: s } = await supabase.auth.getSession(); return { data: { user: s?.session?.user } }; })();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);

      const [logsRes, profileRes] = await Promise.all([
        supabase
          .from("weight_logs")
          .select("*")
          .eq("user_id", user.id)
          .order("log_date", { ascending: true }),
        supabase
          .from("profiles")
          .select(
            "unit_system, goal_weight_kg, starting_weight_kg, height_cm, " +
            "wt_goal_weight_kg, wt_fresh_start_date, wt_cards_hidden, " +
            "wt_chart_compare_days, wt_prediction_mode, wt_commitment_rate_kg"
          )
          .eq("id", user.id)
          .single(),
      ]);

      setLogs(logsRes.data || []);
      setProfile(profileRes.data || {});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Apply fresh start filter and compute trend
  const { logsWithTrend, filteredLogs } = useMemo(() => {
    if (!logs.length) return { logsWithTrend: [], filteredLogs: [] };
    const freshDate = profile?.wt_fresh_start_date;
    const filtered = freshDate
      ? logs.filter((e) => e.log_date >= freshDate)
      : logs;
    const withTrend = calculateTrend(filtered);
    return { logsWithTrend: withTrend, filteredLogs: filtered };
  }, [logs, profile]);

  const unit = profile?.unit_system || "metric";

  const addLog = useCallback(
    async (date, weightKg, notes = "") => {
      if (!userId) return;
      await supabase.from("weight_logs").upsert(
        {
          user_id: userId,
          log_date: date,
          weight_kg: weightKg,
          notes: notes || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,log_date" }
      );
      await fetchData();
    },
    [userId, fetchData]
  );

  const updateLog = useCallback(
    async (id, weightKg, notes = "") => {
      await supabase
        .from("weight_logs")
        .update({
          weight_kg: weightKg,
          notes: notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      await fetchData();
    },
    [fetchData]
  );

  const deleteLog = useCallback(
    async (id) => {
      await supabase.from("weight_logs").delete().eq("id", id);
      await fetchData();
    },
    [fetchData]
  );

  const updateProfile = useCallback(
    async (patch) => {
      if (!userId) return;
      setProfile((prev) => ({ ...prev, ...patch }));
      await supabase.from("profiles").update(patch).eq("id", userId);
    },
    [userId]
  );

  return {
    logs,
    logsWithTrend,
    filteredLogs,
    loading,
    profile,
    unit,
    addLog,
    updateLog,
    deleteLog,
    updateProfile,
    userId,
    refetch: fetchData,
  };
}

// ─── Milestone SVG arc ────────────────────────────────────────────────────────
function MilestoneArc({ progress = 0, size = 120 }) {
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.385;
  const SWEEP = 270; // degrees
  const startAngle = -225; // degrees from positive x-axis
  const endAngle = startAngle + SWEEP;

  const toRad = (deg) => (deg * Math.PI) / 180;
  const polarToXY = (angleDeg) => ({
    x: cx + R * Math.cos(toRad(angleDeg)),
    y: cy + R * Math.sin(toRad(angleDeg)),
  });

  const start = polarToXY(startAngle);
  const end = polarToXY(endAngle);

  // Track path (background)
  const trackPath = `M ${start.x} ${start.y} A ${R} ${R} 0 1 1 ${end.x} ${end.y}`;

  // Progress arc
  const clampedProgress = Math.min(1, Math.max(0, progress));
  const progressAngle = startAngle + SWEEP * clampedProgress;
  const progressEnd = polarToXY(progressAngle);
  const largeArc = SWEEP * clampedProgress > 180 ? 1 : 0;
  const progressPath = clampedProgress === 0
    ? ""
    : clampedProgress >= 1
    ? trackPath
    : `M ${start.x} ${start.y} A ${R} ${R} 0 ${largeArc} 1 ${progressEnd.x} ${progressEnd.y}`;

  const pct = Math.round(clampedProgress * 100);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <filter id="wt-arc-glow">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="wt-arc-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--accent-1)" />
          <stop offset="100%" stopColor="var(--accent-3)" />
        </linearGradient>
      </defs>
      {/* track */}
      <path
        d={trackPath}
        fill="none"
        stroke="var(--line-1)"
        strokeWidth={size * 0.075}
        strokeLinecap="round"
      />
      {/* progress */}
      {progressPath && (
        <path
          d={progressPath}
          fill="none"
          stroke="url(#wt-arc-grad)"
          strokeWidth={size * 0.075}
          strokeLinecap="round"
          filter="url(#wt-arc-glow)"
        />
      )}
      {/* center text */}
      <text
        x={cx}
        y={cy - 4}
        textAnchor="middle"
        fill="var(--text-1)"
        fontFamily="var(--font-display)"
        fontWeight="700"
        fontSize={size * 0.18}
      >
        {pct}%
      </text>
      <text
        x={cx}
        y={cy + size * 0.13}
        textAnchor="middle"
        fill="var(--text-3)"
        fontFamily="var(--font-display)"
        fontSize={size * 0.085}
        letterSpacing="0.06em"
        textTransform="uppercase"
      >
        DONE
      </text>
    </svg>
  );
}

// ─── LogEntryModal ────────────────────────────────────────────────────────────
function LogEntryModal({ entry, unit, onSave, onDelete, onClose }) {
  const isEdit = !!entry?.id;
  const [date, setDate] = useState(entry?.log_date || todayISO());
  const [kgVal, setKgVal] = useState(
    entry?.weight_kg ? String(round1(entry.weight_kg)) : ""
  );
  const [lbVal, setLbVal] = useState(
    entry?.weight_kg ? String(round1(kgToLb(entry.weight_kg))) : ""
  );
  const [stVal, setStVal] = useState(() => {
    if (!entry?.weight_kg) return "";
    return String(Math.floor(kgToLb(entry.weight_kg) / 14));
  });
  const [slbVal, setSlbVal] = useState(() => {
    if (!entry?.weight_kg) return "";
    const totalLb = kgToLb(entry.weight_kg);
    const st = Math.floor(totalLb / 14);
    return String(round1(totalLb - st * 14));
  });
  const [notes, setNotes] = useState(entry?.notes || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const getWeightKg = () => {
    if (unit === "imperial") {
      const v = parseFloat(lbVal);
      return isFinite(v) ? lbToKg(v) : null;
    }
    if (unit === "stone") {
      const s = parseFloat(stVal);
      const l = parseFloat(slbVal);
      if (!isFinite(s) && !isFinite(l)) return null;
      return stoneLbToKg(isFinite(s) ? s : 0, isFinite(l) ? l : 0);
    }
    const v = parseFloat(kgVal);
    return isFinite(v) ? v : null;
  };

  const handleSave = async () => {
    const kg = getWeightKg();
    if (!kg || kg <= 0 || kg > 600) {
      setError("Please enter a valid weight.");
      return;
    }
    if (!date) { setError("Please pick a date."); return; }
    setSaving(true);
    setError("");
    try {
      if (isEdit) {
        await onSave(entry.id, kg, notes);
      } else {
        await onSave(date, kg, notes);
      }
      onClose();
    } catch (e) {
      setError(e.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this entry?")) return;
    setSaving(true);
    try {
      await onDelete(entry.id);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const stopProp = (e) => e.stopPropagation();

  return createPortal(
    <div className="wt-overlay" onClick={onClose}>
      <div className="wt-modal" onClick={stopProp}>
        <div className="wt-modal-title">
          {isEdit ? "Edit Entry" : "Log Weight"}
        </div>
        <div className="wt-modal-fields">
          {!isEdit && (
            <div>
              <div className="wt-field-label">Date</div>
              <input
                type="date"
                className="wt-input"
                value={date}
                max={todayISO()}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          )}
          {isEdit && (
            <div>
              <div className="wt-field-label">Date</div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-2)", padding: "0.4rem 0" }}>
                {formatDisplayDate(entry.log_date)}
              </div>
            </div>
          )}
          <div>
            <div className="wt-field-label">
              Weight{" "}
              {unit === "imperial" ? "(lb)" : unit === "stone" ? "(st / lb)" : "(kg)"}
            </div>
            {unit === "imperial" && (
              <input
                type="number"
                className="wt-input"
                placeholder="e.g. 182.5"
                value={lbVal}
                min={0}
                step={0.1}
                onChange={(e) => setLbVal(e.target.value)}
              />
            )}
            {unit === "stone" && (
              <div className="wt-input-row">
                <input
                  type="number"
                  className="wt-input"
                  placeholder="st"
                  value={stVal}
                  min={0}
                  step={1}
                  onChange={(e) => setStVal(e.target.value)}
                />
                <input
                  type="number"
                  className="wt-input"
                  placeholder="lb"
                  value={slbVal}
                  min={0}
                  max={13.9}
                  step={0.1}
                  onChange={(e) => setSlbVal(e.target.value)}
                />
              </div>
            )}
            {unit !== "imperial" && unit !== "stone" && (
              <input
                type="number"
                className="wt-input"
                placeholder="e.g. 82.5"
                value={kgVal}
                min={0}
                step={0.1}
                onChange={(e) => setKgVal(e.target.value)}
              />
            )}
          </div>
          <div>
            <div className="wt-field-label">Notes (optional)</div>
            <textarea
              className="wt-input wt-textarea"
              placeholder="How are you feeling? Any context..."
              value={notes}
              maxLength={280}
              onChange={(e) => setNotes(e.target.value)}
            />
            <div style={{ fontSize: "0.68rem", color: "var(--text-3)", textAlign: "right", marginTop: "0.2rem" }}>
              {notes.length}/280
            </div>
          </div>
          {error && <div className="wt-error">{error}</div>}
        </div>
        <div className="wt-modal-actions">
          {isEdit && (
            <button className="wt-btn-danger" onClick={handleDelete} disabled={saving}>
              Delete
            </button>
          )}
          <button className="wt-btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="wt-btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── MilestoneToast ───────────────────────────────────────────────────────────
function MilestoneToast({ message, onDone }) {
  const [fading, setFading] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setFading(true), 2600);
    const t2 = setTimeout(() => onDone(), 3200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);
  return createPortal(
    <div className={`wt-toast${fading ? " fade-out" : ""}`}>{message}</div>,
    document.body
  );
}

// ─── Context menu ─────────────────────────────────────────────────────────────
function ContextMenu({ x, y, onEdit, onDelete, onClose }) {
  useEffect(() => {
    const handler = () => onClose();
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [onClose]);

  return createPortal(
    <div className="wt-ctx-menu" style={{ left: x, top: y }}>
      <button className="wt-ctx-item" onClick={onEdit}>Edit</button>
      <button className="wt-ctx-item danger" onClick={onDelete}>Delete</button>
    </div>,
    document.body
  );
}

// ─── SummaryTab ───────────────────────────────────────────────────────────────
const CARD_DEFS = [
  { id: "latest",    label: "Latest" },
  { id: "trend",     label: "Trend" },
  { id: "total",     label: "Total Lost" },
  { id: "rate",      label: "Weekly Rate" },
  { id: "best",      label: "10-Day Best" },
  { id: "bmi",       label: "BMI" },
];

function SummaryTab({ data, onOpenLog }) {
  const { logsWithTrend, profile, unit, updateProfile } = data;
  const [showGear, setShowGear] = useState(false);

  const hiddenCards = useMemo(
    () => new Set(profile?.wt_cards_hidden || []),
    [profile]
  );

  const toggleCard = (id) => {
    const next = new Set(hiddenCards);
    next.has(id) ? next.delete(id) : next.add(id);
    updateProfile({ wt_cards_hidden: Array.from(next) });
  };

  const last = logsWithTrend[logsWithTrend.length - 1];
  const currentTrend = last?.trend;
  const latestRaw = last?.weight_kg;

  const goalKg = profile?.wt_goal_weight_kg ?? profile?.goal_weight_kg;
  const startKg = profile?.starting_weight_kg;

  const totalLost = startKg != null && currentTrend != null
    ? round2(startKg - currentTrend)
    : null;

  const rate = weeklyRateKg(logsWithTrend, 30);

  const tenDayBest = getTenDayBest(logsWithTrend);

  const bmi = profile?.height_cm && currentTrend
    ? calcBMI(currentTrend, profile.height_cm)
    : null;
  const bmiCat = bmi ? bmiCategory(bmi) : null;
  const bmiThr = profile?.height_cm ? bmiThresholds(profile.height_cm) : null;

  const milestoneData = goalKg != null && startKg != null && currentTrend != null
    ? getMilestoneProgress(startKg, goalKg, currentTrend)
    : null;

  const rateClass = !rate ? "" : rate < 0 ? "ok" : rate > 0 ? "bad" : "";

  const renderCard = (id) => {
    if (hiddenCards.has(id)) return null;
    switch (id) {
      case "latest":
        return (
          <div key="latest" className="wt-stat-card">
            <div className="wt-stat-value">{latestRaw != null ? displayWeight(latestRaw, unit, false) : "—"}</div>
            <div className="wt-stat-label">Latest</div>
            {unit !== "metric" && latestRaw != null && (
              <div className="wt-stat-sub">{displayWeight(latestRaw, unit)}</div>
            )}
          </div>
        );
      case "trend":
        return (
          <div key="trend" className="wt-stat-card">
            <div className="wt-stat-value">{currentTrend != null ? displayWeight(currentTrend, unit, false) : "—"}</div>
            <div className="wt-stat-label">Trend</div>
            <div className="wt-stat-sub">EWMA</div>
          </div>
        );
      case "total":
        return (
          <div key="total" className="wt-stat-card">
            <div className={`wt-stat-value ${totalLost == null ? "" : totalLost > 0 ? "ok" : totalLost < 0 ? "bad" : ""}`}>
              {totalLost == null
                ? "—"
                : totalLost > 0
                ? `−${displayWeight(totalLost, unit, false)}`
                : totalLost < 0
                ? `+${displayWeight(Math.abs(totalLost), unit, false)}`
                : "0"}
            </div>
            <div className="wt-stat-label">{totalLost != null && totalLost < 0 ? "Total Gained" : "Total Lost"}</div>
          </div>
        );
      case "rate":
        return (
          <div key="rate" className="wt-stat-card">
            <div className={`wt-stat-value ${rateClass}`}>
              {rate == null
                ? "—"
                : `${rate > 0 ? "+" : ""}${displayWeight(Math.abs(rate), unit, false)}/wk`}
            </div>
            <div className="wt-stat-label">Weekly Rate</div>
            <div className="wt-stat-sub">Last 30 days</div>
          </div>
        );
      case "best":
        return (
          <div key="best" className="wt-stat-card">
            <div className="wt-stat-value ok">
              {tenDayBest ? displayWeight(tenDayBest.trend, unit, false) : "—"}
            </div>
            <div className="wt-stat-label">Personal Best (10d)</div>
            {tenDayBest && (
              <div className="wt-stat-sub">{formatDisplayDate(tenDayBest.log_date)}</div>
            )}
          </div>
        );
      case "bmi":
        return (
          <div key="bmi" className="wt-stat-card">
            <div className="wt-stat-value">{bmi ?? "—"}</div>
            <div className="wt-stat-label">BMI</div>
            {bmiCat && (
              <div
                className="wt-bmi-badge"
                style={{ background: bmiCat.color + "22", color: bmiCat.color, border: `1px solid ${bmiCat.color}55` }}
              >
                {bmiCat.label}
              </div>
            )}
            {bmiThr && bmi < 25 && (
              <div className="wt-stat-sub">
                {round1(Math.abs((bmiThr.normal) - (currentTrend || 0)))} kg to Normal
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div>
      <div className="wt-gear-row">
        <button className="wt-gear-btn" onClick={() => setShowGear((v) => !v)}>
          ⚙ {showGear ? "Done" : "Customize"}
        </button>
      </div>
      {showGear && (
        <div className="wt-visibility-panel">
          {CARD_DEFS.map(({ id, label }) => (
            <button
              key={id}
              className={`wt-vis-toggle${hiddenCards.has(id) ? " hidden" : ""}`}
              onClick={() => toggleCard(id)}
            >
              {hiddenCards.has(id) ? "🙈" : "👁"} {label}
            </button>
          ))}
        </div>
      )}
      <div className="wt-stats-grid">
        {CARD_DEFS.map(({ id }) => renderCard(id))}
      </div>
      {milestoneData && (
        <div className="wt-milestone-section">
          <div className="wt-milestone-arc-wrap">
            <MilestoneArc progress={milestoneData.overallProgress} size={120} />
          </div>
          <div className="wt-milestone-info">
            <div className="wt-milestone-label">Journey Progress</div>
            <div className="wt-milestone-pct">
              Milestone {milestoneData.milestoneIndex + 1} of 10
            </div>
            <div className="wt-milestone-sub">
              {milestoneData.nextMilestoneWeightKg != null &&
                currentTrend != null && (
                  <>
                    {round1(Math.abs(currentTrend - milestoneData.nextMilestoneWeightKg))}{" "}
                    kg to milestone {milestoneData.milestoneIndex + 2}
                  </>
                )}
            </div>
            <div className="wt-milestone-sub" style={{ marginTop: "0.25rem", color: "var(--text-3)" }}>
              Goal: {goalKg != null ? displayWeight(goalKg, unit) : "—"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ChartTab ─────────────────────────────────────────────────────────────────
const RANGE_OPTIONS = [
  { label: "7D",  days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "1Y",  days: 365 },
  { label: "All", days: null },
];

const COMPARE_OPTIONS = [
  { label: "vs 7d",  days: 7 },
  { label: "vs 30d", days: 30 },
  { label: "vs 90d", days: 90 },
  { label: "vs 1y",  days: 365 },
];

function ChartTab({ data }) {
  const { logsWithTrend, profile, unit, updateProfile } = data;
  const [rangeDays, setRangeDays] = useState(90);

  const compareDays = profile?.wt_chart_compare_days ?? 30;

  const chartData = useMemo(() => {
    if (!logsWithTrend.length) return [];
    let slice = logsWithTrend;
    if (rangeDays != null) {
      const cutoff = addDays(todayISO(), -rangeDays);
      slice = logsWithTrend.filter((e) => e.log_date >= cutoff);
    }
    return slice.map((e) => ({
      ...e,
      displayDate: formatDisplayDate(e.log_date).slice(0, 6), // "14 Mar"
      weight_kg: round2(Number(e.weight_kg)),
      trend: round2(e.trend),
    }));
  }, [logsWithTrend, rangeDays]);

  // Compare value: find entry closest to N days ago and use its trend
  const compareValue = useMemo(() => {
    if (!logsWithTrend.length || !compareDays) return null;
    const compareDate = addDays(todayISO(), -compareDays);
    // find entry on or just before compareDate
    let closest = null;
    for (const e of logsWithTrend) {
      if (e.log_date <= compareDate) closest = e;
      else break;
    }
    return closest?.trend ?? null;
  }, [logsWithTrend, compareDays]);

  const yVals = chartData.flatMap((d) => [d.weight_kg, d.trend]).filter(Boolean);
  const yMin = yVals.length ? Math.floor(Math.min(...yVals) - 1) : 0;
  const yMax = yVals.length ? Math.ceil(Math.max(...yVals) + 1) : 100;

  const currentTrend = logsWithTrend[logsWithTrend.length - 1]?.trend;

  // Gain/loss reference areas
  const isGaining = compareValue != null && currentTrend != null && currentTrend > compareValue;
  const isLosing  = compareValue != null && currentTrend != null && currentTrend < compareValue;

  return (
    <div>
      <div className="wt-chart-controls">
        <div className="wt-chart-controls-group">
          <div className="wt-control-label">Time Range</div>
          <div className="wt-range-pills">
            {RANGE_OPTIONS.map(({ label, days }) => (
              <button
                key={label}
                className={`wt-pill${rangeDays === days ? " active" : ""}`}
                onClick={() => setRangeDays(days)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="wt-chart-controls-group">
          <div className="wt-control-label">Compare Period</div>
          <div className="wt-range-pills">
            {COMPARE_OPTIONS.map(({ label, days }) => (
              <button
                key={label}
                className={`wt-pill${compareDays === days ? " active" : ""}`}
                onClick={() => updateProfile({ wt_chart_compare_days: days })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="wt-empty">No data for this range</div>
      ) : (
        <div className="wt-card">
          <div className="wt-chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="wtLossGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#28b78d" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#28b78d" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="wtGainGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#de2952" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#de2952" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="displayDate"
                  tick={{ fill: "var(--text-3)", fontSize: 10, fontFamily: "var(--font-display)" }}
                  axisLine={{ stroke: "var(--line-1)" }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[yMin, yMax]}
                  tick={{ fill: "var(--text-3)", fontSize: 10, fontFamily: "var(--font-display)" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}`}
                  width={38}
                />
                <Tooltip
                  content={<ChartTooltip unit={unit} />}
                  cursor={{ stroke: "var(--line-2)", strokeWidth: 1 }}
                />
                {/* Gain/loss zone reference areas */}
                {compareValue != null && (
                  <>
                    {isGaining && (
                      <ReferenceArea
                        y1={compareValue}
                        y2={yMax}
                        fill="url(#wtGainGrad)"
                        ifOverflow="extendDomain"
                      />
                    )}
                    {isLosing && (
                      <ReferenceArea
                        y1={yMin}
                        y2={compareValue}
                        fill="url(#wtLossGrad)"
                        ifOverflow="extendDomain"
                      />
                    )}
                    <ReferenceLine
                      y={compareValue}
                      stroke="var(--line-2)"
                      strokeDasharray="4 3"
                      strokeWidth={1}
                      label={{
                        value: `${compareDays}d ago`,
                        position: "insideTopRight",
                        fill: "var(--text-3)",
                        fontSize: 9,
                        fontFamily: "var(--font-display)",
                      }}
                    />
                  </>
                )}
                {/* Raw dots */}
                <Line
                  dataKey="weight_kg"
                  stroke="var(--text-3)"
                  strokeWidth={0}
                  dot={{ r: 3, fill: "var(--text-3)", strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "var(--text-2)" }}
                  isAnimationActive={false}
                  connectNulls={false}
                  name="Raw"
                />
                {/* Trend line */}
                <Line
                  dataKey="trend"
                  stroke="var(--accent-3)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5, fill: "var(--accent-3)" }}
                  type="monotone"
                  isAnimationActive={false}
                  name="Trend"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div style={{ padding: "0.5rem 1rem 0.75rem", display: "flex", gap: "1.25rem", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.68rem", color: "var(--text-3)", fontFamily: "var(--font-display)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              <span style={{ display: "inline-block", width: 16, height: 2, background: "var(--accent-3)", borderRadius: 2 }} />
              Trend
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.68rem", color: "var(--text-3)", fontFamily: "var(--font-display)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              <span style={{ display: "inline-block", width: 8, height: 8, background: "var(--text-3)", borderRadius: "50%" }} />
              Raw
            </div>
            {compareValue != null && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.68rem", color: isLosing ? "#28b78d" : isGaining ? "var(--accent-3)" : "var(--text-3)", fontFamily: "var(--font-display)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                {isLosing ? "▼ Loss zone" : isGaining ? "▲ Gain zone" : "Flat"}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── LogbookTab ───────────────────────────────────────────────────────────────
const DAY_FILTERS = ["All", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function LogbookTab({ data, onEditEntry }) {
  const { logsWithTrend, profile, unit, updateProfile } = data;
  const [filter, setFilter] = useState("All");
  const [ctxMenu, setCtxMenu] = useState(null); // { x, y, entry }

  const freshDate = profile?.wt_fresh_start_date;

  const reversed = useMemo(() => [...logsWithTrend].reverse(), [logsWithTrend]);

  const filtered = useMemo(() => {
    if (filter === "All") return reversed;
    if (filter === "Has Notes") return reversed.filter((e) => e.notes);
    if (filter === "Breakthroughs") {
      // entries where trend < all previous entries
      return reversed.filter((e) => {
        const idx = logsWithTrend.findIndex((x) => x.id === e.id);
        if (idx <= 0) return false;
        const prev = logsWithTrend.slice(0, idx);
        return prev.every((p) => e.trend <= p.trend);
      });
    }
    // Day of week
    return reversed.filter((e) => {
      const [y, m, d] = e.log_date.split("-").map(Number);
      const dayName = DAY_NAMES[new Date(y, m - 1, d).getDay()];
      return dayName === filter;
    });
  }, [reversed, filter, logsWithTrend]);

  const tenDayBest = getTenDayBest(logsWithTrend);

  const setFreshDate = (date) => updateProfile({ wt_fresh_start_date: date || null });

  const hiddenCount = freshDate
    ? data.logs.filter((e) => e.log_date < freshDate).length
    : 0;

  return (
    <div>
      {/* Filter bar */}
      <div className="wt-logbook-header">
        {["All", "Has Notes", "Breakthroughs", ...DAY_NAMES].map((f) => (
          <button
            key={f}
            className={`wt-pill${filter === f ? " active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {filtered.length === 0 && <div className="wt-empty">No entries match this filter</div>}

      {filtered.length > 0 && (
        <div className="wt-card">
          {filtered.map((entry, i) => {
            // Find previous entry in the full (non-reversed) array
            const fullIdx = logsWithTrend.findIndex((e) => e.id === entry.id);
            const prev = fullIdx > 0 ? logsWithTrend[fullIdx - 1] : null;
            const delta = prev && entry.weight_kg != null && prev.weight_kg != null
              ? round2(Number(entry.weight_kg) - Number(prev.weight_kg))
              : null;
            const isBest = tenDayBest?.id === entry.id;

            return (
              <div
                key={entry.id}
                className="wt-log-row"
                onClick={() => onEditEntry(entry)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setCtxMenu({ x: e.clientX, y: e.clientY, entry });
                }}
              >
                <div className="wt-log-date">{formatDisplayDate(entry.log_date)}</div>
                <div className="wt-log-weight">{displayWeight(Number(entry.weight_kg), unit)}</div>
                <div className="wt-log-trend" title="Trend">
                  {entry.trend != null ? `≈ ${displayWeight(entry.trend, unit)}` : ""}
                </div>
                {delta != null && (
                  <div className={`wt-log-delta ${delta > 0 ? "up" : delta < 0 ? "down" : ""}`}>
                    {delta > 0 ? `▲+${delta}` : delta < 0 ? `▼${delta}` : "—"}
                  </div>
                )}
                <div className="wt-log-badges">
                  {entry.notes && <span className="wt-badge-note" title={entry.notes}>📝</span>}
                  {isBest && <span className="wt-badge-best" title="10-day best">🏆</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Context menu */}
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          onEdit={() => { onEditEntry(ctxMenu.entry); setCtxMenu(null); }}
          onDelete={async () => {
            if (window.confirm("Delete this entry?")) {
              await data.deleteLog(ctxMenu.entry.id);
            }
            setCtxMenu(null);
          }}
          onClose={() => setCtxMenu(null)}
        />
      )}

      {/* Fresh start section */}
      <div className="wt-fresh-section">
        <div style={{ fontFamily: "var(--font-display)", fontSize: "0.6rem", letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--accent-3)", marginBottom: "0.75rem" }}>
          Fresh Start
        </div>
        {freshDate && hiddenCount > 0 && (
          <div className="wt-fresh-banner">
            Showing entries from {formatDisplayDate(freshDate)} onwards — {hiddenCount} entr{hiddenCount === 1 ? "y" : "ies"} hidden
          </div>
        )}
        <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="date"
            className="wt-input"
            style={{ maxWidth: 180 }}
            value={freshDate || ""}
            max={todayISO()}
            onChange={(e) => setFreshDate(e.target.value)}
          />
          {freshDate && (
            <button className="wt-btn-ghost" onClick={() => setFreshDate(null)}>
              Reset
            </button>
          )}
        </div>
        <div style={{ marginTop: "0.5rem", fontSize: "0.72rem", color: "var(--text-3)" }}>
          Calculations (trend, rate, BMI) use only entries from this date onwards. Old entries stay in the database.
        </div>
      </div>
    </div>
  );
}

// ─── PredictTab ───────────────────────────────────────────────────────────────
const PREDICT_MODES = [
  { id: "current",    label: "Current Rate" },
  { id: "overall",    label: "Overall Rate" },
  { id: "commitment", label: "My Commitment" },
];

function buildRegression(logsWithTrend, mode, commitmentKgWeek) {
  if (!logsWithTrend.length) return null;
  let entries = logsWithTrend;

  if (mode === "current") {
    const cutoff = addDays(todayISO(), -30);
    entries = logsWithTrend.filter((e) => e.log_date >= cutoff);
    if (entries.length < 2) entries = logsWithTrend.slice(-10);
  }

  const points = entries.map((e) => ({
    x: dateToDayX(e.log_date),
    y: e.trend,
  }));

  if (mode === "commitment") {
    const slopePerDay = (commitmentKgWeek ?? 0.5) / 7;
    const lastEntry = logsWithTrend[logsWithTrend.length - 1];
    const lastX = dateToDayX(lastEntry.log_date);
    const lastY = lastEntry.trend;
    const intercept = lastY - slopePerDay * lastX;
    return {
      slope: -Math.abs(slopePerDay), // commitment = losing
      intercept,
      predictAt: (dayX) => intercept + (-Math.abs(slopePerDay)) * dayX,
      predictDay: (targetKg) => {
        const s = -Math.abs(slopePerDay);
        if (s === 0) return null;
        return (targetKg - intercept) / s;
      },
    };
  }

  return linearRegression(points);
}

function PredictTab({ data }) {
  const { logsWithTrend, profile, unit, updateProfile } = data;

  const savedMode = profile?.wt_prediction_mode || "current";
  const savedCommitment = profile?.wt_commitment_rate_kg ?? 0.5;

  const [goalWeight, setGoalWeight] = useState(
    () => String(round1(profile?.wt_goal_weight_kg || profile?.goal_weight_kg || ""))
  );
  const [targetDate, setTargetDate] = useState(() => addDays(todayISO(), 90));
  const [mode, setMode] = useState(savedMode);
  const [commitment, setCommitment] = useState(String(savedCommitment));

  const regression = useMemo(
    () => buildRegression(logsWithTrend, mode, parseFloat(commitment) || 0.5),
    [logsWithTrend, mode, commitment]
  );

  // Goal prediction
  const goalPrediction = useMemo(() => {
    if (!regression || !goalWeight) return null;
    const targetKg = parseFloat(goalWeight);
    if (!isFinite(targetKg)) return null;
    const dayX = regression.predictDay(targetKg);
    if (dayX == null) return { type: "flat" };
    const iso = dayXToISO(Math.round(dayX));
    if (iso <= todayISO()) return { type: "reached", iso };
    return { type: "future", iso };
  }, [regression, goalWeight]);

  // Date prediction
  const datePrediction = useMemo(() => {
    if (!regression || !targetDate) return null;
    const dayX = dateToDayX(targetDate);
    const predicted = regression.predictAt(dayX);
    return { weight: round2(predicted) };
  }, [regression, targetDate]);

  // Projection chart data
  const projectionData = useMemo(() => {
    if (!logsWithTrend.length || !regression) return [];
    const last = logsWithTrend[logsWithTrend.length - 1];
    const startDayX = dateToDayX(last.log_date);
    const endDayX = startDayX + 120;

    const history = logsWithTrend.slice(-30).map((e) => ({
      displayDate: formatDisplayDate(e.log_date).slice(0, 6),
      trend: e.trend,
      projected: null,
    }));

    const projection = [];
    for (let dx = startDayX; dx <= endDayX; dx += 3) {
      const iso = dayXToISO(dx);
      projection.push({
        displayDate: formatDisplayDate(iso).slice(0, 6),
        trend: null,
        projected: round2(regression.predictAt(dx)),
      });
    }

    return [...history, ...projection];
  }, [logsWithTrend, regression]);

  const yVals = projectionData
    .flatMap((d) => [d.trend, d.projected])
    .filter((v) => v != null);
  const yMin = yVals.length ? Math.floor(Math.min(...yVals) - 1) : 0;
  const yMax = yVals.length ? Math.ceil(Math.max(...yVals) + 2) : 100;

  const goalResultClass = !goalPrediction
    ? ""
    : goalPrediction.type === "reached"
    ? "ok"
    : goalPrediction.type === "flat"
    ? "warn"
    : regression && regression.slope > 0.001
    ? "bad"
    : "ok";

  return (
    <div>
      {/* Mode selector */}
      <div style={{ marginBottom: "1rem" }}>
        <div className="wt-control-label" style={{ marginBottom: "0.5rem" }}>Prediction Mode</div>
        <div className="wt-range-pills">
          {PREDICT_MODES.map(({ id, label }) => (
            <button
              key={id}
              className={`wt-pill${mode === id ? " active" : ""}`}
              onClick={() => {
                setMode(id);
                updateProfile({ wt_prediction_mode: id });
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {mode === "commitment" && (
          <div style={{ marginTop: "0.75rem", display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <span className="wt-control-label">Weekly loss commitment:</span>
            <input
              type="number"
              className="wt-input"
              style={{ maxWidth: 90 }}
              value={commitment}
              min={0}
              step={0.1}
              onChange={(e) => {
                setCommitment(e.target.value);
                const v = parseFloat(e.target.value);
                if (isFinite(v) && v >= 0) updateProfile({ wt_commitment_rate_kg: v });
              }}
            />
            <span style={{ fontSize: "0.78rem", color: "var(--text-3)" }}>kg/wk</span>
          </div>
        )}
      </div>

      <div className="wt-predict-grid">
        {/* Card 1: When will I reach goal? */}
        <div className="wt-predict-card">
          <div className="wt-predict-title">When will I reach my goal?</div>
          <div>
            <div className="wt-field-label">Target Weight</div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                type="number"
                className="wt-input"
                value={goalWeight}
                min={0}
                step={0.1}
                onChange={(e) => {
                  setGoalWeight(e.target.value);
                  const v = parseFloat(e.target.value);
                  if (isFinite(v)) updateProfile({ wt_goal_weight_kg: v });
                }}
              />
              <span style={{ fontSize: "0.78rem", color: "var(--text-3)", flexShrink: 0 }}>kg</span>
            </div>
          </div>
          {goalPrediction && (
            <div className={`wt-predict-result ${goalResultClass}`}>
              {goalPrediction.type === "reached" && (
                <>Already reached (trend was at goal around {formatDisplayDate(goalPrediction.iso)})</>
              )}
              {goalPrediction.type === "flat" && (
                <>Rate is flat — no prediction possible</>
              )}
              {goalPrediction.type === "future" && regression && regression.slope > 0.001 && (
                <>Not on track — currently gaining weight</>
              )}
              {goalPrediction.type === "future" && regression && regression.slope <= 0.001 && (
                <>
                  You&rsquo;ll reach{" "}
                  <strong>{displayWeight(parseFloat(goalWeight), unit)}</strong> by{" "}
                  <strong>{formatDisplayDate(goalPrediction.iso)}</strong>
                  <div style={{ marginTop: "0.35rem", fontSize: "0.75rem", opacity: 0.75 }}>
                    {Math.max(0, Math.round(daysBetween(todayISO(), goalPrediction.iso)))} days from today
                  </div>
                </>
              )}
            </div>
          )}
          {!goalPrediction && !goalWeight && (
            <div className="wt-predict-result">Enter a target weight above</div>
          )}
        </div>

        {/* Card 2: What will I weigh on a date? */}
        <div className="wt-predict-card">
          <div className="wt-predict-title">What will I weigh on a date?</div>
          <div>
            <div className="wt-field-label">Future Date</div>
            <input
              type="date"
              className="wt-input"
              value={targetDate}
              min={addDays(todayISO(), 1)}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </div>
          {datePrediction && (
            <div className="wt-predict-result ok">
              On <strong>{formatDisplayDate(targetDate)}</strong> you&rsquo;ll weigh approximately{" "}
              <strong>{displayWeight(datePrediction.weight, unit)}</strong>
            </div>
          )}
        </div>
      </div>

      {/* Projection chart */}
      {projectionData.length > 0 && (
        <div className="wt-card">
          <div className="wt-card-topbar">
            <div className="wt-card-topbar-title">Projection</div>
            <div className="wt-card-topbar-sub">Last 30 days + 120-day forecast</div>
          </div>
          <div className="wt-chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={projectionData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <XAxis
                  dataKey="displayDate"
                  tick={{ fill: "var(--text-3)", fontSize: 10, fontFamily: "var(--font-display)" }}
                  axisLine={{ stroke: "var(--line-1)" }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[yMin, yMax]}
                  tick={{ fill: "var(--text-3)", fontSize: 10, fontFamily: "var(--font-display)" }}
                  axisLine={false}
                  tickLine={false}
                  width={38}
                />
                <Tooltip
                  content={<ChartTooltip unit={unit} />}
                  cursor={{ stroke: "var(--line-2)", strokeWidth: 1 }}
                />
                <Line
                  dataKey="trend"
                  stroke="var(--accent-3)"
                  strokeWidth={2}
                  dot={false}
                  type="monotone"
                  isAnimationActive={false}
                  connectNulls={false}
                />
                <Line
                  dataKey="projected"
                  stroke="var(--accent-2)"
                  strokeWidth={1.5}
                  strokeDasharray="5 4"
                  dot={false}
                  type="monotone"
                  isAnimationActive={false}
                  connectNulls={false}
                />
                {goalWeight && isFinite(parseFloat(goalWeight)) && (
                  <ReferenceLine
                    y={parseFloat(goalWeight)}
                    stroke="var(--ok)"
                    strokeDasharray="3 3"
                    strokeWidth={1}
                    label={{
                      value: "Goal",
                      position: "insideTopRight",
                      fill: "var(--ok)",
                      fontSize: 10,
                      fontFamily: "var(--font-display)",
                    }}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div style={{ padding: "0.5rem 1rem 0.75rem", display: "flex", gap: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.68rem", color: "var(--text-3)", fontFamily: "var(--font-display)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              <span style={{ display: "inline-block", width: 16, height: 2, background: "var(--accent-3)", borderRadius: 2 }} />
              Actual Trend
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.68rem", color: "var(--text-3)", fontFamily: "var(--font-display)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              <span style={{ display: "inline-block", width: 16, height: 2, background: "var(--accent-2)", borderRadius: 2, borderTop: "2px dashed var(--accent-2)" }} />
              Projection
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ─── Main WeightTracking page ─────────────────────────────────────────────────
export default function WeightTracking() {
  const weightData = useWeightData();
  const { logsWithTrend, loading, addLog, updateLog, deleteLog } = weightData;

  const [activeTab, setActiveTab] = useState("summary");
  const [modalEntry, setModalEntry] = useState(null); // null = closed, false = new, object = edit
  const [toast, setToast] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
  };
  const clearToast = () => setToast(null);

  const handleAddLog = async (date, kg, notes) => {
    const prevBest = getTenDayBest(logsWithTrend);
    await addLog(date, kg, notes);
    // Check if new best — need to refetch and compare
    // We'll check after refetch by comparing toast trigger in a useEffect
    setToast(null); // reset first
    // We'll use a ref to store prev best and check after
    _prevBestRef.current = prevBest;
    _pendingBestCheck.current = true;
  };

  const _prevBestRef = useRef(null);
  const _pendingBestCheck = useRef(false);

  useEffect(() => {
    if (!_pendingBestCheck.current) return;
    _pendingBestCheck.current = false;
    const newBest = getTenDayBest(logsWithTrend);
    const prevBest = _prevBestRef.current;
    if (newBest && (!prevBest || newBest.trend < prevBest.trend)) {
      showToast("🏆 New 10-day best!");
    }
  }, [logsWithTrend]);

  const handleEditLog = async (id, kg, notes) => {
    await updateLog(id, kg, notes);
  };

  const openNewLog = () => setModalEntry(false);
  const openEditLog = (entry) => setModalEntry(entry);
  const closeModal = () => setModalEntry(null);

  const TABS = [
    { id: "summary",  label: "Summary" },
    { id: "chart",    label: "Chart" },
    { id: "logbook",  label: "Logbook" },
    { id: "predict",  label: "Predict" },
  ];

  return (
    <div className="wt-page">
      <style>{CSS}</style>

      <div className="wt-section-label">Weight Tracking</div>

      <div className="wt-tabs">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            className={`wt-tab${activeTab === id ? " active" : ""}`}
            onClick={() => setActiveTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="wt-loading">Loading…</div>
      ) : (
        <>
          {activeTab === "summary" && (
            <SummaryTab data={weightData} onOpenLog={openNewLog} />
          )}
          {activeTab === "chart" && <ChartTab data={weightData} />}
          {activeTab === "logbook" && (
            <LogbookTab data={weightData} onEditEntry={openEditLog} />
          )}
          {activeTab === "predict" && <PredictTab data={weightData} />}
        </>
      )}

      {/* FAB */}
      <button className="wt-fab" onClick={openNewLog} title="Log weight">
        +
      </button>

      {/* Modal */}
      {modalEntry !== null && (
        <LogEntryModal
          entry={modalEntry || null}
          unit={weightData.unit}
          onSave={modalEntry ? handleEditLog : handleAddLog}
          onDelete={deleteLog}
          onClose={closeModal}
        />
      )}

      {/* Toast */}
      {toast && <MilestoneToast message={toast} onDone={clearToast} />}
    </div>
  );
}
