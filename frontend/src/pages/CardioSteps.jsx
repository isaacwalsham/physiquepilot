import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { useProfile } from "../context/ProfileContext";

const CSS = `
.cs-page { width: 100%; }

.cs-section-label {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-family: var(--font-display);
  font-size: 0.65rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--accent-3);
  margin-bottom: 1.4rem;
}
.cs-section-label::before {
  content: "";
  display: block;
  width: 20px;
  height: 2px;
  background: var(--accent-3);
  flex-shrink: 0;
}

.cs-stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.cs-readout {
  border: 1px solid var(--line-1);
  border-radius: var(--radius-md);
  background: var(--surface-1);
  padding: 1.25rem;
  text-align: center;
  position: relative;
  overflow: hidden;
}
.cs-readout::before {
  content: "";
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--accent-2), transparent);
  opacity: 0.5;
}
.cs-readout-value {
  font-family: var(--font-display);
  font-size: 1.9rem;
  font-weight: 700;
  line-height: 1;
  color: var(--text-1);
  letter-spacing: 0.02em;
}
.cs-readout-label {
  font-family: var(--font-display);
  font-size: 0.58rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-3);
  margin-top: 0.55rem;
}

.cs-forms-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
}

.cs-card {
  border: 1px solid var(--line-1);
  border-radius: var(--radius-md);
  background: var(--surface-1);
  overflow: hidden;
}

.cs-card-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.65rem 1rem;
  border-bottom: 1px solid var(--line-1);
  background: linear-gradient(90deg, rgba(138,15,46,0.18), rgba(138,15,46,0.06));
}
.cs-card-topbar-title {
  font-family: var(--font-display);
  font-size: 0.62rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--accent-3);
}
.cs-card-topbar-sub {
  font-family: var(--font-display);
  font-size: 0.58rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-3);
}

.cs-card-body {
  padding: 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.cs-input {
  background: rgba(10,5,8,0.9) !important;
  border: 1px solid var(--line-1) !important;
  color: var(--text-1) !important;
  border-radius: var(--radius-sm) !important;
  padding: 0.6rem 0.8rem !important;
  width: 100%;
  font-family: var(--font-body);
  font-size: 0.95rem;
  box-sizing: border-box;
}
.cs-input:focus {
  outline: none;
  border-color: var(--accent-3) !important;
  box-shadow: 0 0 0 2px rgba(222,41,82,0.28), 0 0 8px rgba(222,41,82,0.2) !important;
}

.cs-btn-primary {
  width: 100%;
  padding: 0.72rem 1rem;
  border-radius: var(--radius-sm);
  background: linear-gradient(135deg, var(--accent-1) 0%, var(--accent-2) 60%, var(--accent-3) 100%);
  color: #fff;
  border: none;
  font-family: var(--font-display);
  font-size: 0.65rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(181,21,60,0.35);
  transition: all 160ms;
}
.cs-btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
}
.cs-btn-primary:hover:not(:disabled) {
  box-shadow: 0 6px 20px rgba(222,41,82,0.45);
  transform: translateY(-1px);
}

.cs-btn-danger {
  padding: 0.35rem 0.65rem;
  border-radius: var(--radius-sm);
  background: rgba(255,79,115,0.08);
  color: var(--bad);
  border: 1px solid rgba(255,79,115,0.28);
  font-family: var(--font-display);
  font-size: 0.58rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 120ms;
  white-space: nowrap;
}
.cs-btn-danger:hover {
  background: rgba(255,79,115,0.16);
  border-color: var(--bad);
}

.cs-warn {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  border: 1px solid var(--warn);
  border-radius: var(--radius-sm);
  background: rgba(229,161,0,0.08);
  padding: 0.75rem 1rem;
  color: var(--warn);
  font-size: 0.78rem;
  line-height: 1.45;
}
.cs-warn-icon {
  font-size: 0.9rem;
  flex-shrink: 0;
  margin-top: 0.05rem;
}

.cs-error {
  font-size: 0.8rem;
  color: var(--bad);
  padding: 0.5rem 0.75rem;
  border: 1px solid rgba(255,79,115,0.3);
  border-radius: var(--radius-sm);
  background: rgba(255,79,115,0.06);
}

.cs-log-card {
  border: 1px solid var(--line-1);
  border-radius: var(--radius-md);
  background: var(--surface-1);
  overflow: hidden;
  margin-bottom: 1rem;
}

.cs-log-body {
  padding: 0.5rem 0;
}

.cs-log-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.65rem 1rem;
  border-bottom: 1px solid var(--line-1);
  gap: 0.75rem;
  transition: background 120ms;
}
.cs-log-row:last-child { border-bottom: none; }
.cs-log-row:hover { background: rgba(138,15,46,0.08); }

.cs-log-date {
  font-family: var(--font-display);
  font-size: 0.62rem;
  letter-spacing: 0.1em;
  color: var(--text-3);
  min-width: 90px;
}

.cs-log-val {
  font-family: var(--font-display);
  font-size: 0.88rem;
  color: var(--text-1);
  font-weight: 600;
  flex: 1;
}

.cs-log-sub {
  font-family: var(--font-display);
  font-size: 0.58rem;
  letter-spacing: 0.08em;
  color: var(--text-3);
  margin-left: 0.4rem;
}

/* Type badge pill */
.cs-type-pill {
  display: inline-flex;
  align-items: center;
  font-family: var(--font-display);
  font-size: 0.6rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 0.22rem 0.55rem;
  border-radius: 999px;
  border: 1px solid currentColor;
  margin-right: 0.5rem;
  opacity: 0.85;
}
.cs-type-pill.steps  { color: #5bc0f8; border-color: rgba(91,192,248,0.4); background: rgba(91,192,248,0.08); }
.cs-type-pill.cardio { color: var(--accent-3); border-color: rgba(222,41,82,0.4); background: rgba(222,41,82,0.08); }

.cs-empty {
  padding: 1.5rem 1rem;
  text-align: center;
  color: var(--text-3);
  font-family: var(--font-display);
  font-size: 0.65rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.cs-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  font-family: var(--font-display);
  font-size: 0.7rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--text-3);
}

.cs-hint {
  font-size: 0.75rem;
  color: var(--text-3);
  line-height: 1.4;
}

.cs-status-badge {
  font-family: var(--font-display);
  font-size: 0.58rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-3);
}

@media (max-width: 720px) {
  .cs-forms-row {
    grid-template-columns: 1fr;
  }
  .cs-stats-row {
    gap: 0.65rem;
  }
  .cs-readout-value { font-size: 1.45rem; }
}
@media (max-width: 540px) {
  .cs-stats-row {
    grid-template-columns: 1fr;
    gap: 0.6rem;
  }
  .cs-readout { text-align: left; padding: 1rem; }
}
`;

