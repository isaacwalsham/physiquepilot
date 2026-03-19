import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import PhysiquePilotLoader from "../components/PhysiquePilotLoader";
import PageHeader from "../components/PageHeader";

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

const CSS = `
  @keyframes pp-blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.15; }
  }

  .pp-coach-page {
    width: 100%;
    font-family: var(--font-body);
  }

  .pp-section-label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-family: var(--font-display);
    font-size: 0.7rem;
    letter-spacing: 0.18em;
    color: var(--accent-3);
    text-transform: uppercase;
    margin-bottom: 1.25rem;
  }

  .pp-section-label::before {
    content: '';
    display: block;
    width: 2rem;
    height: 1px;
    background: var(--accent-3);
    opacity: 0.6;
  }

  .pp-section-label::after {
    content: '';
    display: block;
    flex: 1;
    height: 1px;
    background: var(--accent-3);
    opacity: 0.15;
  }

  /* ── Metric cards ── */
  .pp-metrics-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }

  .pp-metric-card {
    background: var(--surface-1);
    border: 1px solid var(--line-1);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .pp-metric-topbar {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.45rem 0.75rem;
    background: rgba(181, 21, 60, 0.08);
    border-bottom: 1px solid var(--line-1);
  }

  .pp-metric-code {
    font-family: var(--font-display);
    font-size: 0.62rem;
    letter-spacing: 0.14em;
    color: var(--accent-2);
    background: rgba(181, 21, 60, 0.15);
    padding: 0.1rem 0.35rem;
    border-radius: var(--radius-sm);
    border: 1px solid rgba(181, 21, 60, 0.25);
  }

  .pp-metric-title {
    font-family: var(--font-display);
    font-size: 0.68rem;
    letter-spacing: 0.1em;
    color: var(--text-2);
    text-transform: uppercase;
    flex: 1;
  }

  .pp-metric-blink {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--accent-2);
    animation: pp-blink 2.4s ease-in-out infinite;
    flex-shrink: 0;
  }

  .pp-metric-body {
    padding: 0.75rem;
  }

  .pp-metric-value {
    font-family: var(--font-display);
    font-size: 1.1rem;
    color: var(--text-1);
    line-height: 1.2;
  }

  .pp-metric-sub {
    font-size: 0.75rem;
    color: var(--text-3);
    margin-top: 0.25rem;
  }

  /* ── Chat panel ── */
  .pp-chat-panel {
    border: 1px solid rgba(181, 21, 60, 0.2);
    border-radius: var(--radius-lg);
    background: rgba(8, 3, 5, 0.9);
    overflow: hidden;
    margin-bottom: 1.5rem;
  }

  .pp-chat-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.65rem 1rem;
    background: rgba(181, 21, 60, 0.07);
    border-bottom: 1px solid rgba(181, 21, 60, 0.18);
  }

  .pp-chat-topbar-label {
    font-family: var(--font-display);
    font-size: 0.68rem;
    letter-spacing: 0.15em;
    color: var(--text-2);
    text-transform: uppercase;
  }

  .pp-chat-status {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-family: var(--font-display);
    font-size: 0.62rem;
    letter-spacing: 0.1em;
    color: var(--ok);
    text-transform: uppercase;
  }

  .pp-chat-status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--ok);
    animation: pp-blink 1.6s ease-in-out infinite;
    flex-shrink: 0;
  }

  .pp-chat-messages {
    padding: 1rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .pp-chat-empty {
    font-family: var(--font-display);
    font-size: 0.78rem;
    letter-spacing: 0.08em;
    color: var(--text-3);
    text-align: center;
    padding: 2rem 0;
  }

  .pp-bubble-wrap-user {
    display: flex;
    justify-content: flex-end;
  }

  .pp-bubble-wrap-ai {
    display: flex;
    justify-content: flex-start;
  }

  .pp-bubble-user {
    max-width: 82%;
    padding: 0.65rem 0.85rem;
    border-radius: var(--radius-md);
    background: linear-gradient(135deg, rgba(181, 21, 60, 0.25), rgba(138, 15, 46, 0.2));
    border: 1px solid rgba(181, 21, 60, 0.3);
    color: var(--text-1);
    font-family: var(--font-body);
    font-size: 0.9rem;
    line-height: 1.5;
  }

  .pp-bubble-ai {
    max-width: 82%;
    padding: 0.65rem 0.85rem;
    border-radius: var(--radius-md);
    background: var(--surface-2);
    border: 1px solid var(--line-1);
    color: var(--text-1);
    font-family: var(--font-display);
    font-size: 0.88rem;
    line-height: 1.55;
    letter-spacing: 0.02em;
  }

  .pp-bubble-ts {
    font-size: 0.62rem;
    color: var(--text-3);
    margin-top: 0.3rem;
    font-family: var(--font-display);
    letter-spacing: 0.06em;
  }

  .pp-bubble-ts-user {
    text-align: right;
  }

  .pp-chat-input-row {
    display: flex;
    gap: 0.6rem;
    padding: 0.75rem 1rem;
    border-top: 1px solid rgba(181, 21, 60, 0.15);
    background: rgba(8, 3, 5, 0.6);
  }

  .pp-chat-input {
    flex: 1;
    padding: 0.65rem 0.85rem;
    border-radius: var(--radius-md);
    border: 1px solid var(--line-1);
    background: rgba(5, 3, 5, 0.9);
    color: var(--text-1);
    font-family: var(--font-body);
    font-size: 0.9rem;
    outline: none;
    transition: border-color 0.18s, box-shadow 0.18s;
  }

  .pp-chat-input:focus {
    border-color: rgba(181, 21, 60, 0.55);
    box-shadow: 0 0 0 2px rgba(181, 21, 60, 0.12), 0 0 8px rgba(181, 21, 60, 0.08);
  }

  .pp-chat-input::placeholder {
    color: var(--text-3);
    font-family: var(--font-display);
    letter-spacing: 0.06em;
    font-size: 0.82rem;
  }

  .pp-send-btn {
    padding: 0.65rem 1.1rem;
    border-radius: var(--radius-md);
    border: 1px solid rgba(181, 21, 60, 0.4);
    background: linear-gradient(135deg, rgba(181, 21, 60, 0.3), rgba(138, 15, 46, 0.2));
    color: var(--text-1);
    font-family: var(--font-display);
    font-size: 0.75rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.18s, border-color 0.18s, opacity 0.18s;
  }

  .pp-send-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, rgba(181, 21, 60, 0.45), rgba(138, 15, 46, 0.35));
    border-color: rgba(181, 21, 60, 0.65);
  }

  .pp-send-btn:disabled {
    opacity: 0.45;
    cursor: default;
  }

  /* ── Insights panel ── */
  .pp-insights-panel {
    background: var(--surface-1);
    border: 1px solid var(--line-1);
    border-radius: var(--radius-lg);
    overflow: hidden;
    margin-bottom: 1.5rem;
  }

  .pp-panel-topbar {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.55rem 0.9rem;
    background: rgba(181, 21, 60, 0.06);
    border-bottom: 1px solid var(--line-1);
  }

  .pp-panel-code {
    font-family: var(--font-display);
    font-size: 0.62rem;
    letter-spacing: 0.14em;
    color: var(--accent-2);
    background: rgba(181, 21, 60, 0.12);
    padding: 0.1rem 0.35rem;
    border-radius: var(--radius-sm);
    border: 1px solid rgba(181, 21, 60, 0.2);
  }

  .pp-panel-title {
    font-family: var(--font-display);
    font-size: 0.68rem;
    letter-spacing: 0.12em;
    color: var(--text-2);
    text-transform: uppercase;
  }

  .pp-insights-body {
    padding: 0.9rem;
    display: grid;
    gap: 0.55rem;
  }

  .pp-insight-row {
    padding: 0.65rem 0.85rem;
    border-radius: var(--radius-md);
    border: 1px solid var(--line-1);
    background: var(--surface-2);
    font-family: var(--font-display);
    font-size: 0.8rem;
    letter-spacing: 0.04em;
    line-height: 1.4;
  }

  .pp-insight-positive {
    border-color: rgba(0, 200, 100, 0.25);
    color: var(--ok);
    background: rgba(0, 200, 100, 0.05);
  }

  .pp-insight-warning {
    border-color: rgba(255, 180, 0, 0.25);
    color: var(--warn);
    background: rgba(255, 180, 0, 0.05);
  }

  .pp-insight-info {
    color: var(--text-2);
  }

  .pp-insights-footer {
    padding: 0 0.9rem 0.75rem;
    font-family: var(--font-display);
    font-size: 0.68rem;
    letter-spacing: 0.06em;
    color: var(--text-3);
    text-transform: uppercase;
  }

  .pp-sending-badge {
    font-family: var(--font-display);
    font-size: 0.68rem;
    letter-spacing: 0.12em;
    color: var(--accent-2);
    text-transform: uppercase;
    animation: pp-blink 1s ease-in-out infinite;
    align-self: center;
  }

  .pp-error-banner {
    background: rgba(181, 21, 60, 0.1);
    border: 1px solid rgba(181, 21, 60, 0.35);
    border-radius: var(--radius-md);
    color: var(--bad);
    font-family: var(--font-display);
    font-size: 0.8rem;
    letter-spacing: 0.06em;
    padding: 0.65rem 0.9rem;
    margin-bottom: 1rem;
  }

  /* ── Responsive ── */
  @media (max-width: 980px) {
    .pp-metrics-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 520px) {
    .pp-metrics-grid {
      grid-template-columns: 1fr;
    }
    .pp-chat-input-row {
      flex-direction: column;
    }
    .pp-chat-messages {
      height: 280px;
    }
  }

  @media (min-width: 521px) {
    .pp-chat-messages {
      height: 380px;
    }
  }
`;

