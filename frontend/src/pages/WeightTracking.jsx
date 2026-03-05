import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from "recharts";

const CSS = `
.wt-page { width: 100%; }

.wt-section-label {
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
.wt-section-label::before {
  content: "";
  display: block;
  width: 20px;
  height: 2px;
  background: var(--accent-3);
  flex-shrink: 0;
}

.wt-stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.wt-readout {
  border: 1px solid var(--line-1);
  border-radius: var(--radius-md);
  background: var(--surface-1);
  padding: 1.25rem;
  text-align: center;
  position: relative;
  overflow: hidden;
}
.wt-readout::before {
  content: "";
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--accent-2), transparent);
  opacity: 0.5;
}
.wt-readout-value {
  font-family: var(--font-display);
  font-size: 1.9rem;
  font-weight: 700;
  line-height: 1;
  color: var(--text-1);
  letter-spacing: 0.02em;
}
.wt-readout-value.ok   { color: var(--ok); }
.wt-readout-value.bad  { color: var(--bad); }
.wt-readout-value.neutral { color: var(--text-2); }
.wt-readout-label {
  font-family: var(--font-display);
  font-size: 0.58rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-3);
  margin-top: 0.55rem;
}

.wt-main-grid {
  display: grid;
  grid-template-columns: 1.35fr 0.65fr;
  gap: 1rem;
  margin-bottom: 1rem;
}

.wt-card {
  border: 1px solid var(--line-1);
  border-radius: var(--radius-md);
  background: var(--surface-1);
  overflow: hidden;
}

.wt-card-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.65rem 1rem;
  border-bottom: 1px solid var(--line-1);
  background: linear-gradient(90deg, rgba(138,15,46,0.18), rgba(138,15,46,0.06));
}
.wt-card-topbar-title {
  font-family: var(--font-display);
  font-size: 0.62rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--accent-3);
}
.wt-card-topbar-sub {
  font-family: var(--font-display);
  font-size: 0.58rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-3);
}

.wt-chart-wrap {
  padding: 1rem 0.5rem 0.5rem 0;
  height: 300px;
}

.wt-log-body {
  padding: 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.wt-unit-pills {
  display: flex;
  gap: 0.4rem;
}
.wt-pill {
  font-family: var(--font-display);
  font-size: 0.6rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  padding: 0.32rem 0.7rem;
  border-radius: 999px;
  border: 1px solid var(--line-2);
  background: transparent;
  color: var(--text-3);
  cursor: pointer;
  transition: all 120ms;
}
.wt-pill.active {
  background: linear-gradient(135deg, var(--accent-1), var(--accent-2));
  border-color: var(--accent-2);
  color: #fff;
  box-shadow: 0 0 10px rgba(181,21,60,0.35);
}

.wt-input {
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
.wt-input:focus {
  outline: none;
  border-color: var(--accent-3) !important;
  box-shadow: 0 0 0 2px rgba(222,41,82,0.28), 0 0 8px rgba(222,41,82,0.2) !important;
}
.wt-input-row {
  display: flex;
  gap: 0.5rem;
}
.wt-input-row .wt-input {
  flex: 1;
}

.wt-btn-primary {
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
.wt-btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
}
.wt-btn-primary:hover:not(:disabled) {
  box-shadow: 0 6px 20px rgba(222,41,82,0.45);
  transform: translateY(-1px);
}

.wt-btn-ghost {
  padding: 0.4rem 0.75rem;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-2);
  border: 1px solid var(--line-1);
  font-family: var(--font-display);
  font-size: 0.58rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 120ms;
}
.wt-btn-ghost:hover {
  border-color: var(--line-2);
  color: var(--text-1);
}

.wt-btn-danger {
  padding: 0.4rem 0.75rem;
  border-radius: var(--radius-sm);
  background: rgba(255,79,115,0.08);
  color: var(--bad);
  border: 1px solid rgba(255,79,115,0.28);
  font-family: var(--font-display);
  font-size: 0.58rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 120ms;
}
.wt-btn-danger:hover {
  background: rgba(255,79,115,0.16);
  border-color: var(--bad);
}

.wt-save-cancel {
  display: flex;
  gap: 0.5rem;
}
.wt-save-cancel .wt-btn-primary {
  flex: 1;
}

.wt-hint {
  font-size: 0.75rem;
  color: var(--text-3);
  line-height: 1.4;
}

.wt-error {
  font-size: 0.8rem;
  color: var(--bad);
  padding: 0.5rem 0.75rem;
  border: 1px solid rgba(255,79,115,0.3);
  border-radius: var(--radius-sm);
  background: rgba(255,79,115,0.06);
}

.wt-recent-card {
  border: 1px solid var(--line-1);
  border-radius: var(--radius-md);
  background: var(--surface-1);
  overflow: hidden;
  margin-bottom: 1rem;
}
.wt-recent-body {
  padding: 0.5rem 0;
}
.wt-recent-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.65rem 1rem;
  border-bottom: 1px solid var(--line-1);
  gap: 1rem;
  transition: background 120ms;
}
.wt-recent-row:last-child { border-bottom: none; }
.wt-recent-row:hover { background: rgba(138,15,46,0.08); }

.wt-recent-date {
  font-family: var(--font-display);
  font-size: 0.62rem;
  letter-spacing: 0.1em;
  color: var(--text-3);
  min-width: 90px;
}
.wt-recent-val {
  font-family: var(--font-display);
  font-size: 0.9rem;
  color: var(--text-1);
  font-weight: 600;
  flex: 1;
}
.wt-recent-actions {
  display: flex;
  gap: 0.4rem;
  align-items: center;
}

.wt-inline-edit {
  display: flex;
  gap: 0.4rem;
  align-items: center;
  flex: 1;
}
.wt-inline-edit .wt-input {
  max-width: 100px;
  padding: 0.35rem 0.6rem !important;
  font-size: 0.85rem;
}
.wt-inline-edit-pair {
  display: flex;
  gap: 0.3rem;
  flex: 1;
}
.wt-inline-edit-pair .wt-input {
  max-width: 72px;
  padding: 0.35rem 0.5rem !important;
  font-size: 0.82rem;
}

.wt-empty {
  padding: 1.5rem 1rem;
  text-align: center;
  color: var(--text-3);
  font-family: var(--font-display);
  font-size: 0.65rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.wt-loading {
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

@media (max-width: 860px) {
  .wt-main-grid {
    grid-template-columns: 1fr;
  }
  .wt-stats-row {
    grid-template-columns: repeat(3, 1fr);
    gap: 0.65rem;
  }
  .wt-readout-value { font-size: 1.45rem; }
}
@media (max-width: 540px) {
  .wt-stats-row {
    grid-template-columns: 1fr;
    gap: 0.6rem;
  }
  .wt-readout { text-align: left; padding: 1rem; }
}
`;

