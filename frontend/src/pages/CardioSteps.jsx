import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

const formatDate = (d) => {
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const todayLocalISO = () => formatDate(new Date());

function CardioSteps() {
  const [loading, setLoading] = useState(true);
  const [savingSteps, setSavingSteps] = useState(false);
  const [savingCardio, setSavingCardio] = useState(false);
  const [error, setError] = useState("");

  const [userId, setUserId] = useState(null);
  const [stepsTarget, setStepsTarget] = useState(null);

  const [stepsInput, setStepsInput] = useState("");
  const [stepsToday, setStepsToday] = useState(null);

  const [cardioMinutesInput, setCardioMinutesInput] = useState("");
  const [cardioHrInput, setCardioHrInput] = useState("");
  const [cardioTodayMin, setCardioTodayMin] = useState(0);

  const [recentSteps, setRecentSteps] = useState([]);
  const [recentCardio, setRecentCardio] = useState([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");

      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (!user) {
        setError("Not logged in.");
        setLoading(false);
        return;
      }

      setUserId(user.id);

      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select("steps_target")
        .eq("user_id", user.id)
        .maybeSingle();

      if (pErr) {
        setError(pErr.message);
        setLoading(false);
        return;
      }

      setStepsTarget(profile?.steps_target ?? null);

      await refreshAll(user.id);

      setLoading(false);
    };

    load();
  }, []);

  const refreshAll = async (uid) => {
    const todayIso = todayLocalISO();

    const { data: stepsRow, error: sErr } = await supabase
      .from("steps_logs")
      .select("steps")
      .eq("user_id", uid)
      .eq("log_date", todayIso)
      .maybeSingle();

    if (sErr) setError(sErr.message);
    setStepsToday(stepsRow?.steps ?? null);
    setStepsInput(stepsRow?.steps ? String(stepsRow.steps) : "");

    const { data: stepsRecent, error: sRecErr } = await supabase
      .from("steps_logs")
      .select("log_date, steps")
      .eq("user_id", uid)
      .order("log_date", { ascending: false })
      .limit(14);

    if (sRecErr) setError(sRecErr.message);
    setRecentSteps(stepsRecent || []);

    const { data: cardioRowsToday, error: cTodayErr } = await supabase
      .from("cardio_logs")
      .select("minutes")
      .eq("user_id", uid)
      .eq("log_date", todayIso);

    if (cTodayErr) setError(cTodayErr.message);
    const cardioTotal = (cardioRowsToday || []).reduce((acc, r) => acc + Number(r.minutes || 0), 0);
    setCardioTodayMin(cardioTotal);

    const { data: cardioRecent, error: cRecErr } = await supabase
      .from("cardio_logs")
      .select("id, log_date, minutes, avg_hr, created_at")
      .eq("user_id", uid)
      .order("log_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(20);

    if (cRecErr) setError(cRecErr.message);
    setRecentCardio(cardioRecent || []);
  };

  const avgSteps7 = useMemo(() => {
    const recent = recentSteps.slice(0, 7);
    if (!recent.length) return null;
    const sum = recent.reduce((acc, r) => acc + Number(r.steps || 0), 0);
    return Math.round(sum / recent.length);
  }, [recentSteps]);

  const saveSteps = async () => {
    if (!userId) return;
    setError("");
    setSavingSteps(true);

    const stepsNum = Number(stepsInput);
    if (!Number.isFinite(stepsNum) || stepsNum < 0) {
      setSavingSteps(false);
      setError("Enter a valid steps number.");
      return;
    }

    const todayIso = todayLocalISO();

    const { error: e } = await supabase
      .from("steps_logs")
      .upsert(
        { user_id: userId, log_date: todayIso, steps: Math.round(stepsNum) },
        { onConflict: "user_id,log_date" }
      );

    setSavingSteps(false);

    if (e) {
      setError(e.message);
      return;
    }

    await refreshAll(userId);
  };

  const addCardio = async () => {
    if (!userId) return;
    setError("");
    setSavingCardio(true);

    const minutesNum = Number(cardioMinutesInput);
    if (!Number.isFinite(minutesNum) || minutesNum <= 0) {
      setSavingCardio(false);
      setError("Enter cardio minutes.");
      return;
    }

    const hrNum = cardioHrInput === "" ? null : Number(cardioHrInput);
    if (hrNum !== null && (!Number.isFinite(hrNum) || hrNum < 60 || hrNum > 220)) {
      setSavingCardio(false);
      setError("Average heart rate must be 60–220.");
      return;
    }

    const todayIso = todayLocalISO();

    const { error: e } = await supabase
      .from("cardio_logs")
      .insert({
        user_id: userId,
        log_date: todayIso,
        minutes: Math.round(minutesNum),
        avg_hr: hrNum === null ? null : Math.round(hrNum)
      });

    setSavingCardio(false);

    if (e) {
      setError(e.message);
      return;
    }

    setCardioMinutesInput("");
    setCardioHrInput("");
    await refreshAll(userId);
  };

  const deleteCardio = async (id) => {
    if (!userId) return;
    setError("");

    const { error: e } = await supabase
      .from("cardio_logs")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (e) {
      setError(e.message);
      return;
    }

    await refreshAll(userId);
  };

  if (loading) return <div>Loading...</div>;

  const card = { background: "#050507", border: "1px solid #2a1118", padding: "1rem" };
  const input = { width: "100%", padding: "0.6rem", background: "#111", color: "#fff", border: "1px solid #2a1118" };

return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <h1 style={{ margin: 0 }}>Cardio & Steps</h1>
          <div style={{ color: "#aaa", marginTop: "0.5rem" }}>
            Track baseline activity. The plan can adjust steps/cardio later.
          </div>
        </div>
        <div style={{ color: "#666" }}>{savingSteps || savingCardio ? "Saving..." : "Saved"}</div>
      </div>

      {error && <div style={{ color: "#ff6b6b", marginTop: "1rem" }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginTop: "1.5rem" }}>
        <div style={card}>
          <div style={{ color: "#aaa" }}>Steps today</div>
          <div style={{ fontSize: "1.4rem", marginTop: "0.4rem" }}>{stepsToday !== null ? stepsToday : "Not logged"}</div>
          <div style={{ color: "#666", marginTop: "0.4rem" }}>{stepsTarget ? `Target: ${stepsTarget}` : "No target set"}</div>
        </div>

        <div style={card}>
          <div style={{ color: "#aaa" }}>Cardio today</div>
          <div style={{ fontSize: "1.4rem", marginTop: "0.4rem" }}>{cardioTodayMin > 0 ? `${cardioTodayMin} min` : "None"}</div>
          <div style={{ color: "#666", marginTop: "0.4rem" }}>LISS is usually best for bodybuilding</div>
        </div>

        <div style={card}>
          <div style={{ color: "#aaa" }}>7-day avg steps</div>
          <div style={{ fontSize: "1.4rem", marginTop: "0.4rem" }}>{avgSteps7 !== null ? avgSteps7 : "—"}</div>
          <div style={{ color: "#666", marginTop: "0.4rem" }}>More data = better decisions</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1rem" }}>
        <div style={card}>
          <div style={{ fontWeight: 700 }}>Log steps</div>
          <div style={{ marginTop: "0.75rem" }}>
            <input
              type="number"
              value={stepsInput}
              onChange={(e) => setStepsInput(e.target.value)}
              placeholder="e.g. 8000"
              style={input}
            />
          </div>
          <button
            onClick={saveSteps}
            disabled={savingSteps}
            style={{ marginTop: "0.75rem", padding: "0.7rem", width: "100%", background: "#0b0b10", color: "#fff", border: "1px solid #2a1118" }}
          >
            {savingSteps ? "Saving..." : "Save steps"}
          </button>

          {stepsTarget && stepsToday !== null && stepsToday >= stepsTarget * 1.8 ? (
            <div style={{ marginTop: "0.75rem", color: "#ffb86b" }}>
              Very high activity today. If recovery drops or weight trend gets too aggressive, consider pulling back.
            </div>
          ) : null}
        </div>

        <div style={card}>
          <div style={{ fontWeight: 700 }}>Add cardio session</div>
          <div style={{ marginTop: "0.75rem", display: "grid", gap: "0.6rem" }}>
            <input
              type="number"
              value={cardioMinutesInput}
              onChange={(e) => setCardioMinutesInput(e.target.value)}
              placeholder="Minutes (e.g. 30)"
              style={input}
            />
            <input
              type="number"
              value={cardioHrInput}
              onChange={(e) => setCardioHrInput(e.target.value)}
              placeholder="Avg HR (optional, e.g. 120)"
              style={input}
            />
          </div>
          <button
            onClick={addCardio}
            disabled={savingCardio}
            style={{ marginTop: "0.75rem", padding: "0.7rem", width: "100%", background: "#0b0b10", color: "#fff", border: "1px solid #2a1118" }}
          >
            {savingCardio ? "Saving..." : "Add cardio"}
          </button>

          {cardioTodayMin >= 180 ? (
            <div style={{ marginTop: "0.75rem", color: "#ffb86b" }}>
              Very high cardio volume today. If recovery or performance drops, pull this back.
            </div>
          ) : null}
        </div>
      </div>

      <div style={{ marginTop: "1rem", background: "#050507", border: "1px solid #2a1118", padding: "1rem" }}>
        <div style={{ fontWeight: 700, marginBottom: "0.75rem" }}>Recent cardio sessions</div>
        {!recentCardio.length ? (
          <div style={{ color: "#666" }}>No sessions yet</div>
        ) : (
          <div style={{ display: "grid", gap: "0.5rem" }}>
            {recentCardio.map((r) => (
              <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ color: "#aaa" }}>
                  {r.log_date} — <span style={{ color: "#fff" }}>{r.minutes} min</span>
                  {r.avg_hr ? <span style={{ color: "#666" }}> @ {r.avg_hr} bpm</span> : null}
                </div>
                <button
                  onClick={() => deleteCardio(r.id)}
                  style={{ padding: "0.4rem 0.7rem", background: "transparent", color: "#fff", border: "1px solid #2a1118" }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: "1rem", background: "#050507", border: "1px solid #2a1118", padding: "1rem" }}>
        <div style={{ fontWeight: 700, marginBottom: "0.75rem" }}>Recent steps</div>
        {!recentSteps.length ? (
          <div style={{ color: "#666" }}>No steps logged yet</div>
        ) : (
          <div style={{ display: "grid", gap: "0.5rem" }}>
            {recentSteps.map((r) => (
              <div key={r.log_date} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ color: "#aaa" }}>{r.log_date}</div>
                <div style={{ color: "#fff", fontWeight: 700 }}>{r.steps}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default CardioSteps;