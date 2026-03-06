import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { supabase } from "../supabaseClient";
import { apiFetch, API_URL } from "../lib/api";

const round1 = (n) => Math.round(n * 10) / 10;

const formatDate = (d) => {
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const todayLocalISO = () => formatDate(new Date());

const dayLabel = {
  training: "Training day",
  rest: "Rest day",
  high: "High day"
};

const kgToLb = (kg) => kg * 2.2046226218;

const diffDays = (a, b) => {
  const da = new Date(a);
  const db = new Date(b);
  da.setHours(0, 0, 0, 0);
  db.setHours(0, 0, 0, 0);
  return Math.floor((da.getTime() - db.getTime()) / (24 * 60 * 60 * 1000));
};

function inferTodayType(profile, todayIso) {
  const storedType = profile?.today_day_type_date === todayIso ? profile?.today_day_type : null;
  if (storedType) return storedType;

  const mode = profile?.split_mode || "fixed";
  if (mode === "rolling") {
    const start = profile?.rolling_start_date;
    const pattern = Array.isArray(profile?.rolling_pattern) ? profile.rolling_pattern : null;
    if (start && pattern && pattern.length) {
      const d = diffDays(todayIso, start);
      const idx = ((d % pattern.length) + pattern.length) % pattern.length;
      const v = String(pattern[idx] || "rest");
      if (v === "high") return "high";
      if (v === "training") return "training";
      return "rest";
    }
  }

  const trainingDays = Array.isArray(profile?.training_days) ? profile.training_days : [];
  const dayMap = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const todayShort = dayMap[new Date().getDay()];
  return trainingDays.includes(todayShort) ? "training" : "rest";
}

// ─── CSS ──────────────────────────────────────────────────────────────────────

const CSS = `
  .db-root {
    width: 100%;
    color: var(--text-1);
    font-family: var(--font-body);
  }

  /* ── Page header ── */
  .db-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-bottom: 1.75rem;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .db-header-left {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .db-section-label {
    font-family: var(--font-display);
    font-size: 0.65rem;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--accent-3);
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .db-section-label::before {
    content: "";
    display: inline-block;
    width: 20px;
    height: 1px;
    background: var(--accent-3);
    box-shadow: 0 0 6px var(--accent-2);
  }

  .db-page-title {
    font-family: var(--font-display);
    font-size: clamp(1.4rem, 3vw, 1.9rem);
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    margin: 0;
    color: var(--text-1);
    line-height: 1.1;
  }

  .db-date-badge {
    font-family: var(--font-display);
    font-size: 0.65rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-3);
    padding: 0.3rem 0.65rem;
    border: 1px solid var(--line-1);
    border-radius: var(--radius-sm);
    background: var(--surface-1);
    white-space: nowrap;
  }

  /* ── Error banner ── */
  .db-error {
    color: var(--bad);
    margin-bottom: 1rem;
    white-space: pre-wrap;
    font-size: 0.85rem;
    padding: 0.75rem 1rem;
    border: 1px solid rgba(255, 79, 115, 0.3);
    border-radius: var(--radius-sm);
    background: rgba(255, 79, 115, 0.06);
  }

  /* ── Loading state ── */
  .db-loading {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    color: var(--text-3);
    font-family: var(--font-display);
    font-size: 0.72rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    padding: 2rem 0;
  }

  .db-loading-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent-3);
    box-shadow: 0 0 8px var(--accent-2);
    animation: dbPulse 1.4s ease-in-out infinite;
  }

  @keyframes dbPulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.35; transform: scale(0.7); }
  }

  /* ── Card base ── */
  .db-card {
    border: 1px solid var(--line-1);
    border-radius: var(--radius-md);
    background: var(--surface-1);
    overflow: hidden;
    transition:
      border-color var(--motion-fast) ease,
      box-shadow var(--motion-med) ease;
  }

  .db-card:hover {
    border-color: var(--line-2);
    box-shadow: 0 0 20px rgba(181, 21, 60, 0.14);
  }

  /* ── Card topbar ── */
  .db-card-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.52rem 0.85rem;
    background: rgba(0, 0, 0, 0.22);
    border-bottom: 1px solid var(--line-1);
  }

  .db-card-topbar-left {
    display: flex;
    align-items: center;
    gap: 0.55rem;
  }

  .db-card-code {
    font-family: var(--font-display);
    font-size: 0.58rem;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--accent-3);
  }

  .db-card-title {
    font-family: var(--font-display);
    font-size: 0.62rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--text-3);
  }

  .db-status-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .db-status-dot--ok   { background: var(--ok);   box-shadow: 0 0 5px var(--ok); }
  .db-status-dot--warn { background: var(--warn);  box-shadow: 0 0 5px var(--warn); }
  .db-status-dot--bad  { background: var(--bad);   box-shadow: 0 0 5px var(--bad); }
  .db-status-dot--dim  { background: var(--line-2); }

  /* ── Card body ── */
  .db-card-body {
    padding: 1rem;
  }

  /* ── Stat readout ── */
  .db-stat {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .db-stat-value {
    font-family: var(--font-display);
    font-size: 2rem;
    font-weight: 700;
    line-height: 1;
    color: var(--text-1);
    letter-spacing: 0.02em;
  }

  .db-stat-value--md {
    font-size: 1.55rem;
  }

  .db-stat-label {
    font-family: var(--font-display);
    font-size: 0.58rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-3);
  }

  .db-stat-sub {
    font-family: var(--font-display);
    font-size: 0.62rem;
    letter-spacing: 0.1em;
    color: var(--text-3);
    margin-top: 0.3rem;
  }

  /* ── Stat group grid ── */
  .db-stat-row {
    display: flex;
    gap: 1.5rem;
    flex-wrap: wrap;
    margin-top: 0.6rem;
  }

  /* ── Section divider ── */
  .db-divider {
    border-top: 1px solid rgba(181, 21, 60, 0.1);
    margin: 0.85rem 0;
  }

  /* ── Grids ── */
  .db-grid-sm {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 0.85rem;
    margin-top: 1.25rem;
  }

  .db-grid-lg {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
    gap: 0.85rem;
    margin-top: 0.85rem;
  }

  /* ── Mini stat cards (inner) ── */
  .db-mini-card {
    border: 1px solid var(--line-1);
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    padding: 0.7rem 0.85rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    transition:
      border-color var(--motion-fast) ease,
      box-shadow var(--motion-med) ease;
  }

  .db-mini-card:hover {
    border-color: var(--line-2);
    box-shadow: 0 0 12px rgba(181, 21, 60, 0.1);
  }

  .db-mini-label {
    font-family: var(--font-display);
    font-size: 0.56rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--text-3);
  }

  .db-mini-value {
    font-family: var(--font-display);
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--text-1);
    line-height: 1.1;
  }

  /* ── Ghost action buttons ── */
  .db-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.52rem 0.95rem;
    background: transparent;
    border: 1px solid var(--line-1);
    border-radius: var(--radius-sm);
    color: var(--text-2);
    cursor: pointer;
    font-family: var(--font-display);
    font-size: 0.68rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    transition:
      border-color var(--motion-fast) ease,
      color var(--motion-fast) ease,
      box-shadow var(--motion-med) ease;
  }

  .db-btn:hover {
    border-color: var(--accent-2);
    color: var(--text-1);
    box-shadow: 0 0 14px rgba(181, 21, 60, 0.28);
  }

  .db-btn--primary {
    background: linear-gradient(135deg, rgba(181,21,60,0.22), rgba(138,15,46,0.18));
    border-color: var(--line-2);
    color: var(--text-1);
  }

  .db-btn--primary:hover {
    border-color: var(--accent-2);
    box-shadow: 0 0 18px rgba(181, 21, 60, 0.4);
  }

  .db-btn-row {
    display: flex;
    gap: 0.6rem;
    flex-wrap: wrap;
    margin-top: 1rem;
  }

  /* ── Alert banner ── */
  .db-alert {
    border: 1px solid var(--line-1);
    border-radius: var(--radius-md);
    background: var(--surface-1);
    overflow: hidden;
    margin-bottom: 0.85rem;
  }

  .db-alert-topbar {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    padding: 0.45rem 0.85rem;
    background: rgba(229, 161, 0, 0.08);
    border-bottom: 1px solid rgba(229, 161, 0, 0.18);
  }

  .db-alert-code {
    font-family: var(--font-display);
    font-size: 0.58rem;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--warn);
  }

  .db-alert-body {
    padding: 0.85rem 1rem;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .db-alert-text {
    font-size: 0.82rem;
    color: var(--text-2);
    line-height: 1.5;
  }

  /* ── Select override ── */
  .db-select {
    width: 100%;
    background: var(--surface-2);
    color: var(--text-1);
    border: 1px solid var(--line-1);
    border-radius: var(--radius-sm);
    padding: 0.55rem 0.7rem;
    font-family: var(--font-display);
    font-size: 0.75rem;
    letter-spacing: 0.06em;
    margin-top: 0.5rem;
    cursor: pointer;
    transition: border-color var(--motion-fast) ease;
  }

  .db-select:hover {
    border-color: var(--line-2);
  }

  /* ── Day type badge ── */
  .db-day-badge {
    font-family: var(--font-display);
    font-size: 0.6rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    padding: 0.22rem 0.55rem;
    border-radius: var(--radius-sm);
    border: 1px solid;
  }

  .db-day-badge--training {
    color: var(--ok);
    border-color: rgba(40, 183, 141, 0.35);
    background: rgba(40, 183, 141, 0.08);
  }

  .db-day-badge--rest {
    color: var(--text-3);
    border-color: var(--line-1);
    background: transparent;
  }

  .db-day-badge--high {
    color: var(--warn);
    border-color: rgba(229, 161, 0, 0.35);
    background: rgba(229, 161, 0, 0.08);
  }

  /* ── Quick actions strip ── */
  .db-quick-actions {
    margin-top: 1.25rem;
    padding-top: 1rem;
    border-top: 1px solid rgba(181, 21, 60, 0.1);
    display: flex;
    gap: 0.6rem;
    flex-wrap: wrap;
    align-items: center;
  }

  .db-quick-label {
    font-family: var(--font-display);
    font-size: 0.56rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--text-3);
    margin-right: 0.25rem;
  }

  /* ── Focus rows in check-in card ── */
  .db-focus-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 0.65rem;
    margin-top: 0.85rem;
  }

  .db-focus-item {
    border: 1px solid var(--line-1);
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    padding: 0.75rem 0.85rem;
  }

  .db-focus-title {
    font-family: var(--font-display);
    font-size: 0.58rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--accent-3);
    margin-bottom: 0.35rem;
  }

  .db-focus-text {
    font-size: 0.8rem;
    color: var(--text-2);
    line-height: 1.5;
  }

  .db-helper-text {
    font-size: 0.75rem;
    color: var(--text-3);
    margin-top: 0.75rem;
    line-height: 1.5;
  }

  /* ── Trend indicator ── */
  .db-trend-up   { color: var(--bad); }
  .db-trend-down { color: var(--ok); }
  .db-trend-flat { color: var(--text-3); }

  /* ── Steps progress bar ── */
  .db-progress-track {
    height: 3px;
    background: rgba(255,255,255,0.05);
    border-radius: 2px;
    overflow: hidden;
    margin-top: 0.6rem;
  }

  .db-progress-fill {
    height: 100%;
    border-radius: 2px;
    background: var(--accent-3);
    box-shadow: 0 0 6px var(--accent-2);
    transition: width 0.8s ease;
    max-width: 100%;
  }

  /* ── Responsive ── */
  @media (max-width: 640px) {
    .db-grid-sm {
      grid-template-columns: repeat(2, 1fr);
    }

    .db-grid-lg {
      grid-template-columns: 1fr;
    }

    .db-stat-value {
      font-size: 1.6rem;
    }
  }

  @media (max-width: 380px) {
    .db-grid-sm {
      grid-template-columns: 1fr;
    }
  }
`;

// ─── Component ────────────────────────────────────────────────────────────────

function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [unit, setUnit] = useState("kg");
  const [latest, setLatest] = useState(null);
  const [avg7, setAvg7] = useState(null);

  const [checkInDay, setCheckInDay] = useState("Monday");

  const [todayType, setTodayType] = useState("rest");
  const [todayTargets, setTodayTargets] = useState(null);
  const [stepsToday, setStepsToday] = useState(null);
  const [stepsTarget, setStepsTarget] = useState(null);
  const [cardioToday, setCardioToday] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");

      const { data: userData, error: userErr } = await supabase.auth.getUser();
      const user = userData?.user;
      if (userErr || !user) {
        navigate("/", { replace: true });
        return;
      }

      const todayIso = todayLocalISO();

      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("unit_system, check_in_day, training_days, today_day_type, today_day_type_date, split_mode, rolling_start_date, rolling_pattern, steps_target")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileErr && profileErr.code !== "PGRST116") {
        setError(profileErr.message);
        setLoading(false);
        return;
      }

      if (profile?.unit_system === "imperial") setUnit("lb");
      else setUnit("kg");

      if (profile?.check_in_day) setCheckInDay(profile.check_in_day);
      if (profile?.steps_target !== undefined && profile?.steps_target !== null) {
        setStepsTarget(Number(profile.steps_target));
      } else {
        setStepsTarget(null);
      }

      const inferredType = inferTodayType(profile, todayIso);
      setTodayType(inferredType);

      if (profile?.today_day_type_date !== todayIso) {
        await supabase
          .from("profiles")
          .update({ today_day_type: inferredType, today_day_type_date: todayIso })
          .eq("user_id", user.id);
      }

      const { data: logs, error: logsErr } = await supabase
        .from("weight_logs")
        .select("log_date, weight_kg")
        .eq("user_id", user.id)
        .order("log_date", { ascending: false })
        .limit(14);

      if (logsErr) {
        setError(logsErr.message);
      }

      if (logs && logs.length) {
        setLatest(logs[0]);
        const recent7 = logs.slice(0, 7);
        const sumKg = recent7.reduce((acc, l) => acc + Number(l.weight_kg), 0);
        const avgKg = sumKg / recent7.length;
        setAvg7(avgKg);
      } else {
        setLatest(null);
        setAvg7(null);
      }

      // Steps today
      const { data: sRow, error: sErr } = await supabase
        .from("steps_logs")
        .select("steps")
        .eq("user_id", user.id)
        .eq("log_date", todayIso)
        .maybeSingle();

      if (sErr && sErr.code !== "PGRST116") {
        setError((e) => (e ? `${e}\n${sErr.message}` : sErr.message));
      }
      setStepsToday(sRow?.steps ?? null);

      // Cardio today (show latest session logged today)
      const { data: cRows, error: cErr } = await supabase
        .from("cardio_logs")
        .select("log_date, minutes, avg_hr")
        .eq("user_id", user.id)
        .eq("log_date", todayIso)
        .order("created_at", { ascending: false })
        .limit(1);

      if (cErr) {
        setError((e) => (e ? `${e}\n${cErr.message}` : cErr.message));
      }
      setCardioToday(cRows && cRows.length ? cRows[0] : null);

      const { data: tRow, error: tErr } = await supabase
        .from("nutrition_day_targets")
        .select("day_type, calories, protein_g, carbs_g, fats_g")
        .eq("user_id", user.id)
        .eq("day_type", inferredType)
        .maybeSingle();

      if (tErr) {
        setError((e) => (e ? `${e}\n${tErr.message}` : tErr.message));
      }

      if (!tRow) {
        // Dashboard should not block if nutrition hasn't been initialized yet.
        // Onboarding/Nutrition page will initialize targets; here we just display what's available.
        if (!API_URL) {
          setTodayTargets(null);
        } else {
          try {
            const r = await apiFetch("/api/nutrition/init", {
              method: "POST",
              body: JSON.stringify({})
            });

            if (r.ok) {
              const { data: tRow2 } = await supabase
                .from("nutrition_day_targets")
                .select("day_type, calories, protein_g, carbs_g, fats_g")
                .eq("user_id", user.id)
                .eq("day_type", inferredType)
                .maybeSingle();
              setTodayTargets(tRow2 || null);
            } else {
              setTodayTargets(null);
            }
          } catch {
            setTodayTargets(null);
          }
        }
      } else {
        setTodayTargets(tRow);
      }

      setLoading(false);
    };

    load();
  }, [navigate]);

  const loggedToday = useMemo(() => {
    if (!latest) return false;
    return latest.log_date === todayLocalISO();
  }, [latest]);

  const displayWeight = (kg) => {
    const n = Number(kg);
    if (!isFinite(n)) return "—";
    if (unit === "lb") return `${round1(kgToLb(n))} lb`;
    return `${round1(n)} kg`;
  };

  const trendText = useMemo(() => {
    if (!latest || avg7 === null) return "—";
    const diff = Number(latest.weight_kg) - Number(avg7);
    const sign = diff > 0.05 ? "↑" : diff < -0.05 ? "↓" : "→";
    const abs = Math.abs(diff);
    return `${sign} ${displayWeight(abs)} vs 7-day avg`;
  }, [latest, avg7, unit]);

  const updateCheckInDay = async (day) => {
    setCheckInDay(day);
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return;
    await supabase.from("profiles").update({ check_in_day: day }).eq("user_id", user.id);
  };

  if (loading) {
    return (
      <div className="db-loading">
        <span className="db-loading-dot" />
        Acquiring data
      </div>
    );
  }

  // Derived display helpers
  const trendDiff = latest && avg7 !== null ? Number(latest.weight_kg) - Number(avg7) : null;
  const trendClass =
    trendDiff === null ? "" :
    trendDiff > 0.05  ? "db-trend-up" :
    trendDiff < -0.05 ? "db-trend-down" :
    "db-trend-flat";

  const stepsPct = stepsToday !== null && stepsTarget ? Math.min(100, Math.round((stepsToday / stepsTarget) * 100)) : 0;
  const stepsStatus = stepsToday === null ? "dim" : stepsPct >= 100 ? "ok" : stepsPct >= 60 ? "warn" : "bad";

  const dayTypeClass =
    todayType === "training" ? "db-day-badge--training" :
    todayType === "high"     ? "db-day-badge--high" :
    "db-day-badge--rest";

  return (
    <div className="db-root">
      <style>{CSS}</style>

      {/* ── Page header ── */}
      <div className="db-header">
        <div className="db-header-left">
          <div className="db-section-label">Physique Pilot</div>
          <h1 className="db-page-title">Overview</h1>
        </div>
        <div className="db-date-badge">{todayLocalISO()}</div>
      </div>

      {error && <div className="db-error">{error}</div>}

      {/* ── Weight-not-logged alert ── */}
      {!loggedToday && (
        <div className="db-alert">
          <div className="db-alert-topbar">
            <span className="db-status-dot db-status-dot--warn" />
            <span className="db-alert-code">WGT · Action Required</span>
          </div>
          <div className="db-alert-body">
            <div className="db-alert-text">
              Log your weight first thing in the morning before eating or drinking, ideally after using the bathroom.
            </div>
            <button className="db-btn db-btn--primary" onClick={() => navigate("/app/weight")}>
              Log weight
            </button>
          </div>
        </div>
      )}

      {/* ── Top stat cards grid ── */}
      <div className="db-grid-sm">

        {/* Weight card */}
        <div className="db-card">
          <div className="db-card-topbar">
            <div className="db-card-topbar-left">
              <span className="db-card-code">WGT</span>
              <span className="db-card-title">Current weight</span>
            </div>
            <span className={`db-status-dot db-status-dot--${loggedToday ? "ok" : "warn"}`} />
          </div>
          <div className="db-card-body">
            <div className="db-stat">
              <div className="db-stat-value">
                {latest ? displayWeight(latest.weight_kg) : "—"}
              </div>
              <div className="db-stat-label">
                {loggedToday ? "Logged today" : latest ? `Last: ${latest.log_date}` : "No logs yet"}
              </div>
            </div>
          </div>
        </div>

        {/* Trend card */}
        <div className="db-card">
          <div className="db-card-topbar">
            <div className="db-card-topbar-left">
              <span className="db-card-code">WGT</span>
              <span className="db-card-title">7-day average</span>
            </div>
          </div>
          <div className="db-card-body">
            <div className="db-stat">
              <div className="db-stat-value db-stat-value--md">
                {avg7 !== null ? displayWeight(avg7) : "—"}
              </div>
              <div className={`db-stat-label ${trendClass}`}>
                {trendText}
              </div>
            </div>
          </div>
        </div>

        {/* Steps card */}
        <div className="db-card">
          <div className="db-card-topbar">
            <div className="db-card-topbar-left">
              <span className="db-card-code">ACT</span>
              <span className="db-card-title">Steps today</span>
            </div>
            <span className={`db-status-dot db-status-dot--${stepsStatus}`} />
          </div>
          <div className="db-card-body">
            <div className="db-stat">
              <div className="db-stat-value db-stat-value--md">
                {stepsToday !== null ? stepsToday.toLocaleString() : "—"}
              </div>
              <div className="db-stat-label">
                Target: {stepsTarget !== null ? stepsTarget.toLocaleString() : "—"}
              </div>
            </div>
            {stepsTarget !== null && stepsToday !== null && (
              <div className="db-progress-track">
                <div className="db-progress-fill" style={{ width: `${stepsPct}%` }} />
              </div>
            )}
            <div className="db-btn-row">
              <button className="db-btn" onClick={() => navigate("/app/cardio-steps")}>
                Log steps
              </button>
            </div>
          </div>
        </div>

        {/* Cardio card */}
        <div className="db-card">
          <div className="db-card-topbar">
            <div className="db-card-topbar-left">
              <span className="db-card-code">ACT</span>
              <span className="db-card-title">Cardio</span>
            </div>
            <span className={`db-status-dot db-status-dot--${cardioToday ? "ok" : "dim"}`} />
          </div>
          <div className="db-card-body">
            <div className="db-stat">
              <div className="db-stat-value db-stat-value--md">
                {cardioToday ? `${cardioToday.minutes} min` : "—"}
              </div>
              <div className="db-stat-label">
                {cardioToday && cardioToday.avg_hr
                  ? `Avg HR: ${cardioToday.avg_hr} bpm`
                  : "No session logged today"}
              </div>
            </div>
            <div className="db-btn-row">
              <button className="db-btn" onClick={() => navigate("/app/cardio-steps")}>
                Log cardio
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Wide cards row ── */}
      <div className="db-grid-lg">

        {/* Nutrition card */}
        <div className="db-card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="db-card-topbar">
            <div className="db-card-topbar-left">
              <span className="db-card-code">NUT</span>
              <span className="db-card-title">Today&apos;s nutrition</span>
            </div>
            <span className={`db-day-badge ${dayTypeClass}`}>
              {dayLabel[todayType] || todayType}
            </span>
          </div>

          <div className="db-card-body" style={{ flex: 1 }}>
            <div className="db-stat-label" style={{ marginBottom: "0.65rem" }}>
              Auto-selected by date and split — override in Nutrition
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
              gap: "0.6rem"
            }}>
              <div className="db-mini-card">
                <div className="db-mini-label">Calories</div>
                <div className="db-mini-value">
                  {todayTargets?.calories ?? "—"}
                </div>
              </div>
              <div className="db-mini-card">
                <div className="db-mini-label">Protein</div>
                <div className="db-mini-value">
                  {todayTargets ? `${todayTargets.protein_g}g` : "—"}
                </div>
              </div>
              <div className="db-mini-card">
                <div className="db-mini-label">Carbs</div>
                <div className="db-mini-value">
                  {todayTargets ? `${todayTargets.carbs_g}g` : "—"}
                </div>
              </div>
              <div className="db-mini-card">
                <div className="db-mini-label">Fats</div>
                <div className="db-mini-value">
                  {todayTargets ? `${todayTargets.fats_g}g` : "—"}
                </div>
              </div>
            </div>

            <div className="db-btn-row">
              <button className="db-btn db-btn--primary" onClick={() => navigate("/app/nutrition")}>
                Open nutrition
              </button>
              <button className="db-btn" onClick={() => navigate("/app/training")}>
                Open training
              </button>
            </div>
          </div>
        </div>

        {/* Check-in card */}
        <div className="db-card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="db-card-topbar">
            <div className="db-card-topbar-left">
              <span className="db-card-code">CHK</span>
              <span className="db-card-title">Weekly check-in</span>
            </div>
            <button className="db-btn" style={{ fontSize: "0.6rem", padding: "0.3rem 0.65rem" }} onClick={() => navigate("/app/check-ins")}>
              Go to check-ins
            </button>
          </div>

          <div className="db-card-body" style={{ flex: 1 }}>
            <div className="db-stat-label" style={{ marginBottom: "0.35rem" }}>
              Check-in day
            </div>
            <select
              className="db-select"
              value={checkInDay}
              onChange={(e) => updateCheckInDay(e.target.value)}
            >
              <option>Monday</option>
              <option>Tuesday</option>
              <option>Wednesday</option>
              <option>Thursday</option>
              <option>Friday</option>
              <option>Saturday</option>
              <option>Sunday</option>
            </select>

            <div className="db-focus-grid">
              <div className="db-focus-item">
                <div className="db-focus-title">This week&apos;s focus</div>
                <div className="db-focus-text">
                  Log weight, steps and cardio. Then submit your weekly check-in for adjustments.
                </div>
              </div>
              <div className="db-focus-item">
                <div className="db-focus-title">What you&apos;ll get</div>
                <div className="db-focus-text">
                  A summary + insights (PDF later), and AI coaching once we wire it in.
                </div>
              </div>
            </div>

            <div className="db-helper-text">
              Weekly check-ins will generate a PDF summary you can view anytime in the Check-ins tab.
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick actions strip ── */}
      <div className="db-quick-actions">
        <span className="db-quick-label">Quick access</span>
        <button className="db-btn" onClick={() => navigate("/app/weight")}>
          Log weight
        </button>
        <button className="db-btn" onClick={() => navigate("/app/training")}>
          View training
        </button>
        <button className="db-btn" onClick={() => navigate("/app/nutrition")}>
          View meal plan
        </button>
      </div>
    </div>
  );
}

export default Dashboard;
