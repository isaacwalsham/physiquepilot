import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { supabase } from "../supabaseClient";

const API_URL = (() => {
  const raw =
    import.meta?.env?.VITE_API_URL ||
    import.meta?.env?.VITE_API_BASE_URL ||
    (import.meta?.env?.PROD ? "https://physiquepilot.onrender.com" : "http://localhost:4000");
  return String(raw || "").replace(/\/+$/, "");
})();

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
            const r = await fetch(`${API_URL}/api/nutrition/init`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ user_id: user.id })
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
  }, []);

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

  if (loading) return <div>Loading...</div>;

  const card = { background: "#1e1e1e", padding: "1rem", border: "1px solid #222" };

  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ margin: 0 }}>Dashboard</h1>
        <div style={{ color: "#666" }}>{todayLocalISO()}</div>
      </div>

      {error && <div style={{ color: "#ff6b6b", marginTop: "1rem", whiteSpace: "pre-wrap" }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginTop: "1.5rem" }}>
        <div style={card}>
          <div style={{ color: "#aaa" }}>Current weight</div>
          <div style={{ fontSize: "1.4rem", marginTop: "0.4rem" }}>
            {latest ? displayWeight(latest.weight_kg) : "—"}
          </div>
          <div style={{ color: "#666", marginTop: "0.4rem" }}>
            {latest ? `Last logged: ${latest.log_date}` : "No logs yet"}
          </div>
        </div>

        <div style={card}>
          <div style={{ color: "#aaa" }}>Average trend</div>
          <div style={{ fontSize: "1.2rem", marginTop: "0.4rem" }}>{avg7 !== null ? displayWeight(avg7) : "—"}</div>
          <div style={{ color: "#666", marginTop: "0.4rem" }}>{trendText}</div>
        </div>

        <div style={card}>
          <div style={{ color: "#aaa" }}>Today</div>
          <div style={{ fontSize: "1.2rem", marginTop: "0.4rem" }}>{loggedToday ? "Logged" : "Not logged"}</div>
          <div style={{ color: "#666", marginTop: "0.4rem" }}>
            {loggedToday ? "Nice — keep the streak going." : "Log your weight first thing tomorrow morning."}
          </div>
        </div>

        <div style={card}>
          <div style={{ color: "#aaa" }}>Steps</div>
          <div style={{ fontSize: "1.2rem", marginTop: "0.4rem" }}>
            {stepsToday !== null ? `${stepsToday}` : "—"}
          </div>
          <div style={{ color: "#666", marginTop: "0.4rem" }}>
            Target: {stepsTarget !== null ? stepsTarget : "—"}
          </div>
          <button
            onClick={() => navigate("/app/cardio-steps")}
            style={{ marginTop: "0.75rem", padding: "0.45rem 0.75rem", background: "transparent", color: "#fff", border: "1px solid #333" }}
          >
            Log steps
          </button>
        </div>

        <div style={card}>
          <div style={{ color: "#aaa" }}>Cardio</div>
          <div style={{ fontSize: "1.2rem", marginTop: "0.4rem" }}>
            {cardioToday ? `${cardioToday.minutes} min` : "—"}
          </div>
          <div style={{ color: "#666", marginTop: "0.4rem" }}>
            {cardioToday && cardioToday.avg_hr ? `Avg HR: ${cardioToday.avg_hr}` : "No session logged today"}
          </div>
          <button
            onClick={() => navigate("/app/cardio-steps")}
            style={{ marginTop: "0.75rem", padding: "0.45rem 0.75rem", background: "transparent", color: "#fff", border: "1px solid #333" }}
          >
            Log cardio
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.8fr", gap: "1rem", marginTop: "1rem" }}>
        <div style={card}>
          <div style={{ fontWeight: 700 }}>Today’s nutrition</div>
          <div style={{ color: "#aaa", marginTop: "0.5rem" }}>Auto-selected by date (and your split), override in Nutrition.</div>
          <div style={{ marginTop: "0.9rem", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={{ color: "#aaa" }}>Day type</div>
            <div style={{ color: "#fff" }}>{dayLabel[todayType] || todayType}</div>
          </div>
          <div style={{ marginTop: "0.9rem", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem" }}>
            <div>
              <div style={{ color: "#aaa" }}>Calories</div>
              <div style={{ marginTop: "0.35rem", fontSize: "1.2rem" }}>{todayTargets?.calories ?? "—"}</div>
            </div>
            <div>
              <div style={{ color: "#aaa" }}>Protein</div>
              <div style={{ marginTop: "0.35rem", fontSize: "1.2rem" }}>{todayTargets ? `${todayTargets.protein_g}g` : "—"}</div>
            </div>
            <div>
              <div style={{ color: "#aaa" }}>Carbs</div>
              <div style={{ marginTop: "0.35rem", fontSize: "1.2rem" }}>{todayTargets ? `${todayTargets.carbs_g}g` : "—"}</div>
            </div>
            <div>
              <div style={{ color: "#aaa" }}>Fats</div>
              <div style={{ marginTop: "0.35rem", fontSize: "1.2rem" }}>{todayTargets ? `${todayTargets.fats_g}g` : "—"}</div>
            </div>
          </div>

          <button
            onClick={() => navigate("/app/nutrition")}
            style={{ marginTop: "0.9rem", padding: "0.6rem 1rem", background: "#2a2a2a", color: "#fff", border: "1px solid #333" }}
          >
            Open nutrition
          </button>
        </div>

        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Weekly check-in</h2>
            <button
              onClick={() => navigate("/app/check-ins")}
              style={{ padding: "0.5rem 0.8rem", background: "transparent", color: "#fff", border: "1px solid #333" }}
            >
              Go to check-ins
            </button>
          </div>

          <div style={{ marginTop: "0.75rem" }}>
            <div style={{ color: "#aaa" }}>Check-in day</div>
            <select
              value={checkInDay}
              onChange={(e) => updateCheckInDay(e.target.value)}
              style={{ marginTop: "0.5rem", background: "#111", color: "#fff", border: "1px solid #333", padding: "0.5rem 0.6rem" }}
            >
              <option>Monday</option>
              <option>Tuesday</option>
              <option>Wednesday</option>
              <option>Thursday</option>
              <option>Friday</option>
              <option>Saturday</option>
              <option>Sunday</option>
            </select>

            <div style={{ color: "#666", marginTop: "0.75rem" }}>
              Weekly check-ins will generate a PDF summary you can view anytime in the Check-ins tab.
            </div>
          </div>
        </div>
      </div>

      {!loggedToday && (
        <div style={{ marginTop: "1rem", background: "#1e1e1e", padding: "1rem", border: "1px solid #222" }}>
          <div style={{ color: "#aaa" }}>Reminder</div>
          <div style={{ marginTop: "0.5rem" }}>
            Log your weight first thing in the morning before eating or drinking, ideally after using the bathroom.
          </div>
          <button
            onClick={() => navigate("/app/weight")}
            style={{ marginTop: "0.75rem", padding: "0.6rem 1rem", background: "#2a2a2a", color: "#fff", border: "1px solid #333" }}
          >
            Log weight
          </button>
        </div>
      )}

      <div style={{ marginTop: "1rem", display: "flex", gap: "1rem" }}>
        <button
          onClick={() => navigate("/app/weight")}
          style={{ padding: "0.7rem 1rem", background: "#2a2a2a", color: "#fff", border: "1px solid #333" }}
        >
          Log weight
        </button>
        <button
          onClick={() => navigate("/app/training")}
          style={{ padding: "0.7rem 1rem", background: "#2a2a2a", color: "#fff", border: "1px solid #333" }}
        >
          View today’s training
        </button>
        <button
          onClick={() => navigate("/app/nutrition")}
          style={{ padding: "0.7rem 1rem", background: "#2a2a2a", color: "#fff", border: "1px solid #333" }}
        >
          View today’s meal plan
        </button>
      </div>
    </div>
  );
}

export default Dashboard;