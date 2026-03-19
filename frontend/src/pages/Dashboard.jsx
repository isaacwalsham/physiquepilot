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
  }
  .db-header-eyebrow {
    font-family: var(--font-display);
    font-size: 0.55rem;
    letter-spacing: 0.2em;
    color: var(--text-3);
    margin-bottom: 0.2rem;
  }
  .db-header-greeting {
    font-family: var(--font-display);
    font-size: 0.95rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .db-header-center { display: flex; align-items: center; }
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
    font-size: 1.1rem;
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
    padding: 1rem 1.1rem;
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
    font-size: 0.6rem;
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
    font-size: 2rem;
    font-weight: 700;
    line-height: 1;
    color: var(--text-1);
  }

  /* ── Stat ── */
  .db-stat { display: flex; flex-direction: column; gap: 0.15rem; }
  .db-stat-label {
    font-family: var(--font-display);
    font-size: 0.56rem;
    letter-spacing: 0.14em;
    color: var(--text-3);
    text-transform: uppercase;
  }
  .db-stat-val {
    font-family: var(--font-display);
    font-size: 1.05rem;
    color: var(--text-1);
  }

  /* ── Badges ── */
  .db-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-family: var(--font-display);
    font-size: 0.65rem;
    letter-spacing: 0.07em;
    padding: 0.2rem 0.6rem;
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
  .db-habit-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
  .db-habit-name {
    font-family: var(--font-display);
    font-size: 0.63rem;
    letter-spacing: 0.06em;
    color: var(--text-2);
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .db-habit-check { font-family: var(--font-display); font-size: 0.65rem; flex-shrink: 0; }

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
    padding: 0.6rem;
    background: linear-gradient(135deg, var(--accent-1), var(--accent-2));
    border: none;
    border-radius: var(--radius-sm);
    color: #fff;
    font-family: var(--font-display);
    font-size: 0.7rem;
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
    font-size: 3rem;
    font-weight: 700;
    line-height: 1;
    color: var(--text-1);
  }
  .db-countdown-unit {
    font-family: var(--font-display);
    font-size: 0.6rem;
    letter-spacing: 0.2em;
    color: var(--text-3);
    margin-top: 0.2rem;
  }

  /* ── Cal status bar ── */
  .db-cal-status {
    font-family: var(--font-display);
    font-size: 0.68rem;
    letter-spacing: 0.1em;
    padding: 0.4rem 0.7rem;
    border-radius: var(--radius-sm);
    text-align: center;
    margin-top: 0.5rem;
    flex-shrink: 0;
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
  const sw = 9;
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
      <div style={{ textAlign: "center", fontFamily: "var(--font-display)", fontSize: "0.58rem", letterSpacing: "0.14em", color: "var(--text-3)", marginTop: "2px" }}>{label}</div>
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

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const { profile, todayDayType, loading: profileLoading } = useProfile();

  const [loading,          setLoading]          = useState(true);
  const [unit,             setUnit]             = useState("kg");
  const [unitDisplay,      setUnitDisplay]      = useState("kg");
  const [latest,           setLatest]           = useState(null);
  const [avg7,             setAvg7]             = useState(null);
  const [stepsToday,       setStepsToday]       = useState(null);
  const [stepsTarget,      setStepsTarget]      = useState(null);
  const [cardioToday,      setCardioToday]      = useState(null);
  const [trainSession,     setTrainSession]     = useState(null);
  const [todayTargets,     setTodayTargets]     = useState(null);
  const [nutLogged,        setNutLogged]        = useState({ calories: 0, protein_g: 0, carbs_g: 0, fats_g: 0 });
  const [habits,           setHabits]           = useState({ total: 0, done: 0, list: [], loggedIds: new Set() });
  const [todayProgramDay,  setTodayProgramDay]  = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: { session: _s } } = await supabase.auth.getSession();
      const ud = { user: _s?.user };
      const user = ud?.user;
      if (!user) { navigate("/", { replace: true }); return; }

      const initUnit = profile?.unit_system === "imperial" ? "lb" : "kg";
      setUnit(initUnit);
      setUnitDisplay(initUnit);

      const stepTgt = profile?.baseline_steps_per_day ?? profile?.steps_target ?? null;
      setStepsTarget(stepTgt !== null ? Number(stepTgt) : null);

      const today = todayLocalISO();

      // Weight
      const { data: wLogs } = await supabase
        .from("weight_logs").select("log_date, weight_kg")
        .eq("user_id", user.id).order("log_date", { ascending: false }).limit(7);
      if (wLogs?.length) {
        setLatest(wLogs[0]);
        setAvg7(wLogs.reduce((s, l) => s + Number(l.weight_kg), 0) / wLogs.length);
      } else { setLatest(null); setAvg7(null); }

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
        .from("daily_nutrition_items").select("calories, protein_g, carbs_g, fats_g")
        .eq("user_id", user.id).eq("log_date", today);
      if (items?.length) {
        setNutLogged({
          calories:  items.reduce((s, i) => s + Number(i.calories  || 0), 0),
          protein_g: items.reduce((s, i) => s + Number(i.protein_g || 0), 0),
          carbs_g:   items.reduce((s, i) => s + Number(i.carbs_g   || 0), 0),
          fats_g:    items.reduce((s, i) => s + Number(i.fats_g    || 0), 0),
        });
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
            <div className="db-header-eyebrow">PHYSIQUE PILOT // COMMAND INTERFACE</div>
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
                    <span style={{ fontFamily: "var(--font-display)", fontSize: "0.85rem",
                      color: trend > 0.05 ? "var(--bad)" : trend < -0.05 ? "#60a5fa" : "var(--ok)" }}>
                      {trend > 0.05 ? "↑" : trend < -0.05 ? "↓" : "→"} {dispW(Math.abs(trend))}
                    </span>
                  )}
                  <span style={{ fontSize: "0.62rem", color: "var(--text-3)", fontFamily: "var(--font-display)" }}>vs 7-day avg</span>
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

            {avg7 !== null && (
              <>
                <hr className="db-hr" />
                <div className="db-stat">
                  <span className="db-stat-label">7-DAY AVERAGE</span>
                  <span className="db-stat-val" style={{ fontSize: "0.9rem" }}>{dispW(avg7)}</span>
                </div>
              </>
            )}

            {(profile?.goal_weight_kg || profile?.target_weight_kg) && latest && (
              <>
                <hr className="db-hr" />
                <div className="db-stat">
                  <span className="db-stat-label">DISTANCE TO GOAL</span>
                  <span className="db-stat-val" style={{ fontSize: "0.85rem" }}>
                    {dispW(Math.abs(Number(latest.weight_kg) - Number(profile.goal_weight_kg || profile.target_weight_kg)))}
                    <span style={{ fontFamily: "var(--font-display)", fontSize: "0.6rem", color: "var(--text-3)", marginLeft: "0.4rem" }}>
                      {Number(latest.weight_kg) > Number(profile.goal_weight_kg || profile.target_weight_kg) ? "to lose" : "to gain"}
                    </span>
                  </span>
                </div>
              </>
            )}

            <div className="db-nav-hint">OPEN WEIGHT LOG →</div>
          </div>

          {/* ── COL 2 ROWS 1-2: MACRO GAUGES ── */}
          <div className="db-panel db-macro-panel" onClick={nav("/app/nutrition")} role="button"
            tabIndex={0} onKeyDown={onKey("/app/nutrition")} aria-label="Open nutrition">

            <div className="db-mfd">
              <span className={`db-dot ${calRemaining !== null && calRemaining < 0 ? "db-dot-red" : "db-dot-green"}`} />
              ◈ FUEL SYSTEMS
            </div>

            <div className="db-gauge-grid">
              <ArcGauge
                value={calLogged}
                max={todayTargets?.calories || 2000}
                label="CALORIES"
                color="var(--accent-3)"
                unit="kcal"
                size={120}
              />
              <ArcGauge
                value={Math.round(nutLogged.protein_g)}
                max={todayTargets?.protein_g || 150}
                label="PROTEIN"
                color="#22c55e"
                unit="g"
                size={120}
              />
              <ArcGauge
                value={Math.round(nutLogged.carbs_g)}
                max={todayTargets?.carbs_g || 200}
                label="CARBS"
                color="#4d8eff"
                unit="g"
                size={120}
              />
              <ArcGauge
                value={Math.round(nutLogged.fats_g)}
                max={todayTargets?.fats_g || 60}
                label="FATS"
                color="#f59e0b"
                unit="g"
                size={120}
              />
            </div>

            {calRemaining !== null && (
              <div className="db-cal-status" style={{
                background: calRemaining >= 0 ? "rgba(26,74,54,0.25)" : "rgba(138,15,46,0.2)",
                border: `1px solid ${calRemaining >= 0 ? "#1a4a36" : "var(--accent-1)"}`,
                color: calRemaining >= 0 ? "var(--ok)" : "var(--bad)",
              }}>
                {calRemaining >= 0
                  ? `${calRemaining} KCAL REMAINING`
                  : `${Math.abs(calRemaining)} KCAL OVER TARGET`}
              </div>
            )}

            <div style={{
              fontFamily: "var(--font-display)",
              fontSize: "0.58rem",
              letterSpacing: "0.14em",
              color: "var(--text-3)",
              textAlign: "center",
              marginTop: "0.4rem",
              flexShrink: 0,
            }}>
              {todayDayType === "training" ? "TRAINING DAY TARGETS"
               : todayDayType === "high"   ? "HIGH DAY TARGETS"
               :                             "REST DAY TARGETS"}
            </div>

            <div className="db-nav-hint">OPEN NUTRITION →</div>
          </div>

          {/* ── COL 3 ROW 1: TRAINING TODAY ── */}
          <div className="db-panel" onClick={nav("/app/training")} role="button"
            tabIndex={0} onKeyDown={onKey("/app/training")} aria-label="Open training">

            <div className="db-mfd">
              <span className={`db-dot db-dot-${todayDayType === "training" ? "red" : "green"}`} />
              ◈ TRAINING
            </div>

            <div style={{ fontFamily: "var(--font-display)", fontSize: "1rem", fontWeight: 700, color: todayProgramDay?.is_rest ? "var(--text-3)" : "var(--text-1)", marginBottom: "0.5rem", lineHeight: 1.2 }}>
              {todayProgramDay?.is_rest
                ? "REST DAY"
                : programDayName}
            </div>

            <div style={{ marginBottom: "0.5rem" }}>
              {trainSession
                ? <span className="db-badge db-badge-ok">✓ SESSION LOGGED</span>
                : todayDayType === "training"
                  ? <span className="db-badge db-badge-warn">⏳ PENDING</span>
                  : <span style={{ fontFamily: "var(--font-display)", fontSize: "0.65rem", color: "var(--text-3)" }}>NO SESSION REQUIRED</span>}
            </div>

            <hr className="db-hr" />

            <div className="db-stat" style={{ marginBottom: "0.4rem" }}>
              <span className="db-stat-label">ACTIVE PROTOCOL</span>
              <span className="db-stat-val" style={{ fontSize: "0.78rem", marginTop: "0.2rem" }}>
                {todayDayType === "training" ? "PERFORMANCE MACROS"
                 : todayDayType === "high"   ? "SURPLUS MACROS"
                 :                             "DEFICIT MACROS"}
              </span>
            </div>

            <div style={{ fontFamily: "var(--font-display)", fontSize: "0.6rem", color: "var(--text-3)", lineHeight: 1.6, letterSpacing: "0.06em" }}>
              {todayDayType === "training"
                ? <><span style={{ color: "var(--accent-3)" }}>></span> High protein intake<br /><span style={{ color: "var(--accent-3)" }}>></span> Elevated carbs pre/post<br /><span style={{ color: "var(--accent-3)" }}>></span> Full calorie allocation</>
                : todayDayType === "high"
                  ? <><span style={{ color: "var(--accent-3)" }}>></span> Refeed protocol<br /><span style={{ color: "var(--accent-3)" }}>></span> Surplus carb intake<br /><span style={{ color: "var(--accent-3)" }}>></span> Glycogen replenishment</>
                  : <><span style={{ color: "var(--accent-3)" }}>></span> Reduced calorie intake<br /><span style={{ color: "var(--accent-3)" }}>></span> Protein maintained<br /><span style={{ color: "var(--accent-3)" }}>></span> Recovery mode active</>
              }
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
              <RadialGauge value={stepsToday || 0} max={stepsTarget || 10000} size={110} />
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "0.85rem", fontWeight: 700, color: "var(--text-1)" }}>
                  {stepsToday !== null ? stepsToday.toLocaleString() : "—"}
                  <span style={{ fontSize: "0.58rem", color: "var(--text-3)", marginLeft: "0.35rem" }}>
                    / {stepsTarget !== null ? stepsTarget.toLocaleString() : "10,000"}
                  </span>
                </div>
                {stepsToday !== null && stepsTarget !== null && stepsToday < stepsTarget && (
                  <div style={{ fontFamily: "var(--font-display)", fontSize: "0.58rem", color: "var(--text-3)", letterSpacing: "0.1em" }}>
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
              <span style={{ fontFamily: "var(--font-display)", fontSize: "0.65rem", color: "var(--text-3)" }}>
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
              <div className="db-bignum" style={{ fontSize: "1.6rem" }}>
                {habits.done}<span style={{ color: "var(--text-3)", fontSize: "1rem" }}>/{habits.total}</span>
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
                <div style={{ fontFamily: "var(--font-display)", fontSize: "0.58rem", color: "var(--text-3)", letterSpacing: "0.1em", marginTop: "0.25rem" }}>
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
                {daysUntil === 0 ? "CHECK-IN TODAY" : "DAYS UNTIL CHECK-IN"}
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "0.58rem", color: "var(--text-3)", letterSpacing: "0.12em", marginTop: "0.3rem" }}>
                NEXT: {(profile?.check_in_day || "MONDAY").toUpperCase()}
              </div>
            </div>

            <hr className="db-hr" />

            <div style={{ marginBottom: "0.5rem" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "0.56rem", letterSpacing: "0.12em", color: "var(--text-3)", marginBottom: "0.35rem" }}>
                WEEK PROGRESS
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
                SUBMIT CHECK-IN →
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

            <div style={{ textAlign: "center", marginBottom: "0.5rem" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem", fontWeight: 700, color: "var(--accent-3)", letterSpacing: "0.08em", lineHeight: 1 }}>
                PHYSIQUE PILOT
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "0.56rem", color: "var(--text-3)", letterSpacing: "0.2em", marginTop: "0.2rem" }}>
                AI COACHING SYSTEM
              </div>
            </div>

            <div style={{ width: "100%", height: "1px", background: "linear-gradient(to right, transparent, var(--accent-3), transparent)", marginBottom: "0.65rem", flexShrink: 0 }} />

            <div style={{ flex: 1 }}>
              <div className="db-terminal-line"><span className="db-terminal-prompt">&gt;</span> SYSTEM: ONLINE</div>
              <div className="db-terminal-line"><span className="db-terminal-prompt">&gt;</span> MODEL: GPT-4o mini</div>
              <div className="db-terminal-line"><span className="db-terminal-prompt">&gt;</span> MODE: SUPPORTIVE</div>
              <div className="db-terminal-line"><span className="db-terminal-prompt">&gt;</span> CONSTRAINTS: ACTIVE</div>
            </div>

            <button className="db-cta-btn" onClick={(e) => { e.stopPropagation(); navigate("/app/coach"); }}>
              OPEN CHANNEL →
            </button>

            <div className="db-nav-hint">OPEN COACH →</div>
          </div>

        </div>
      </div>
    </>
  );
}