function Coach() {
  const todayIso = useMemo(() => formatISO(new Date()), []);
  const chatRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [userId, setUserId] = useState(null);

  const [training, setTraining] = useState(null);
  const [nutrition, setNutrition] = useState(null);
  const [steps, setSteps] = useState(null);
  const [cardio, setCardio] = useState(null);
  const [targets, setTargets] = useState({});

  const [weekStats, setWeekStats] = useState({
    weightLoggedDays: 0,
    sessionsPlanned: 0,
    sessionsCompleted: 0
  });

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

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

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");

      const { data: sessionR } = await supabase.auth.getSession(); const data = { user: sessionR?.session?.user };
      if (!data?.user) {
        setError("Not logged in");
        setLoading(false);
        return;
      }

      const uid = data.user.id;
      setUserId(uid);

      const targetMap = await loadTargets(uid);

      await Promise.all([loadToday(uid), loadWeek(uid, targetMap), loadChat(uid)]);

      setLoading(false);
    };

    load();

  }, [todayIso]);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  const loadToday = async (uid) => {

    const { data: rawT, error: tErr } = await supabase
      .from("workout_sessions")
      .select("id, training_program_days(day_name, is_rest)")
      .eq("user_id", uid)
      .eq("session_date", todayIso)
      .not("completed_at", "is", null)
      .maybeSingle();

    if (tErr && tErr.code !== "PGRST116") {
      setError(tErr.message);
    }

    const t = rawT ? {
      name: rawT.training_program_days?.day_name || null,
      is_rest_day: rawT.training_program_days?.is_rest ?? false,
    } : null;

    const n = null;

    const { data: s, error: sErr } = await supabase
      .from("steps_logs")
      .select("steps")
      .eq("user_id", uid)
      .eq("log_date", todayIso)
      .maybeSingle();

    if (sErr && sErr.code !== "PGRST116") {
      setError(sErr.message);
    }

    const { data: c, error: cErr } = await supabase
      .from("cardio_logs")
      .select("*")
      .eq("user_id", uid)
      .eq("log_date", todayIso)
      .limit(1);

    if (cErr) {
      setError(cErr.message);
    }

    setTraining(t || null);
    setNutrition(n);
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

    const startIso = addDaysISO(todayIso, -6);
    const endExclusive = addDaysISO(todayIso, 1);

    const [{ data: w, error: wErr }, { data: t, error: tErr }] = await Promise.all([
      supabase
        .from("weight_logs")
        .select("log_date")
        .eq("user_id", uid)
        .gte("log_date", startIso)
        .lt("log_date", endExclusive),
      supabase
        .from("workout_sessions")
        .select("session_date")
        .eq("user_id", uid)
        .gte("session_date", startIso)
        .lt("session_date", endExclusive)
        .not("completed_at", "is", null)
    ]);

    if (wErr || tErr) {
      setError((wErr || tErr)?.message || "Failed to load weekly stats");
      return;
    }

    const planned = (t || []).length;

    setWeekStats({
      weightLoggedDays: new Set((w || []).map((x) => x.log_date)).size,
      sessionsPlanned: planned,
      sessionsCompleted: planned
    });
  };

  const loadChat = async (uid) => {
    const { data, error: e } = await supabase
      .from("coach_messages")
      .select("*")
      .eq("user_id", uid)
      .order("created_at");

    if (e) {
      const msg = String(e.message || "");
      const status = e.status || e.statusCode;

      if (
        (msg.includes("coach_messages") && (msg.includes("Could not find") || msg.includes("schema cache"))) ||
        status === 404
      ) {
        setMessages([]);
        return;
      }

      setError(e.message);
      setMessages([]);
      return;
    }

    setMessages(data || []);
  };

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

  if (loading) return <PhysiquePilotLoader />;

  const dayType = training?.is_rest_day ? "rest" : "training";
  const targetCalories = targets?.[dayType]?.calories ?? null;
  const eaten = null;

  const remaining = null;

  const cardioMinutes =
    cardio?.duration_min ??
    cardio?.duration_minutes ??
    cardio?.duration_mins ??
    cardio?.duration ??
    cardio?.minutes ??
    cardio?.mins ??
    null;

  const cardioAvgHr =
    cardio?.avg_hr ??
    cardio?.average_hr ??
    cardio?.avg_heart_rate ??
    cardio?.heart_rate_avg ??
    cardio?.hr_avg ??
    null;

  const insights = buildInsights(weekStats);

  return (
    <div className="pp-coach-page">
      <style>{CSS}</style>

      {/* Page header */}
      <PageHeader
        title="COACH"
        right={sending ? <span className="pp-sending-badge">Transmitting…</span> : undefined}
      />

      {error && <div className="pp-error-banner">{error}</div>}

      {/* Section label */}
      <div className="pp-section-label">AI Coach</div>

      {/* Metrics snapshot */}
      <div className="pp-metrics-grid">
        <div className="pp-metric-card">
          <div className="pp-metric-topbar">
            <span className="pp-metric-code">TRN</span>
            <span className="pp-metric-title">Training</span>
            <span className="pp-metric-blink" />
          </div>
          <div className="pp-metric-body">
            <div className="pp-metric-value">{training?.name || "Unassigned"}</div>
            <div className="pp-metric-sub">{training?.is_rest_day ? "Rest day" : "Training day"}</div>
          </div>
        </div>

        <div className="pp-metric-card">
          <div className="pp-metric-topbar">
            <span className="pp-metric-code">NUT</span>
            <span className="pp-metric-title">Nutrition</span>
            <span className="pp-metric-blink" />
          </div>
          <div className="pp-metric-body">
            <div className="pp-metric-value">{targetCalories ?? "—"}</div>
            <div className="pp-metric-sub">Target kcal · intake logging pending</div>
          </div>
        </div>

        <div className="pp-metric-card">
          <div className="pp-metric-topbar">
            <span className="pp-metric-code">ACT</span>
            <span className="pp-metric-title">Steps</span>
            <span className="pp-metric-blink" />
          </div>
          <div className="pp-metric-body">
            <div className="pp-metric-value">{steps?.steps ?? 0}</div>
            <div className="pp-metric-sub">Steps logged today</div>
          </div>
        </div>

        <div className="pp-metric-card">
          <div className="pp-metric-topbar">
            <span className="pp-metric-code">CDO</span>
            <span className="pp-metric-title">Cardio</span>
            <span className="pp-metric-blink" />
          </div>
          <div className="pp-metric-body">
            <div className="pp-metric-value">{cardioMinutes ? `${cardioMinutes} min` : "None"}</div>
            {cardioAvgHr ? (
              <div className="pp-metric-sub">Avg HR: {cardioAvgHr} bpm</div>
            ) : (
              <div className="pp-metric-sub">No session recorded</div>
            )}
          </div>
        </div>
      </div>

      {/* Chat panel */}
      <div className="pp-chat-panel">
        <div className="pp-chat-topbar">
          <span className="pp-chat-topbar-label">You ↔ AI Coach</span>
          <div className="pp-chat-status">
            <span className="pp-chat-status-dot" />
            Online
          </div>
        </div>

        <div className="pp-chat-messages" ref={chatRef}>
          {messages.length === 0 ? (
            <div className="pp-chat-empty">No messages yet. Send one to get started.</div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={m.role === "user" ? "pp-bubble-wrap-user" : "pp-bubble-wrap-ai"}>
                <div>
                  <div className={m.role === "user" ? "pp-bubble-user" : "pp-bubble-ai"}>
                    {m.content}
                  </div>
                  {m.created_at && (
                    <div className={`pp-bubble-ts ${m.role === "user" ? "pp-bubble-ts-user" : ""}`}>
                      {new Date(m.created_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="pp-chat-input-row">
          <input
            className="pp-chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Transmit message to AI Coach…"
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          />
          <button
            className="pp-send-btn"
            onClick={sendMessage}
            disabled={sending}
          >
            {sending ? "Sending…" : "Transmit"}
          </button>
        </div>
      </div>

      {/* Insights panel */}
      <div className="pp-insights-panel">
        <div className="pp-panel-topbar">
          <span className="pp-panel-code">INTEL</span>
          <span className="pp-panel-title">Weekly Intelligence Report</span>
        </div>

        <div className="pp-insights-body">
          {insights.length === 0 ? (
            <div className="pp-insight-row pp-insight-info">No intelligence data available yet.</div>
          ) : (
            insights.map((i, idx) => (
              <div
                key={idx}
                className={`pp-insight-row ${
                  i.type === "positive"
                    ? "pp-insight-positive"
                    : i.type === "warning"
                    ? "pp-insight-warning"
                    : "pp-insight-info"
                }`}
              >
                {i.text}
              </div>
            ))
          )}
        </div>

        <div className="pp-insights-footer">
          Weigh-ins: {weekStats.weightLoggedDays} days · Sessions: {weekStats.sessionsCompleted}/{weekStats.sessionsPlanned}
        </div>
      </div>
    </div>
  );
}

export default Coach;
