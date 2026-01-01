import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";

/* ---------------- helpers ---------------- */

const formatISO = (d) => {
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const dayLabel = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long"
  });

const buildInsights = (w) => {
  const out = [];

  if (w.weightLoggedDays === 0) {
    out.push({ type: "warning", text: "No weigh-ins logged this week." });
  } else if (w.weightLoggedDays < 3) {
    out.push({ type: "info", text: "Low weigh-in frequency. Aim for 4–7." });
  } else {
    out.push({ type: "positive", text: "Good weigh-in consistency." });
  }

  if (w.avgCalories && w.caloriesTarget) {
    const diff = w.avgCalories - w.caloriesTarget;
    if (Math.abs(diff) <= w.caloriesTarget * 0.05) {
      out.push({ type: "positive", text: "Calories well controlled this week." });
    } else if (diff > 0) {
      out.push({ type: "warning", text: "Calories ran high on average." });
    } else {
      out.push({ type: "info", text: "Calories were low. Watch recovery." });
    }
  }

  if (w.sessionsPlanned > 0) {
    if (w.sessionsCompleted === w.sessionsPlanned) {
      out.push({ type: "positive", text: "All training sessions completed." });
    } else {
      out.push({
        type: "info",
        text: `Training: ${w.sessionsCompleted}/${w.sessionsPlanned} completed.`
      });
    }
  }

  return out;
};

/* ---------------- component ---------------- */

function Coach() {
  const todayIso = useMemo(() => formatISO(new Date()), []);
  const chatRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [userId, setUserId] = useState(null);

  // Today
  const [training, setTraining] = useState(null);
  const [nutrition, setNutrition] = useState(null);
  const [steps, setSteps] = useState(null);
  const [cardio, setCardio] = useState(null);
  const [targets, setTargets] = useState({});

  // Week
  const [weekStats, setWeekStats] = useState({
    weightLoggedDays: 0,
    avgCalories: null,
    caloriesTarget: null,
    sessionsPlanned: 0,
    sessionsCompleted: 0
  });

  // Chat
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  /* ---------------- load ---------------- */

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const { data } = await supabase.auth.getUser();
      if (!data?.user) {
        setError("Not logged in");
        setLoading(false);
        return;
      }

      const uid = data.user.id;
      setUserId(uid);

      await Promise.all([
        loadToday(uid),
        loadTargets(uid),
        loadWeek(uid),
        loadChat(uid)
      ]);

      setLoading(false);
    };

    load();
  }, [todayIso]);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  /* ---------------- data loaders ---------------- */

  const loadToday = async (uid) => {
    const { data: t } = await supabase
      .from("training_sessions")
      .select("name, day_type, completed")
      .eq("user_id", uid)
      .eq("session_date", todayIso)
      .maybeSingle();

    const { data: n } = await supabase
      .from("daily_nutrition")
      .select("calories")
      .eq("user_id", uid)
      .eq("log_date", todayIso)
      .maybeSingle();

    const { data: s } = await supabase
      .from("steps_logs")
      .select("steps")
      .eq("user_id", uid)
      .eq("log_date", todayIso)
      .maybeSingle();

    const { data: c } = await supabase
      .from("cardio_logs")
      .select("duration_min, avg_hr")
      .eq("user_id", uid)
      .eq("log_date", todayIso)
      .order("created_at", { ascending: false })
      .limit(1);

    setTraining(t || null);
    setNutrition(n || null);
    setSteps(s || null);
    setCardio(c?.[0] || null);
  };

  const loadTargets = async (uid) => {
    const { data } = await supabase
      .from("nutrition_day_targets")
      .select("day_type, calories")
      .eq("user_id", uid);

    const map = {};
    (data || []).forEach((d) => (map[d.day_type] = d));
    setTargets(map);
  };

  const loadWeek = async (uid) => {
    const { data: w } = await supabase
      .from("weight_logs")
      .select("log_date")
      .eq("user_id", uid);

    const { data: n } = await supabase
      .from("daily_nutrition")
      .select("calories")
      .eq("user_id", uid);

    const { data: t } = await supabase
      .from("training_sessions")
      .select("completed")
      .eq("user_id", uid);

    const calArr = (n || []).map((x) => x.calories).filter(Boolean);

    setWeekStats({
      weightLoggedDays: new Set((w || []).map((x) => x.log_date)).size,
      avgCalories: calArr.length
        ? Math.round(calArr.reduce((a, b) => a + b, 0) / calArr.length)
        : null,
      caloriesTarget: targets.training?.calories ?? null,
      sessionsPlanned: t?.length || 0,
      sessionsCompleted: (t || []).filter((x) => x.completed).length
    });
  };

  const loadChat = async (uid) => {
    const { data } = await supabase
      .from("coach_messages")
      .select("*")
      .eq("user_id", uid)
      .order("created_at");

    setMessages(data || []);
  };

  /* ---------------- chat ---------------- */

  const sendMessage = async () => {
    if (!input.trim()) return;

    setSending(true);
    const text = input.trim();

    const { data } = await supabase
      .from("coach_messages")
      .insert({ user_id: userId, role: "user", content: text })
      .select()
      .single();

    setMessages((m) => [...m, data]);
    setInput("");
    setSending(false);
  };

  /* ---------------- render ---------------- */

  if (loading) return <div>Loading…</div>;

  const dayType = training?.day_type || "training";
  const targetCalories = targets?.[dayType]?.calories ?? null;
  const eaten = nutrition?.calories ?? null;
  const remaining =
    targetCalories && eaten ? targetCalories - eaten : null;

  const insights = buildInsights(weekStats);

  return (
    <div style={{ maxWidth: "1920px", width: "100%" }}>
      <h1>Coach</h1>
      <div style={{ color: "#aaa" }}>
        {dayLabel(todayIso)} · {todayIso}
      </div>

      {error && <div style={{ color: "red" }}>{error}</div>}

      {/* TODAY */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "1rem", marginTop: "1rem" }}>
        <div className="card">
          <h3>Training</h3>
          <div>{training?.name || "Unassigned"}</div>
        </div>

        <div className="card">
          <h3>Nutrition</h3>
          <div>Target: {targetCalories ?? "—"}</div>
          <div>Eaten: {eaten ?? "—"}</div>
          <div>Remaining: {remaining ?? "—"}</div>
        </div>

        <div className="card">
          <h3>Steps</h3>
          <div>{steps?.steps ?? 0}</div>
        </div>

        <div className="card">
          <h3>Cardio</h3>
          <div>{cardio ? `${cardio.duration_min} min` : "None"}</div>
        </div>
      </div>

      {/* INSIGHTS */}
      <div style={{ marginTop: "1rem" }}>
        <h2>Insights</h2>
        {insights.map((i, idx) => (
          <div key={idx}>{i.text}</div>
        ))}
      </div>

      {/* CHAT */}
      <div style={{ marginTop: "1rem" }}>
        <h2>Coach Chat</h2>
        <div
          ref={chatRef}
          style={{
            height: "400px",
            overflowY: "auto",
            border: "1px solid #333",
            padding: "1rem"
          }}
        >
          {messages.map((m) => (
            <div
              key={m.id}
              style={{
                textAlign: m.role === "user" ? "right" : "left",
                marginBottom: "0.5rem"
              }}
            >
              {m.content}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            style={{ flex: 1 }}
            placeholder="Message Coach…"
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          />
          <button onClick={sendMessage} disabled={sending}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default Coach;