const kgToLb = (kg) => kg * 2.2046226218;
const lbToKg = (lb) => lb / 2.2046226218;

const kgToStoneLb = (kg) => {
  const totalLb = kgToLb(kg);
  const st = Math.floor(totalLb / 14);
  const lb = totalLb - st * 14;
  return { st, lb };
};

const stoneLbToKg = (st, lb) => {
  const totalLb = Number(st) * 14 + Number(lb);
  if (!isFinite(totalLb)) return null;
  return lbToKg(totalLb);
};

const round1 = (n) => Math.round(n * 10) / 10;

const formatDate = (d) => {
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const todayLocalISO = () => formatDate(new Date());

const CustomTooltip = ({ active, payload, label, unit }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "var(--surface-2)",
      border: "1px solid var(--line-2)",
      borderRadius: "var(--radius-sm)",
      padding: "0.55rem 0.85rem",
      fontFamily: "var(--font-display)",
      fontSize: "0.65rem",
      letterSpacing: "0.1em",
      color: "var(--text-1)"
    }}>
      <div style={{ color: "var(--text-3)", marginBottom: "0.25rem" }}>{label}</div>
      <div style={{ color: "var(--accent-3)" }}>
        {payload[0]?.value} {unit === "st" ? "lb-total" : unit}
      </div>
    </div>
  );
};