const formatDate = (d) => {
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const todayLocalISO = () => formatDate(new Date());

function CardioSteps() {
  const { profile } = useProfile();
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

  // Set step target from onboarding baseline (prefer baseline_steps_per_day, fallback to steps_target)
  useEffect(() => {
    if (!profile) return;
    const target = profile.baseline_steps_per_day ?? profile.steps_target ?? null;
    setStepsTarget(target !== null ? Number(target) : null);
  }, [profile]);

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

  // Build unified activity log sorted by date desc
  const activityLog = useMemo(() => {
    const stepsRows = recentSteps.map((r) => ({
      key: `s-${r.log_date}`,
      date: r.log_date,
      type: "steps",
      value: `${r.steps.toLocaleString()} steps`,
      sub: null,
      id: null
    }));

    const cardioRows = recentCardio.map((r) => ({
      key: `c-${r.id}`,
      date: r.log_date,
      type: "cardio",
      value: `${r.minutes} min`,
      sub: r.avg_hr ? `@ ${r.avg_hr} bpm` : null,
      id: r.id
    }));

    return [...stepsRows, ...cardioRows].sort((a, b) =>
      b.date.localeCompare(a.date)
    );
  }, [recentSteps, recentCardio]);

  const showStepsWarn = stepsTarget && stepsToday !== null && stepsToday >= stepsTarget * 1.8;
  const showCardioWarn = cardioTodayMin >= 180;

  if (loading) {
    return (
      <>
        <style>{CSS}</style>
        <div className="cs-loading">Initialising activity monitor...</div>
      </>
    );
  }

  const isSaving = savingSteps || savingCardio;

  return (
    <>
      <style>{CSS}</style>
      <div className="cs-page">

        {/* Section label */}
        <div className="cs-section-label">Activity Monitor</div>

        {/* Top stats row */}
        <div className="cs-stats-row">
          <div className="cs-readout">
            <div className="cs-readout-value">
              {stepsToday !== null ? stepsToday.toLocaleString() : "—"}
            </div>
            <div className="cs-readout-label">Steps Today</div>
          </div>

          <div className="cs-readout">
            <div className="cs-readout-value">
              {cardioTodayMin > 0 ? `${cardioTodayMin} min` : "—"}
            </div>
            <div className="cs-readout-label">Cardio Today</div>
          </div>

          <div className="cs-readout">
            <div className="cs-readout-value">
              {avgSteps7 !== null ? avgSteps7.toLocaleString() : "—"}
            </div>
            <div className="cs-readout-label">7-Day Avg Steps</div>
          </div>
        </div>

        {error && <div className="cs-error" style={{ marginBottom: "1rem" }}>{error}</div>}

        {/* Log forms */}
        <div className="cs-forms-row">

          {/* Log steps */}
          <div className="cs-card">
            <div className="cs-card-topbar">
              <span className="cs-card-topbar-title">ACT-S // Log Steps</span>
              <span className="cs-card-topbar-sub">
                {stepsTarget ? `Target: ${stepsTarget.toLocaleString()}` : "No target set"}
              </span>
            </div>
            <div className="cs-card-body">
              <input
                className="cs-input"
                type="number"
                value={stepsInput}
                onChange={(e) => setStepsInput(e.target.value)}
                placeholder="e.g. 8000"
              />
              <button
                className="cs-btn-primary"
                onClick={saveSteps}
                disabled={savingSteps}
              >
                {savingSteps ? "Saving..." : "Save Steps"}
              </button>

              {stepsTarget && (
                <div className="cs-hint">
                  {stepsToday !== null
                    ? `${Math.round((stepsToday / stepsTarget) * 100)}% of daily target`
                    : "Log steps to see target progress"}
                </div>
              )}

              {showStepsWarn && (
                <div className="cs-warn">
                  <span className="cs-warn-icon">&#9888;</span>
                  <span>Very high activity today. If recovery drops or weight trend gets too aggressive, consider pulling back.</span>
                </div>
              )}
            </div>
          </div>

          {/* Log cardio */}
          <div className="cs-card">
            <div className="cs-card-topbar">
              <span className="cs-card-topbar-title">ACT-C // Log Cardio</span>
              <span className="cs-card-topbar-sub">
                {isSaving ? "Saving..." : "Ready"}
              </span>
            </div>
            <div className="cs-card-body">
              <input
                className="cs-input"
                type="number"
                value={cardioMinutesInput}
                onChange={(e) => setCardioMinutesInput(e.target.value)}
                placeholder="Minutes (e.g. 30)"
              />
              <input
                className="cs-input"
                type="number"
                value={cardioHrInput}
                onChange={(e) => setCardioHrInput(e.target.value)}
                placeholder="Avg HR — optional (60–220)"
              />
              <button
                className="cs-btn-primary"
                onClick={addCardio}
                disabled={savingCardio}
              >
                {savingCardio ? "Saving..." : "Add Cardio Session"}
              </button>

              <div className="cs-hint">
                Multiple sessions can be added per day. LISS is usually best for bodybuilding.
              </div>

              {showCardioWarn && (
                <div className="cs-warn">
                  <span className="cs-warn-icon">&#9888;</span>
                  <span>Very high cardio volume today. If recovery or performance drops, pull this back.</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Unified activity log */}
        <div className="cs-log-card">
          <div className="cs-card-topbar">
            <span className="cs-card-topbar-title">Activity Log</span>
            <span className="cs-card-topbar-sub">{activityLog.length} entries</span>
          </div>
          <div className="cs-log-body">
            {activityLog.length === 0 && (
              <div className="cs-empty">No activity logged yet — start tracking above.</div>
            )}
            {activityLog.map((row) => (
              <div key={row.key} className="cs-log-row">
                <div className="cs-log-date">{row.date}</div>
                <div className="cs-log-val">
                  <span className={`cs-type-pill ${row.type}`}>
                    {row.type === "steps" ? "Steps" : "Cardio"}
                  </span>
                  {row.value}
                  {row.sub && <span className="cs-log-sub">{row.sub}</span>}
                </div>
                <div>
                  {row.type === "cardio" && row.id && (
                    <button
                      className="cs-btn-danger"
                      onClick={() => deleteCardio(row.id)}
                    >
                      Del
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </>
  );
}

export default CardioSteps;
