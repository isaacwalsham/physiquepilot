import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

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

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");

      const { data: userData, error: userErr } = await supabase.auth.getUser();
      const user = userData?.user;
      if (userErr || !user) {
        setLoading(false);
        return;
      }

      const todayIso = new Date().toISOString().slice(0, 10);

      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("unit_system, check_in_day, training_days, today_day_type, today_day_type_date, split_mode, rolling_start_date, rolling_pattern")
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
          const j = await r.json().catch(() => ({}));
          setError((e) => (e ? `${e}\n${j?.error || "Failed to initialize nutrition."}` : j?.error || "Failed to initialize nutrition."));
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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginTop: "1.5rem" }}>
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