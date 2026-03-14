import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { useProfile } from "../context/ProfileContext";

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

// ─── Stylesheet ───────────────────────────────────────────────────────────────
const CSS = `
  /* ── Page wrapper ── */
  .db-wrap {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    min-height: calc(100vh - 80px);
    padding-bottom: 1.5rem;
    box-sizing: border-box;
  }

  /* ── Mission header ── */
  .db-header {
    background: var(--surface-2);
    border: 1px solid var(--line-1);
    border-left: 3px solid var(--accent-3);
    border-radius: var(--radius-md);
    padding: 1rem 1.4rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  /* ── Grid: 3 equal columns — takes ~75% of remaining height ── */
  .db-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 0.75rem;
    flex: 3;
    min-height: 0;
  }
  @media (max-width: 900px) { .db-grid { grid-template-columns: 1fr 1fr; } }
  @media (max-width: 580px) { .db-grid { grid-template-columns: 1fr; } }

  /* ── Panel base ── */
  .db-panel {
    background: var(--surface-2);
    border: 1px solid var(--line-1);
    border-radius: var(--radius-md);
    padding: 1.4rem;
    position: relative;
    overflow: hidden;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    outline: none;
    transition: border-color 160ms ease, box-shadow 260ms ease, transform 160ms ease;
  }
  .db-panel:hover, .db-panel:focus-visible {
    border-color: var(--line-2);
    box-shadow: 0 0 0 1px rgba(222,41,82,0.18), 0 0 20px rgba(222,41,82,0.14), 0 14px 30px rgba(0,0,0,0.45);
    transform: translateY(-1px);
  }
  .db-panel:focus-visible { outline: 2px solid var(--accent-3); outline-offset: 2px; }

  /* Corner accent */
  .db-panel::before {
    content: '';
    position: absolute;
    top: 0; left: 0;
    width: 20px; height: 20px;
    border-top: 2px solid var(--accent-2);
    border-left: 2px solid var(--accent-2);
    border-radius: var(--radius-md) 0 0 0;
    opacity: 0.4;
    transition: opacity 160ms;
  }
  .db-panel:hover::before { opacity: 0.9; }

  /* Nav hint */
  .db-nav-hint {
    position: absolute; bottom: 0.75rem; right: 1rem;
    font-family: var(--font-display);
    font-size: 0.58rem; letter-spacing: 0.12em;
    color: transparent;
    transition: color 160ms;
    text-transform: uppercase;
  }
  .db-panel:hover .db-nav-hint,
  .db-panel:focus-visible .db-nav-hint { color: var(--text-3); }

  /* MFD section label */
  .db-mfd {
    font-family: var(--font-display);
    font-size: 0.62rem; letter-spacing: 0.18em; text-transform: uppercase;
    color: var(--accent-3);
    display: flex; align-items: center; gap: 0.5rem;
    margin-bottom: 1.1rem;
  }
  .db-mfd::after {
    content: ''; flex: 1; height: 1px;
    background: linear-gradient(to right, var(--accent-1), transparent);
  }

  /* Big readout number */
  .db-bignum {
    font-family: var(--font-display);
    font-size: 2.4rem; font-weight: 700; line-height: 1;
    color: var(--text-1);
  }

  /* Divider */
  .db-hr { border: none; border-top: 1px solid var(--line-1); margin: 1rem 0; }

  /* Badges */
  .db-badge {
    display: inline-flex; align-items: center; gap: 0.3rem;
    font-family: var(--font-display);
    font-size: 0.68rem; letter-spacing: 0.07em;
    padding: 0.24rem 0.65rem; border: 1px solid;
    border-radius: 6px;
    text-transform: uppercase;
  }
  .db-badge-training { color: var(--accent-3); border-color: var(--accent-1); background: rgba(138,15,46,0.18); }
  .db-badge-rest     { color: #60a5fa;          border-color: #1e3a5f;         background: rgba(30,58,95,0.25); }
  .db-badge-high     { color: #fbbf24;          border-color: #78450f;         background: rgba(120,69,15,0.2); }
  .db-badge-ok       { color: var(--ok);        border-color: #1a4a36;         background: rgba(26,74,54,0.25); }
  .db-badge-warn     { color: var(--warn);      border-color: #5a3a00;         background: rgba(90,58,0,0.2); }

  /* Stat pair */
  .db-stat { display: flex; flex-direction: column; gap: 0.18rem; }
  .db-stat-label {
    font-family: var(--font-display);
    font-size: 0.58rem; letter-spacing: 0.14em; color: var(--text-3); text-transform: uppercase;
  }
  .db-stat-val {
    font-family: var(--font-display);
    font-size: 1.15rem; color: var(--text-1);
  }

  /* Macro bar */
  .db-macro {
    display: grid; grid-template-columns: 76px 1fr 120px;
    gap: 0.5rem; align-items: center;
  }
  .db-macro-label {
    font-family: var(--font-display);
    font-size: 0.6rem; letter-spacing: 0.1em; color: var(--text-3);
    text-transform: uppercase;
  }
  .db-macro-track {
    height: 5px; background: var(--line-1); border-radius: 3px; overflow: hidden;
  }
  .db-macro-fill {
    height: 100%; border-radius: 3px;
    transition: width 0.9s cubic-bezier(0.4,0,0.2,1);
  }
  .db-macro-val {
    font-family: var(--font-display);
    font-size: 0.72rem; color: var(--text-2); text-align: right; white-space: nowrap;
  }
  .db-macro-dim { color: var(--text-3); }

  /* Nutrition full-width panel — takes ~25% of remaining height */
  .db-nutrition { flex: 1; min-height: 0; }

  /* Bigger macro bars to fill the extra nutrition panel space */
  .db-macro { gap: 0.65rem; margin-bottom: 0.25rem; }
  .db-macro-track { height: 8px; }
  .db-macro-label { font-size: 0.65rem; }
  .db-macro-val { font-size: 0.8rem; }
`;