function WeightTracking() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [userId, setUserId] = useState(null);
  const [unit, setUnit] = useState("kg");

  const [weightKgInput, setWeightKgInput] = useState("");
  const [weightLbInput, setWeightLbInput] = useState("");
  const [weightStInput, setWeightStInput] = useState("");
  const [weightStLbInput, setWeightStLbInput] = useState("");

  const [logs, setLogs] = useState([]);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    const init = async () => {
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

      const { data: profile } = await supabase
        .from("profiles")
        .select("unit_system")
        .eq("user_id", user.id)
        .single();

      if (profile?.unit_system === "imperial") setUnit("lb");
      else setUnit("kg");

      await refreshLogs(user.id);
      setLoading(false);
    };

    init();
  }, []);

  const refreshLogs = async (uid) => {
    const { data, error: e } = await supabase
      .from("weight_logs")
      .select("id, log_date, weight_kg, created_at")
      .eq("user_id", uid)
      .order("log_date", { ascending: false })
      .limit(60);

    if (e) {
      setError(e.message);
      return;
    }
    setLogs(data || []);
  };

  const latest = logs?.[0] || null;

  const loggedToday = useMemo(() => {
    if (!latest) return false;
    return latest.log_date === todayLocalISO();
  }, [latest]);

  const chartData = useMemo(() => {
    const arr = [...logs].reverse();
    return arr.map((l) => {
      const v =
        unit === "kg"
          ? Number(l.weight_kg)
          : unit === "lb"
          ? kgToLb(Number(l.weight_kg))
          : (() => {
              const { st, lb } = kgToStoneLb(Number(l.weight_kg));
              return st * 14 + lb;
            })();

      return {
        date: l.log_date,
        value: round1(v)
      };
    });
  }, [logs, unit]);

  const avg7 = useMemo(() => {
    const recent = logs.slice(0, 7);
    if (recent.length === 0) return null;
    const sumKg = recent.reduce((acc, l) => acc + Number(l.weight_kg), 0);
    const avgKg = sumKg / recent.length;

    if (unit === "kg") return round1(avgKg);
    if (unit === "lb") return round1(kgToLb(avgKg));
    const totalLb = kgToLb(avgKg);
    return round1(totalLb);
  }, [logs, unit]);

  // Compute weekly trend: slope over recent logs (kg/wk)
  const weeklyTrend = useMemo(() => {
    const recent = [...logs].reverse().slice(-14);
    if (recent.length < 2) return null;
    const n = recent.length;
    // Simple linear regression over index
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
      const y = Number(recent[i].weight_kg);
      sumX += i; sumY += y; sumXY += i * y; sumX2 += i * i;
    }
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    // slope is per log; assume roughly daily logs → ×7 for per week
    const kgPerWeek = slope * 7;
    return round1(kgPerWeek);
  }, [logs]);

  const trendDisplay = useMemo(() => {
    if (weeklyTrend === null) return { label: "—", cls: "neutral" };
    const kgPw = weeklyTrend;
    let val;
    if (unit === "kg") val = kgPw;
    else if (unit === "lb") val = round1(kgToLb(Math.abs(kgPw)) * Math.sign(kgPw));
    else val = round1(kgToLb(Math.abs(kgPw)) * Math.sign(kgPw));

    const sign = val > 0 ? "+" : "";
    const unitSuffix = unit === "kg" ? "kg" : "lb";
    const label = `${sign}${val} ${unitSuffix}/wk`;
    const cls = val > 0 ? "ok" : val < 0 ? "bad" : "neutral";
    return { label, cls };
  }, [weeklyTrend, unit]);

  const displayWeight = (kg) => {
    const n = Number(kg);
    if (!isFinite(n)) return "—";
    if (unit === "kg") return `${round1(n)} kg`;
    if (unit === "lb") return `${round1(kgToLb(n))} lb`;
    const { st, lb } = kgToStoneLb(n);
    return `${st} st ${round1(lb)} lb`;
  };

  const resetInputs = () => {
    setWeightKgInput("");
    setWeightLbInput("");
    setWeightStInput("");
    setWeightStLbInput("");
  };

  const getInputWeightKg = () => {
    if (unit === "kg") {
      const n = Number(weightKgInput);
      if (!isFinite(n) || n <= 0) return null;
      return n;
    }
    if (unit === "lb") {
      const n = Number(weightLbInput);
      if (!isFinite(n) || n <= 0) return null;
      return lbToKg(n);
    }
    const st = Number(weightStInput);
    const lb = Number(weightStLbInput);
    if (!isFinite(st) || !isFinite(lb)) return null;
    if (st < 0 || lb < 0) return null;
    const kg = stoneLbToKg(st, lb);
    if (!kg || kg <= 0) return null;
    return kg;
  };

  const startEdit = (log) => {
    setEditingId(log.id);
    const kg = Number(log.weight_kg);
    if (unit === "kg") setWeightKgInput(String(round1(kg)));
    if (unit === "lb") setWeightLbInput(String(round1(kgToLb(kg))));
    if (unit === "st") {
      const { st, lb } = kgToStoneLb(kg);
      setWeightStInput(String(st));
      setWeightStLbInput(String(round1(lb)));
    }
  };

  const saveToday = async () => {
    if (!userId) return;
    setSaving(true);
    setError("");

    const kg = getInputWeightKg();
    if (!kg) {
      setSaving(false);
      setError("Enter a valid weight.");
      return;
    }

    const logDate = todayLocalISO();

    const payload = {
      user_id: userId,
      log_date: logDate,
      weight_kg: kg
    };

    const { error: upsertError } = await supabase
      .from("weight_logs")
      .upsert(payload, { onConflict: "user_id,log_date" });

    setSaving(false);

    if (upsertError) {
      setError(upsertError.message);
      return;
    }

    resetInputs();
    await refreshLogs(userId);
  };

  const updateLog = async () => {
    if (!userId || !editingId) return;
    setSaving(true);
    setError("");

    const kg = getInputWeightKg();
    if (!kg) {
      setSaving(false);
      setError("Enter a valid weight.");
      return;
    }

    const { error: e } = await supabase
      .from("weight_logs")
      .update({ weight_kg: kg })
      .eq("id", editingId)
      .eq("user_id", userId);

    setSaving(false);

    if (e) {
      setError(e.message);
      return;
    }

    setEditingId(null);
    resetInputs();
    await refreshLogs(userId);
  };

  const deleteLog = async (id) => {
    if (!userId) return;
    setError("");

    const { error: e } = await supabase
      .from("weight_logs")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (e) {
      setError(e.message);
      return;
    }

    await refreshLogs(userId);
  };

  if (loading) {
    return (
      <>
        <style>{CSS}</style>
        <div className="wt-loading">Initialising weight command...</div>
      </>
    );
  }

  const avg7Display = avg7 !== null
    ? `${avg7} ${unit === "st" ? "lb" : unit}`
    : "—";

  return (
    <>
      <style>{CSS}</style>
      <div className="wt-page">

        {/* Section label */}
        <div className="wt-section-label">Weight Command</div>

        {/* Top stats row */}
        <div className="wt-stats-row">
          <div className="wt-readout">
            <div className="wt-readout-value">
              {latest ? displayWeight(latest.weight_kg) : "—"}
            </div>
            <div className="wt-readout-label">Current</div>
          </div>

          <div className="wt-readout">
            <div className="wt-readout-value">
              {avg7Display}
            </div>
            <div className="wt-readout-label">7-Day Avg</div>
          </div>

          <div className="wt-readout">
            <div className={`wt-readout-value ${trendDisplay.cls}`}>
              {trendDisplay.label}
            </div>
            <div className="wt-readout-label">Trend</div>
          </div>
        </div>

        {/* Chart + Log form */}
        <div className="wt-main-grid">

          {/* Chart card */}
          <div className="wt-card">
            <div className="wt-card-topbar">
              <span className="wt-card-topbar-title">
                Weight Trend &mdash; {logs.length} Days
              </span>
              <span className="wt-card-topbar-sub">
                {loggedToday ? "Logged today" : "Not logged today"}
              </span>
            </div>
            <div className="wt-chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "var(--text-3)", fontSize: 10, fontFamily: "var(--font-display)" }}
                    tickLine={false}
                    axisLine={{ stroke: "var(--line-1)" }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fill: "var(--text-3)", fontSize: 10, fontFamily: "var(--font-display)" }}
                    tickLine={false}
                    axisLine={false}
                    domain={["auto", "auto"]}
                    width={48}
                  />
                  <Tooltip content={<CustomTooltip unit={unit} />} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    dot={false}
                    strokeWidth={2}
                    stroke="var(--accent-3)"
                    style={{ filter: "drop-shadow(0 0 4px var(--accent-2))" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Log entry panel */}
          <div className="wt-card">
            <div className="wt-card-topbar">
              <span className="wt-card-topbar-title">
                WGT // {editingId ? "Edit Entry" : "Log Entry"}
              </span>
              {/* Unit selector pills */}
              <div className="wt-unit-pills">
                {["kg", "lb", "st"].map((u) => (
                  <button
                    key={u}
                    className={`wt-pill${unit === u ? " active" : ""}`}
                    onClick={() => {
                      setUnit(u);
                      setEditingId(null);
                      resetInputs();
                    }}
                  >
                    {u === "st" ? "st+lb" : u}
                  </button>
                ))}
              </div>
            </div>

            <div className="wt-log-body">
              {/* Weight inputs */}
              {unit === "kg" && (
                <input
                  className="wt-input"
                  type="number"
                  value={weightKgInput}
                  onChange={(e) => setWeightKgInput(e.target.value)}
                  placeholder="e.g. 82.4 kg"
                />
              )}

              {unit === "lb" && (
                <input
                  className="wt-input"
                  type="number"
                  value={weightLbInput}
                  onChange={(e) => setWeightLbInput(e.target.value)}
                  placeholder="e.g. 181.7 lb"
                />
              )}

              {unit === "st" && (
                <div className="wt-input-row">
                  <input
                    className="wt-input"
                    type="number"
                    value={weightStInput}
                    onChange={(e) => setWeightStInput(e.target.value)}
                    placeholder="st"
                  />
                  <input
                    className="wt-input"
                    type="number"
                    value={weightStLbInput}
                    onChange={(e) => setWeightStLbInput(e.target.value)}
                    placeholder="lb"
                  />
                </div>
              )}

              {error && <div className="wt-error">{error}</div>}

              {!editingId ? (
                <button className="wt-btn-primary" onClick={saveToday} disabled={saving}>
                  {saving ? "Saving..." : "Save Today"}
                </button>
              ) : (
                <div className="wt-save-cancel">
                  <button className="wt-btn-primary" onClick={updateLog} disabled={saving}>
                    {saving ? "Saving..." : "Update"}
                  </button>
                  <button
                    className="wt-btn-ghost"
                    onClick={() => { setEditingId(null); resetInputs(); }}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                </div>
              )}

              <div className="wt-hint">
                Log first thing in the morning, before eating or drinking. One entry per day — saving again overwrites today&apos;s log.
              </div>
            </div>
          </div>
        </div>

        {/* Recent logs */}
        <div className="wt-recent-card">
          <div className="wt-card-topbar">
            <span className="wt-card-topbar-title">Recent Logs</span>
            <span className="wt-card-topbar-sub">{logs.length} total entries</span>
          </div>
          <div className="wt-recent-body">
            {logs.length === 0 && (
              <div className="wt-empty">No weight logs yet — start by logging today.</div>
            )}
            {logs.slice(0, 14).map((l) => (
              <div key={l.id} className="wt-recent-row">
                <div className="wt-recent-date">{l.log_date}</div>

                {editingId === l.id ? (
                  /* Inline edit row */
                  <div className="wt-inline-edit">
                    {unit === "kg" && (
                      <input
                        className="wt-input"
                        type="number"
                        value={weightKgInput}
                        onChange={(e) => setWeightKgInput(e.target.value)}
                        placeholder="kg"
                        style={{ maxWidth: 100 }}
                      />
                    )}
                    {unit === "lb" && (
                      <input
                        className="wt-input"
                        type="number"
                        value={weightLbInput}
                        onChange={(e) => setWeightLbInput(e.target.value)}
                        placeholder="lb"
                        style={{ maxWidth: 100 }}
                      />
                    )}
                    {unit === "st" && (
                      <div className="wt-inline-edit-pair">
                        <input
                          className="wt-input"
                          type="number"
                          value={weightStInput}
                          onChange={(e) => setWeightStInput(e.target.value)}
                          placeholder="st"
                        />
                        <input
                          className="wt-input"
                          type="number"
                          value={weightStLbInput}
                          onChange={(e) => setWeightStLbInput(e.target.value)}
                          placeholder="lb"
                        />
                      </div>
                    )}
                    <div className="wt-recent-actions">
                      <button className="wt-btn-ghost" onClick={updateLog} disabled={saving}
                        style={{ color: "var(--ok)", borderColor: "rgba(40,183,141,0.4)" }}>
                        {saving ? "..." : "Save"}
                      </button>
                      <button className="wt-btn-ghost" onClick={() => { setEditingId(null); resetInputs(); }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="wt-recent-val">{displayWeight(l.weight_kg)}</div>
                    <div className="wt-recent-actions">
                      <button className="wt-btn-ghost" onClick={() => startEdit(l)}>Edit</button>
                      <button className="wt-btn-danger" onClick={() => deleteLog(l.id)}>Del</button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>
    </>
  );
}

export default WeightTracking;
