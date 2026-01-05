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

const addDaysISO = (iso, days) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return formatISO(d);
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

  // Responsive layout (simple)
  const [bp, setBp] = useState(() => {
    if (typeof window === "undefined") return "desktop";
    const w = window.innerWidth;
    if (w <= 520) return "mobile";
    if (w <= 980) return "tablet";
    return "desktop";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => {
      const w = window.innerWidth;
      setBp(w <= 520 ? "mobile" : w <= 980 ? "tablet" : "desktop");
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /* ---------------- load ---------------- */

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");

      const { data } = await supabase.auth.getUser();
      if (!data?.user) {
        setError("Not logged in");
        setLoading(false);
        return;
      }

      const uid = data.user.id;
      setUserId(uid);

      // Load targets first so weekStats can use them reliably
      const targetMap = await loadTargets(uid);

      await Promise.all([loadToday(uid), loadWeek(uid, targetMap), loadChat(uid)]);

      setLoading(false);
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      .from("daily_nutrition_targets")
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
    const { data, error: e } = await supabase
      .from("nutrition_day_targets")
      .select("day_type, calories")
      .eq("user_id", uid);

    if (e) {
      setError(e.message);
      setTargets({});
      return {};
    }

    const map = {};
    (data || []).forEach((d) => (map[d.day_type] = d));
    setTargets(map);
    return map;
  };

  const loadWeek = async (uid, targetMap) => {
    // Last 7 days inclusive (today and previous 6)
    const startIso = addDaysISO(todayIso, -6);
    const endExclusive = addDaysISO(todayIso, 1);

    const [{ data: w, error: wErr }, { data: n, error: nErr }, { data: t, error: tErr }] = await Promise.all([
      supabase
        .from("weight_logs")
        .select("log_date")
        .eq("user_id", uid)
        .gte("log_date", startIso)
        .lt("log_date", endExclusive),
      supabase
        .from("daily_nutrition")
        .select("log_date, calories")
        .eq("user_id", uid)
        .gte("log_date", startIso)
        .lt("log_date", endExclusive),
      supabase
        .from("training_sessions")
        .select("session_date, completed")
        .eq("user_id", uid)
        .gte("session_date", startIso)
        .lt("session_date", endExclusive)
    ]);

    if (wErr || nErr || tErr) {
      setError((wErr || nErr || tErr)?.message || "Failed to load weekly stats");
      return;
    }

    const calArr = (n || [])
      .map((x) => Number(x.calories))
      .filter((v) => Number.isFinite(v) && v > 0);

    // Use training target as baseline (same logic you had), but from the loaded map
    const caloriesTarget = targetMap?.training?.calories ?? null;

    setWeekStats({
      weightLoggedDays: new Set((w || []).map((x) => x.log_date)).size,
      avgCalories: calArr.length
        ? Math.round(calArr.reduce((a, b) => a + b, 0) / calArr.length)
        : null,
      caloriesTarget,
      sessionsPlanned: (t || []).length,
      sessionsCompleted: (t || []).filter((x) => x.completed).length
    });
  };

  const loadChat = async (uid) => {
    const { data, error: e } = await supabase
      .from("coach_messages")
      .select("*")
      .eq("user_id", uid)
      .order("created_at");

    if (e) {
      setError(e.message);
      setMessages([]);
      return;
    }

    setMessages(data || []);
  };

  /* ---------------- chat ---------------- */

  const sendMessage = async () => {
    if (!userId) return;
    if (!input.trim()) return;

    setSending(true);
    const text = input.trim();

    const { data, error: e } = await supabase
      .from("coach_messages")
      .insert({ user_id: userId, role: "user", content: text })
      .select()
      .single();

    if (e) {
      setError(e.message);
      setSending(false);
      return;
    }

    setMessages((m) => [...m, data]);
    setInput("");
    setSending(false);
  };

  /* ---------------- render ---------------- */

  if (loading) return <div>Loading…</div>;

  const dayType = training?.day_type || "training";
  const targetCalories = targets?.[dayType]?.calories ?? null;
  const eaten = nutrition?.calories ?? null;
  const remaining = targetCalories && eaten ? targetCalories - eaten : null;

  const insights = buildInsights(weekStats);

  const card = {
    background: "#1e1e1e",
    border: "1px solid #222",
    padding: "1rem",
    borderRadius: "14px"
  };

  const section = {
    ...card,
    padding: "1.1rem",
    marginTop: "1rem"
  };

  const small = { color: "#aaa", marginTop: "0.4rem" };

  const todayGridCols = bp === "mobile" ? "1fr" : bp === "tablet" ? "repeat(2, minmax(0, 1fr))" : "repeat(4, minmax(0, 1fr))";

  const statRow = {
    display: "grid",
    gridTemplateColumns: todayGridCols,
    gap: "1rem",
    marginTop: "1rem"
  };

  const chatBox = {
    height: bp === "mobile" ? "320px" : "420px",
    overflowY: "auto",
    border: "1px solid #333",
    borderRadius: "12px",
    padding: "0.9rem",
    background: "#111"
  };

  const bubble = (role) => ({
    maxWidth: "85%",
    marginLeft: role === "user" ? "auto" : 0,
    marginRight: role === "user" ? 0 : "auto",
    padding: "0.6rem 0.75rem",
    borderRadius: "12px",
    background: role === "user" ? "#1a1a1a" : "#0f0f0f",
    border: "1px solid #222",
    color: "#fff",
    lineHeight: 1.45
  });

  const inputRow = {
    display: "flex",
    gap: "0.5rem",
    marginTop: "0.65rem",
    flexDirection: bp === "mobile" ? "column" : "row"
  };

  const inputStyle = {
    flex: 1,
    width: "100%",
    padding: "0.7rem 0.8rem",
    borderRadius: "12px",
    border: "1px solid #333",
    background: "#111",
    color: "#fff"
  };

  const btn = {
    padding: "0.7rem 1rem",
    borderRadius: "12px",
    border: "1px solid #333",
    background: "#2a2a2a",
    color: "#fff",
    cursor: "pointer",
    whiteSpace: "nowrap"
  };

  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0 }}>Coach</h1>
          <div style={{ color: "#aaa", marginTop: "0.5rem" }}>
            {dayLabel(todayIso)} · {todayIso}
          </div>
        </div>
        <div style={{ color: "#666" }}>{sending ? "Sending…" : ""}</div>
      </div>

      {error && <div style={{ color: "#ff6b6b", marginTop: "1rem" }}>{error}</div>}

      {/* TODAY SUMMARY (responsive grid) */}
      <div style={section}>
        <div style={{ fontWeight: 700 }}>Today</div>
        <div style={small}>Quick snapshot of today’s inputs.</div>

        <div style={statRow}>
          <div style={card}>
            <div style={{ fontWeight: 700 }}>Training</div>
            <div style={{ marginTop: "0.35rem", color: "#aaa" }}>{training?.name || "Unassigned"}</div>
            <div style={{ marginTop: "0.35rem", color: "#666", fontSize: "0.9rem" }}>{training?.completed ? "Completed" : "Not completed"}</div>
          </div>

          <div style={card}>
            <div style={{ fontWeight: 700 }}>Nutrition</div>
            <div style={{ marginTop: "0.35rem", color: "#aaa" }}>Target: {targetCalories ?? "—"}</div>
            <div style={{ marginTop: "0.15rem", color: "#aaa" }}>Eaten: {eaten ?? "—"}</div>
            <div style={{ marginTop: "0.15rem", color: "#aaa" }}>Remaining: {remaining ?? "—"}</div>
          </div>

          <div style={card}>
            <div style={{ fontWeight: 700 }}>Steps</div>
            <div style={{ marginTop: "0.35rem", color: "#aaa" }}>{steps?.steps ?? 0}</div>
          </div>

          <div style={card}>
            <div style={{ fontWeight: 700 }}>Cardio</div>
            <div style={{ marginTop: "0.35rem", color: "#aaa" }}>
              {cardio ? `${cardio.duration_min} min` : "None"}
            </div>
            {cardio?.avg_hr ? (
              <div style={{ marginTop: "0.15rem", color: "#666", fontSize: "0.9rem" }}>Avg HR: {cardio.avg_hr}</div>
            ) : null}
          </div>
        </div>
      </div>

      {/* INSIGHTS (full width section) */}
      <div style={section}>
        <div style={{ fontWeight: 700 }}>Insights</div>
        <div style={small}>Based on the last 7 days.</div>

        <div style={{ marginTop: "0.85rem", display: "grid", gap: "0.6rem" }}>
          {insights.length === 0 ? (
            <div style={{ color: "#aaa" }}>No insights yet.</div>
          ) : (
            insights.map((i, idx) => (
              <div
                key={idx}
                style={{
                  padding: "0.75rem 0.85rem",
                  borderRadius: "12px",
                  border: "1px solid #222",
                  background: "#111",
                  color: i.type === "positive" ? "#b9f6ca" : i.type === "warning" ? "#ffb86b" : "#aaa"
                }}
              >
                {i.text}
              </div>
            ))
          )}
        </div>

        <div style={{ marginTop: "0.85rem", color: "#666", fontSize: "0.9rem" }}>
          Weigh-ins counted: {weekStats.weightLoggedDays} · Avg calories: {weekStats.avgCalories ?? "—"} · Training: {weekStats.sessionsCompleted}/{weekStats.sessionsPlanned}
        </div>
      </div>

      {/* CHAT (full width section) */}
      <div style={section}>
        <div style={{ fontWeight: 700 }}>Coach chat</div>
        <div style={small}>This is currently a simple log. Next step is wiring responses.</div>

        <div ref={chatRef} style={{ ...chatBox, marginTop: "0.85rem" }}>
          {messages.length === 0 ? (
            <div style={{ color: "#666" }}>No messages yet.</div>
          ) : (
            messages.map((m) => (
              <div key={m.id} style={{ marginBottom: "0.55rem" }}>
                <div style={bubble(m.role)}>{m.content}</div>
              </div>
            ))
          )}
        </div>

        <div style={inputRow}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            style={inputStyle}
            placeholder="Message Coach…"
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          />
          <button onClick={sendMessage} disabled={sending} style={{ ...btn, opacity: sending ? 0.6 : 1, cursor: sending ? "default" : "pointer" }}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default Coach;