// ─── Radial Gauge ─────────────────────────────────────────────────────────────
function RadialGauge({ value, max, size = 130 }) {
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
        {/* Track */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--line-1)" strokeWidth={sw} />
        {/* Fill */}
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke={color} strokeWidth={sw}
          strokeDasharray={`${pct * circ} ${circ}`}
          strokeLinecap="round"
          style={{ filter: "drop-shadow(0 0 6px var(--accent-2))", transition: "stroke-dasharray 0.9s cubic-bezier(0.4,0,0.2,1), stroke 0.4s" }}
        />
        {/* Tick marks */}
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
        <span style={{
          fontFamily: "var(--font-display)",
          fontSize: size * 0.22, fontWeight: 700, lineHeight: 1,
          color: complete ? "var(--ok)" : "var(--text-1)",
        }}>
          {Math.round(pct * 100)}%
        </span>
        <span style={{ fontFamily: "var(--font-display)", fontSize: size * 0.1, color: "var(--text-3)" }}>
          STEPS
        </span>
      </div>
    </div>
  );
}

// ─── Macro progress bar ───────────────────────────────────────────────────────
function MacroBar({ label, value, max, unit = "g", color = "#dc143c" }) {
  const capped = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const over   = max > 0 && value > max * 1.05;
  return (
    <div className="db-macro">
      <span className="db-macro-label">{label}</span>
      <div className="db-macro-track">
        <div
          className="db-macro-fill"
          style={{ width: `${capped}%`, background: over ? "#ff6600" : color }}
        />
      </div>
      <span className="db-macro-val">
        {value > 0 ? Math.round(value) : "—"}{unit !== "" ? `\u00a0${unit}` : ""}
        <span className="db-macro-dim"> / {max}{unit !== "" ? `\u00a0${unit}` : ""}</span>
      </span>
    </div>
  );
}

