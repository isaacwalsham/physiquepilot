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
const kgToLb = (kg) => kg * 2.2046226218;

const formatDate = (d) => {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};
const todayLocalISO = () => formatDate(new Date());

const DAY_ABBR = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MON_ABBR = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

const formatDisplayDate = () => {
  const d = new Date();
  return `${DAY_ABBR[d.getDay()]} ${String(d.getDate()).padStart(2, "0")} ${MON_ABBR[d.getMonth()]} ${d.getFullYear()}`;
};

const DAY_TYPE_LABELS = { training: "TRAINING DAY", rest: "REST DAY", high: "HIGH DAY" };

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
  .pp-db-wrap { width: 100%; padding-bottom: 2rem; }

  /* Scanline overlay */
  .pp-scanline {
    position: fixed; inset: 0; z-index: 9998; pointer-events: none;
    background: repeating-linear-gradient(
      0deg, transparent, transparent 2px,
      rgba(0,0,0,0.022) 2px, rgba(0,0,0,0.022) 4px
    );
  }

  /* Panel base */
  .pp-panel {
    background: #080003;
    border: 1px solid #2e0a10;
    padding: 1.25rem;
    position: relative;
    overflow: hidden;
    cursor: pointer;
    transition: border-color 0.25s ease, box-shadow 0.25s ease;
    outline: none;
  }
  .pp-panel:hover, .pp-panel:focus-visible {
    border-color: #7a0000;
    box-shadow: 0 0 22px rgba(120,0,0,0.32), inset 0 0 22px rgba(80,0,0,0.06);
  }
  .pp-panel:focus-visible { outline: 1px solid #5a0000; }

  /* Glow pulse — respects reduced-motion */
  @media (prefers-reduced-motion: no-preference) {
    @keyframes pp-glow {
      0%,100% { box-shadow: 0 0 8px rgba(100,0,0,0.18), inset 0 0 8px rgba(80,0,0,0.03); }
      50%      { box-shadow: 0 0 20px rgba(139,0,0,0.38), inset 0 0 15px rgba(80,0,0,0.07); }
    }
    .pp-panel { animation: pp-glow 5s ease-in-out infinite; }
    .pp-panel:hover { animation: none; }
  }

  /* Nav hint — revealed on hover */
  .pp-nav-hint {
    position: absolute; bottom: 0.7rem; right: 0.9rem;
    font-family: 'Courier New', Courier, monospace;
    font-size: 0.58rem; letter-spacing: 0.12em;
    color: transparent; transition: color 0.2s ease;
    text-transform: uppercase;
  }
  .pp-panel:hover .pp-nav-hint, .pp-panel:focus-visible .pp-nav-hint {
    color: #6a2020;
  }

  /* MFD section label */
  .pp-mfd {
    font-family: 'Courier New', Courier, monospace;
    font-size: 0.62rem; letter-spacing: 0.14em;
    color: #5a1a1a; text-transform: uppercase;
    display: flex; align-items: center; gap: 0.5rem;
    margin-bottom: 0.9rem;
  }
  .pp-mfd::after {
    content: ''; flex: 1; height: 1px;
    background: linear-gradient(to right, #3a0a0a, transparent);
  }

  /* Big number readout */
  .pp-bignum {
    font-family: 'Courier New', Courier, monospace;
    font-size: 2rem; font-weight: 700;
    color: #ff5555; line-height: 1;
  }

  /* Divider */
  .pp-divider {
    margin: 0.85rem 0; border: none;
    border-top: 1px solid #1e0008;
  }

  /* Status badge */
  .pp-badge {
    display: inline-flex; align-items: center; gap: 0.3rem;
    font-family: 'Courier New', Courier, monospace;
    font-size: 0.68rem; letter-spacing: 0.07em;
    padding: 0.2rem 0.55rem; border: 1px solid;
  }
  .pp-badge-training { color: #cc3333; border-color: #5a0000; background: #120003; }
  .pp-badge-rest     { color: #336699; border-color: #0a1e33; background: #020810; }
  .pp-badge-high     { color: #cc7700; border-color: #3d2200; background: #100800; }
  .pp-badge-ok       { color: #00aa44; border-color: #004422; background: #001208; }
  .pp-badge-warn     { color: #cc6600; border-color: #3d2000; background: #100800; }

  /* Main grid */
  .pp-main-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }
  @media (max-width: 900px) { .pp-main-grid { grid-template-columns: 1fr 1fr; } }
  @media (max-width: 580px) { .pp-main-grid { grid-template-columns: 1fr; } }

  /* Mission header */
  .pp-header {
    background: #060002;
    border: 1px solid #2e0a10;
    border-left: 3px solid #8b0000;
    padding: 0.9rem 1.25rem;
    margin-bottom: 0.75rem;
    display: flex; justify-content: space-between;
    align-items: center; flex-wrap: wrap; gap: 0.5rem;
  }

  /* Macro bar row */
  .pp-macro-row {
    display: grid;
    grid-template-columns: 72px 1fr 110px;
    gap: 0.5rem; align-items: center;
  }
`;

// ─── Radial Gauge ─────────────────────────────────────────────────────────────
function RadialGauge({ value, max, size = 106 }) {
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const sw = 9;
  const r = (size - sw * 2) / 2;
  const circ = 2 * Math.PI * r;
  const cx = size / 2, cy = size / 2;
  const complete = pct >= 1;
  const strokeColor = complete ? "#00cc55" : "#8b0000";
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)", display: "block" }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e0008" strokeWidth={sw} />
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke={strokeColor} strokeWidth={sw}
          strokeDasharray={`${pct * circ} ${circ}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1)" }}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
      }}>
        <span style={{
          fontFamily: "'Courier New', Courier, monospace",
          fontSize: size * 0.2, fontWeight: 700, lineHeight: 1,
          color: complete ? "#00cc55" : "#ff5555",
        }}>
          {Math.round(pct * 100)}%
        </span>
      </div>
    </div>
  );
}

// ─── Macro Progress Bar ───────────────────────────────────────────────────────
function MacroBar({ label, value, max, unit = "g", color = "#7a0000" }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const over = max > 0 && value > max * 1.05;
  return (
    <div className="pp-macro-row">
      <span style={{
        fontFamily: "'Courier New', Courier, monospace",
        fontSize: "0.62rem", color: "#5a1a1a", letterSpacing: "0.1em",
      }}>
        {label}
      </span>
      <div style={{ height: 5, background: "#150008", borderRadius: 3, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct}%`,
          background: over ? "#cc4400" : color,
          borderRadius: 3,
          transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)",
        }} />
      </div>
      <span style={{
        fontFamily: "'Courier New', Courier, monospace",
        fontSize: "0.72rem", color: over ? "#cc4400" : "#cc4444",
        textAlign: "right", whiteSpace: "nowrap",
      }}>
        {value > 0 ? Math.round(value) : "—"}{unit !== "" ? `\u00a0${unit}` : ""}
        <span style={{ color: "#3a1212" }}> / {max}{unit !== "" ? `\u00a0${unit}` : ""}</span>
      </span>
    </div>
  );
}

// ─── Loading screen ───────────────────────────────────────────────────────────
function CockpitLoader() {
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      height: "60vh", gap: "0.5rem",
    }}>
      <div style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#5a1a1a", letterSpacing: "0.2em" }}>
        INITIALISING SYSTEMS
      </div>
      <div style={{ fontFamily: "monospace", fontSize: "0.6rem", color: "#3a0a0a", letterSpacing: "0.15em" }}>
        LOADING PILOT DATA...
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
function Dashboard() {
  const navigate = useNavigate();
  const { profile, todayDayType, loading: profileLoading } = useProfile();

  const [loading, setLoading] = useState(true);
  const [unit, setUnit] = useState("kg");

  // Weight
  const [latest, setLatest] = useState(null);
  const [avg7, setAvg7] = useState(null);

  // Movement
  const [stepsToday, setStepsToday] = useState(null);
  const [stepsTarget, setStepsTarget] = useState(null);
  const [cardioToday, setCardioToday] = useState(null);

  // Training
  const [trainingSession, setTrainingSession] = useState(null);

  // Nutrition
  const [todayTargets, setTodayTargets] = useState(null);
  const [nutritionLogged, setNutritionLogged] = useState({ calories: 0, protein_g: 0, carbs_g: 0, fats_g: 0 });

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (!user) { navigate("/", { replace: true }); return; }

      const isImperial = profile?.unit_system === "imperial";
      setUnit(isImperial ? "lb" : "kg");

      const stepTarget = profile?.baseline_steps_per_day ?? profile?.steps_target ?? null;
      setStepsTarget(stepTarget !== null ? Number(stepTarget) : null);

      const todayIso = todayLocalISO();

      // ── Weight ──────────────────────────────────────────────────────────────
      const { data: logs } = await supabase
        .from("weight_logs")
        .select("log_date, weight_kg")
        .eq("user_id", user.id)
        .order("log_date", { ascending: false })
        .limit(7);

      if (logs?.length) {
        setLatest(logs[0]);
        const sumKg = logs.reduce((s, l) => s + Number(l.weight_kg), 0);
        setAvg7(sumKg / logs.length);
      } else {
        setLatest(null);
        setAvg7(null);
      }

      // ── Steps ───────────────────────────────────────────────────────────────
      const { data: sRow } = await supabase
        .from("steps_logs").select("steps")
        .eq("user_id", user.id).eq("log_date", todayIso)
        .maybeSingle();
      setStepsToday(sRow?.steps ?? null);

      // ── Cardio ──────────────────────────────────────────────────────────────
      const { data: cRows } = await supabase
        .from("cardio_logs").select("minutes, avg_hr")
        .eq("user_id", user.id).eq("log_date", todayIso)
        .order("created_at", { ascending: false }).limit(1);
      setCardioToday(cRows?.length ? cRows[0] : null);

      // ── Training session ────────────────────────────────────────────────────
      const { data: tSessions } = await supabase
        .from("training_sessions").select("log_date, is_rest_day")
        .eq("user_id", user.id).eq("log_date", todayIso).limit(1);
      setTrainingSession(tSessions?.length ? tSessions[0] : null);

      // ── Nutrition targets ────────────────────────────────────────────────────
      const dayType = todayDayType || "rest";
      let targetRow = null;
      const { data: tRow } = await supabase
        .from("nutrition_day_targets")
        .select("day_type, calories, protein_g, carbs_g, fats_g")
        .eq("user_id", user.id).eq("day_type", dayType)
        .maybeSingle();

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
              .eq("user_id", user.id).eq("day_type", dayType)
              .maybeSingle();
            targetRow = tRow2 || null;
          }
        } catch { /* silent */ }
      } else {
        targetRow = tRow || null;
      }
      setTodayTargets(targetRow);

      // ── Nutrition logged today ───────────────────────────────────────────────
      const { data: items } = await supabase
        .from("daily_nutrition_items")
        .select("calories, protein_g, carbs_g, fats_g")
        .eq("user_id", user.id).eq("log_date", todayIso);

      if (items?.length) {
        setNutritionLogged({
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

  // ── Display helpers ──────────────────────────────────────────────────────────
  const displayWeight = (kg) => {
    const n = Number(kg);
    if (!isFinite(n)) return "—";
    return unit === "lb" ? `${round1(kgToLb(n))} lb` : `${round1(n)} kg`;
  };

  const loggedToday = useMemo(() => latest?.log_date === todayLocalISO(), [latest]);

  const weightTrend = useMemo(() => {
    if (!latest || avg7 === null) return null;
    return Number(latest.weight_kg) - Number(avg7);
  }, [latest, avg7]);

  const firstName = profile?.first_name || "PILOT";
  const dayTypeLabel = DAY_TYPE_LABELS[todayDayType || "rest"] || "REST DAY";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const dayTypeBadgeClass =
    todayDayType === "training" ? "pp-badge pp-badge-training" :
    todayDayType === "high"     ? "pp-badge pp-badge-high"     :
                                  "pp-badge pp-badge-rest";
  const dayTypeIcon = todayDayType === "training" ? "▶" : todayDayType === "high" ? "▲" : "■";

  if (profileLoading || loading) return <CockpitLoader />;

  return (
    <>
      <style>{CSS}</style>
      <div className="pp-scanline" />

      <div className="pp-db-wrap">

        {/* ── Mission header ─────────────────────────────────────────────────── */}
        <div className="pp-header">
          <div>
            <div style={{
              fontFamily: "'Courier New', Courier, monospace",
              fontSize: "0.6rem", letterSpacing: "0.18em",
              color: "#5a1a1a", marginBottom: "0.3rem",
            }}>
              PHYSIQUE PILOT // COMMAND INTERFACE
            </div>
            <div style={{ fontSize: "1.05rem", fontWeight: 600, color: "#f0dada" }}>
              {greeting}, {firstName}.{" "}
              <span style={{ color: "#cc2222" }}>{dayTypeIcon} {dayTypeLabel}</span>
            </div>
          </div>
          <div style={{
            fontFamily: "'Courier New', Courier, monospace",
            fontSize: "0.72rem", color: "#4a1515", letterSpacing: "0.1em",
          }}>
            {formatDisplayDate()}
          </div>
        </div>

        {/* ── Top grid: Biometrics | Movement | Training ─────────────────────── */}
        <div className="pp-main-grid">

          {/* BIOMETRICS */}
          <div
            className="pp-panel"
            onClick={() => navigate("/app/weight")}
            role="button" tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && navigate("/app/weight")}
            aria-label="Open weight tracking"
          >
            <div className="pp-mfd">◈ BIOMETRICS</div>

            {latest ? (
              <>
                <div className="pp-bignum">{displayWeight(latest.weight_kg)}</div>

                {weightTrend !== null && (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.45rem" }}>
                    <span style={{
                      fontFamily: "monospace", fontSize: "0.85rem",
                      color: weightTrend > 0.05 ? "#cc3333" : weightTrend < -0.05 ? "#3399cc" : "#558855",
                    }}>
                      {weightTrend > 0.05 ? "↑" : weightTrend < -0.05 ? "↓" : "→"}{" "}
                      {displayWeight(Math.abs(weightTrend))}
                    </span>
                    <span style={{ fontSize: "0.68rem", color: "#4a1515" }}>vs 7-day avg</span>
                  </div>
                )}

                <div style={{ marginTop: "0.5rem" }}>
                  {loggedToday
                    ? <span className="pp-badge pp-badge-ok">✓ LOGGED TODAY</span>
                    : <span className="pp-badge pp-badge-warn">⚠ NOT LOGGED TODAY</span>}
                </div>
              </>
            ) : (
              <>
                <div className="pp-bignum" style={{ color: "#2e0a0a" }}>—</div>
                <div style={{ fontSize: "0.8rem", color: "#4a1515", marginTop: "0.4rem" }}>
                  No data. Tap to log your first weight.
                </div>
              </>
            )}

            {avg7 !== null && (
              <>
                <hr className="pp-divider" />
                <div style={{ fontFamily: "monospace", fontSize: "0.6rem", color: "#4a1515", letterSpacing: "0.1em" }}>
                  7-DAY AVG
                </div>
                <div style={{ fontFamily: "monospace", fontSize: "1.05rem", color: "#aa3333", marginTop: "0.2rem" }}>
                  {displayWeight(avg7)}
                </div>
              </>
            )}

            <div className="pp-nav-hint">OPEN WEIGHT LOG →</div>
          </div>

          {/* MOVEMENT */}
          <div
            className="pp-panel"
            onClick={() => navigate("/app/cardio-steps")}
            role="button" tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && navigate("/app/cardio-steps")}
            aria-label="Open cardio and steps"
          >
            <div className="pp-mfd">◈ MOVEMENT</div>

            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <RadialGauge value={stepsToday || 0} max={stepsTarget || 10000} size={100} />
              <div>
                <div style={{ fontFamily: "monospace", fontSize: "0.6rem", color: "#4a1515", letterSpacing: "0.1em" }}>
                  STEPS TODAY
                </div>
                <div className="pp-bignum" style={{ fontSize: "1.55rem", marginTop: "0.15rem" }}>
                  {stepsToday !== null ? stepsToday.toLocaleString() : "—"}
                </div>
                <div style={{ fontFamily: "monospace", fontSize: "0.6rem", color: "#3a0a0a", marginTop: "0.25rem" }}>
                  TARGET: {stepsTarget !== null ? stepsTarget.toLocaleString() : "—"}
                </div>
              </div>
            </div>

            <hr className="pp-divider" />
            <div style={{ fontFamily: "monospace", fontSize: "0.6rem", color: "#4a1515", letterSpacing: "0.1em" }}>
              CARDIO SESSION
            </div>

            {cardioToday ? (
              <div style={{ display: "flex", gap: "1.5rem", marginTop: "0.3rem", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontFamily: "monospace", fontSize: "0.6rem", color: "#3a0a0a" }}>DURATION</div>
                  <div style={{ fontFamily: "monospace", fontSize: "1.05rem", color: "#aa3333" }}>
                    {cardioToday.minutes} min
                  </div>
                </div>
                {cardioToday.avg_hr && (
                  <div>
                    <div style={{ fontFamily: "monospace", fontSize: "0.6rem", color: "#3a0a0a" }}>AVG HR</div>
                    <div style={{ fontFamily: "monospace", fontSize: "1.05rem", color: "#aa3333" }}>
                      {cardioToday.avg_hr} bpm
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontFamily: "monospace", fontSize: "0.72rem", color: "#3a0a0a", marginTop: "0.3rem" }}>
                NO CARDIO LOGGED TODAY
              </div>
            )}

            <div className="pp-nav-hint">OPEN MOVEMENT →</div>
          </div>

          {/* TRAINING STATUS */}
          <div
            className="pp-panel"
            onClick={() => navigate("/app/training")}
            role="button" tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && navigate("/app/training")}
            aria-label="Open training"
          >
            <div className="pp-mfd">◈ TRAINING STATUS</div>

            <span className={dayTypeBadgeClass} style={{ marginBottom: "0.85rem", display: "inline-flex" }}>
              {dayTypeIcon} {dayTypeLabel}
            </span>

            <div style={{ fontFamily: "monospace", fontSize: "0.6rem", color: "#4a1515", letterSpacing: "0.1em", marginTop: "0.75rem" }}>
              SESSION STATUS
            </div>
            <div style={{ marginTop: "0.3rem" }}>
              {trainingSession
                ? <span className="pp-badge pp-badge-ok">✓ SESSION LOGGED</span>
                : <span style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#5a2020" }}>
                    {todayDayType === "training" ? "SESSION PENDING" : "NO SESSION REQUIRED"}
                  </span>
              }
            </div>

            <hr className="pp-divider" />
            <div style={{ fontFamily: "monospace", fontSize: "0.6rem", color: "#4a1515", letterSpacing: "0.1em" }}>
              PROTOCOL
            </div>
            <div style={{ fontFamily: "monospace", fontSize: "0.9rem", color: "#aa3333", marginTop: "0.25rem" }}>
              {todayDayType === "training" ? "STRENGTH PROTOCOL"
               : todayDayType === "high"   ? "REFEED PROTOCOL"
               :                             "RECOVERY PROTOCOL"}
            </div>

            <div className="pp-nav-hint">OPEN TRAINING →</div>
          </div>
        </div>

        {/* ── Nutrition (full width) ─────────────────────────────────────────── */}
        <div
          className="pp-panel"
          onClick={() => navigate("/app/nutrition")}
          role="button" tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && navigate("/app/nutrition")}
          aria-label="Open nutrition"
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
            <div className="pp-mfd" style={{ margin: 0, flex: 1, minWidth: 160 }}>◈ NUTRITION SYSTEMS</div>
            <span style={{ fontFamily: "monospace", fontSize: "0.62rem", color: "#5a1a1a", letterSpacing: "0.1em" }}>
              {dayTypeLabel} TARGETS
            </span>
          </div>

          {todayTargets ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
              <MacroBar
                label="CALORIES" unit=" kcal" color="#8b0000"
                value={Math.round(nutritionLogged.calories)}
                max={todayTargets.calories}
              />
              <MacroBar
                label="PROTEIN" unit="g" color="#7a0018"
                value={Math.round(nutritionLogged.protein_g)}
                max={todayTargets.protein_g}
              />
              <MacroBar
                label="CARBS" unit="g" color="#6b0030"
                value={Math.round(nutritionLogged.carbs_g)}
                max={todayTargets.carbs_g}
              />
              <MacroBar
                label="FATS" unit="g" color="#5c0048"
                value={Math.round(nutritionLogged.fats_g)}
                max={todayTargets.fats_g}
              />
            </div>
          ) : (
            <div style={{ fontFamily: "monospace", fontSize: "0.8rem", color: "#4a1515" }}>
              NUTRITION DATA UNAVAILABLE — TAP TO CONFIGURE
            </div>
          )}

          <div className="pp-nav-hint">OPEN NUTRITION →</div>
        </div>

      </div>
    </>
  );
}

export default Dashboard;