// ─── Loading ──────────────────────────────────────────────────────────────────
function CockpitLoader() {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", height: "60vh", gap: "0.6rem",
    }}>
      <div style={{ fontFamily: "var(--font-display)", fontSize: "0.8rem", color: "var(--accent-3)", letterSpacing: "0.2em" }}>
        INITIALISING SYSTEMS
      </div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: "0.6rem", color: "var(--text-3)", letterSpacing: "0.15em" }}>
        LOADING PILOT DATA...
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const { profile, todayDayType, loading: profileLoading } = useProfile();

  const [loading,       setLoading]       = useState(true);
  const [unit,          setUnit]          = useState("kg");
  const [latest,        setLatest]        = useState(null);
  const [avg7,          setAvg7]          = useState(null);
  const [stepsToday,    setStepsToday]    = useState(null);
  const [stepsTarget,   setStepsTarget]   = useState(null);
  const [cardioToday,   setCardioToday]   = useState(null);
  const [trainSession,  setTrainSession]  = useState(null);
  const [todayTargets,  setTodayTargets]  = useState(null);
  const [nutLogged,     setNutLogged]     = useState({ calories: 0, protein_g: 0, carbs_g: 0, fats_g: 0 });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: { session: _s } } = await supabase.auth.getSession(); const ud = { user: _s?.user };
      const user = ud?.user;
      if (!user) { navigate("/", { replace: true }); return; }

      setUnit(profile?.unit_system === "imperial" ? "lb" : "kg");
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

      setLoading(false);
    };
    if (!profileLoading) load();
  }, [navigate, profile, todayDayType, profileLoading]);

  const dispW = (kg) => {
    const n = Number(kg);
    if (!isFinite(n)) return "—";
    return unit === "lb" ? `${round1(kgToLb(n))} lb` : `${round1(n)} kg`;
  };

  const loggedToday = useMemo(() => latest?.log_date === todayLocalISO(), [latest]);
  const trend = useMemo(() => {
    if (!latest || avg7 === null) return null;
    return Number(latest.weight_kg) - Number(avg7);
  }, [latest, avg7]);

  const nav = (path) => () => navigate(path);
  const onKey = (path) => (e) => e.key === "Enter" && navigate(path);

  const firstName   = profile?.first_name || "PILOT";
  const dtLabel     = DAY_LABEL[todayDayType || "rest"] || "REST DAY";
  const dtIcon      = todayDayType === "training" ? "▶" : todayDayType === "high" ? "▲" : "■";
  const dtBadgeCls  = `db-badge db-badge-${todayDayType === "training" ? "training" : todayDayType === "high" ? "high" : "rest"}`;
  const hour        = new Date().getHours();
  const greeting    = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // Nutrition summary helpers
  const calTarget    = todayTargets?.calories   || 0;
  const calLogged    = Math.round(nutLogged.calories);
  const calRemaining = calTarget ? calTarget - calLogged : null;

  if (profileLoading || loading) return <CockpitLoader />;

  return (
    <>
      <style>{CSS}</style>
      <div className="db-scanline" />

      <div className="db-wrap">

        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <div className="db-header">
          <div>
            <div style={{
              fontFamily: "var(--font-display)",
              fontSize: "0.58rem", letterSpacing: "0.2em", color: "var(--text-3)", marginBottom: "0.3rem",
            }}>
              PHYSIQUE PILOT // COMMAND INTERFACE
            </div>
            <div style={{ fontSize: "1.15rem", fontWeight: 600, color: "var(--text-1)", fontFamily: "var(--font-display)" }}>
              {greeting}, <span style={{ color: "var(--accent-3)" }}>{firstName}.</span>
              {" "}<span style={{ color: "var(--accent-3)" }}>{dtIcon} {dtLabel}</span>
            </div>
          </div>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: "0.78rem",
            color: "var(--text-3)", letterSpacing: "0.12em",
          }}>
            {fmtDisplayDate()}
          </div>
        </div>

        {/* ── 3-column grid ───────────────────────────────────────────────────── */}
        <div className="db-grid">

          {/* ── BIOMETRICS ── */}
          <div className="db-panel" onClick={nav("/app/weight")} role="button"
            tabIndex={0} onKeyDown={onKey("/app/weight")} aria-label="Open weight tracking">
            <div className="db-mfd">◈ BIOMETRICS</div>

            {latest ? (
              <>
                <div className="db-bignum">{dispW(latest.weight_kg)}</div>

                <div style={{ marginTop: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  {trend !== null && (
                    <span style={{
                      fontFamily: "var(--font-display)", fontSize: "0.9rem",
                      color: trend > 0.05 ? "var(--bad)" : trend < -0.05 ? "#60a5fa" : "var(--ok)",
                    }}>
                      {trend > 0.05 ? "↑" : trend < -0.05 ? "↓" : "→"} {dispW(Math.abs(trend))}
                    </span>
                  )}
                  <span style={{ fontSize: "0.7rem", color: "var(--text-3)", fontFamily: "var(--font-display)" }}>vs 7-day avg</span>
                </div>

                <div style={{ marginTop: "0.6rem" }}>
                  {loggedToday
                    ? <span className="db-badge db-badge-ok">✓ LOGGED TODAY</span>
                    : <span className="db-badge db-badge-warn">⚠ NOT LOGGED TODAY</span>}
                </div>
              </>
            ) : (
              <>
                <div className="db-bignum" style={{ color: "var(--text-3)" }}>—</div>
                <div style={{ fontSize: "0.82rem", color: "var(--text-3)", marginTop: "0.5rem", fontFamily: "var(--font-display)" }}>
                  No data yet. Tap to log first weight.
                </div>
              </>
            )}

            {avg7 !== null && (
              <>
                <hr className="db-hr" />
                <div className="db-stat">
                  <span className="db-stat-label">7-DAY AVERAGE</span>
                  <span className="db-stat-val">{dispW(avg7)}</span>
                </div>
              </>
            )}

            {profile?.goal_weight_kg && latest && (
              <>
                <hr className="db-hr" />
                <div className="db-stat">
                  <span className="db-stat-label">DISTANCE TO GOAL</span>
                  <span className="db-stat-val">
                    {dispW(Math.abs(Number(latest.weight_kg) - Number(profile.goal_weight_kg)))}
                    <span style={{ fontFamily: "var(--font-display)", fontSize: "0.65rem", color: "var(--text-3)", marginLeft: "0.4rem" }}>
                      {Number(latest.weight_kg) > Number(profile.goal_weight_kg) ? "to lose" : "to gain"}
                    </span>
                  </span>
                </div>
              </>
            )}

            <div className="db-nav-hint">OPEN WEIGHT LOG →</div>
          </div>

          {/* ── MOVEMENT ── */}
          <div className="db-panel" onClick={nav("/app/cardio-steps")} role="button"
            tabIndex={0} onKeyDown={onKey("/app/cardio-steps")} aria-label="Open movement">
            <div className="db-mfd">◈ MOVEMENT</div>

            <div style={{ display: "flex", alignItems: "center", gap: "1.2rem", marginBottom: "0.5rem" }}>
              <RadialGauge value={stepsToday || 0} max={stepsTarget || 10000} size={130} />
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div className="db-stat">
                  <span className="db-stat-label">STEPS TODAY</span>
                  <span className="db-stat-val" style={{ fontSize: "1.6rem" }}>
                    {stepsToday !== null ? stepsToday.toLocaleString() : "—"}
                  </span>
                </div>
                <div className="db-stat">
                  <span className="db-stat-label">TARGET</span>
                  <span className="db-stat-val" style={{ fontSize: "1rem" }}>
                    {stepsTarget !== null ? stepsTarget.toLocaleString() : "10,000"}
                  </span>
                </div>
                {stepsToday !== null && stepsTarget !== null && stepsToday < stepsTarget && (
                  <div className="db-stat">
                    <span className="db-stat-label">REMAINING</span>
                    <span className="db-stat-val" style={{ fontSize: "0.95rem" }}>
                      {(stepsTarget - stepsToday).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <hr className="db-hr" />

            <div className="db-stat" style={{ marginBottom: "0.4rem" }}>
              <span className="db-stat-label">CARDIO SESSION</span>
            </div>
            {cardioToday ? (
              <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
                <div className="db-stat">
                  <span className="db-stat-label">DURATION</span>
                  <span className="db-stat-val">{cardioToday.minutes} min</span>
                </div>
                {cardioToday.avg_hr && (
                  <div className="db-stat">
                    <span className="db-stat-label">AVG HR</span>
                    <span className="db-stat-val">{cardioToday.avg_hr} bpm</span>
                  </div>
                )}
              </div>
            ) : (
              <span style={{ fontFamily: "var(--font-display)", fontSize: "0.75rem", color: "var(--text-3)" }}>
                NO CARDIO LOGGED TODAY
              </span>
            )}

            <div className="db-nav-hint">OPEN MOVEMENT →</div>
          </div>

          {/* ── TRAINING STATUS ── */}
          <div className="db-panel" onClick={nav("/app/training")} role="button"
            tabIndex={0} onKeyDown={onKey("/app/training")} aria-label="Open training">
            <div className="db-mfd">◈ TRAINING STATUS</div>

            <span className={dtBadgeCls} style={{ marginBottom: "1rem", display: "inline-flex" }}>
              {dtIcon} {dtLabel}
            </span>

            <div className="db-stat" style={{ marginBottom: "0.85rem" }}>
              <span className="db-stat-label">SESSION STATUS</span>
              <div style={{ marginTop: "0.3rem" }}>
                {trainSession
                  ? <span className="db-badge db-badge-ok">✓ SESSION LOGGED</span>
                  : <span style={{ fontFamily: "var(--font-display)", fontSize: "0.78rem", color: todayDayType === "training" ? "var(--warn)" : "var(--text-3)" }}>
                      {todayDayType === "training" ? "SESSION PENDING" : "NO SESSION REQUIRED"}
                    </span>
                }
              </div>
            </div>

            <hr className="db-hr" />

            <div className="db-stat" style={{ marginBottom: "0.85rem" }}>
              <span className="db-stat-label">ACTIVE PROTOCOL</span>
              <span className="db-stat-val" style={{ marginTop: "0.25rem" }}>
                {todayDayType === "training" ? "STRENGTH PROTOCOL"
                 : todayDayType === "high"   ? "REFEED PROTOCOL"
                 :                             "RECOVERY PROTOCOL"}
              </span>
            </div>

            <hr className="db-hr" />

            <div className="db-stat">
              <span className="db-stat-label">NUTRITION MODE</span>
              <span className="db-stat-val" style={{ marginTop: "0.25rem", fontSize: "0.9rem" }}>
                {todayDayType === "training" ? "PERFORMANCE MACROS"
                 : todayDayType === "high"   ? "SURPLUS MACROS"
                 :                             "DEFICIT MACROS"}
              </span>
            </div>

            <div className="db-nav-hint">OPEN TRAINING →</div>
          </div>
        </div>

        {/* ── NUTRITION — full width ─────────────────────────────────────────── */}
        <div className="db-panel db-nutrition" onClick={nav("/app/nutrition")} role="button"
          tabIndex={0} onKeyDown={onKey("/app/nutrition")} aria-label="Open nutrition">

          <div style={{
            display: "flex", justifyContent: "space-between",
            alignItems: "center", flexWrap: "wrap", gap: "0.5rem",
          }}>
            <div className="db-mfd" style={{ margin: 0, flex: 1, minWidth: 160 }}>◈ NUTRITION SYSTEMS</div>
            <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: "0.65rem", color: "var(--text-3)", letterSpacing: "0.1em" }}>
                {dtLabel} TARGETS
              </span>
              {calRemaining !== null && (
                <span style={{
                  fontFamily: "var(--font-display)", fontSize: "0.72rem", fontWeight: 600, letterSpacing: "0.08em",
                  color: calRemaining >= 0 ? "var(--text-2)" : "var(--bad)",
                }}>
                  {calRemaining >= 0
                    ? `${calRemaining} KCAL REMAINING`
                    : `${Math.abs(calRemaining)} KCAL OVER`}
                </span>
              )}
            </div>
          </div>

          {todayTargets ? (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: "0.9rem",
              marginTop: "1rem",
              flex: 1,
            }}>
              <MacroBar label="CALORIES" unit=" kcal" color="var(--accent-3)"
                value={calLogged} max={todayTargets.calories} />
              <MacroBar label="PROTEIN"  unit="g"    color="var(--accent-2)"
                value={Math.round(nutLogged.protein_g)} max={todayTargets.protein_g} />
              <MacroBar label="CARBS"    unit="g"    color="#4d8eff"
                value={Math.round(nutLogged.carbs_g)}   max={todayTargets.carbs_g} />
              <MacroBar label="FATS"     unit="g"    color="#f59e0b"
                value={Math.round(nutLogged.fats_g)}    max={todayTargets.fats_g} />
            </div>
          ) : (
            <div style={{ fontFamily: "var(--font-display)", fontSize: "0.85rem", color: "var(--text-3)", marginTop: "0.75rem" }}>
              NUTRITION DATA UNAVAILABLE — TAP TO CONFIGURE
            </div>
          )}

          <div className="db-nav-hint">OPEN NUTRITION →</div>
        </div>

      </div>
    </>
  );
}
