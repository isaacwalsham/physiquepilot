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

const round1 = (n) => (Math.round(n * 10) / 10);

const formatDate = (d) => {
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const todayLocalISO = () => formatDate(new Date());

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

  if (loading) return <div>Loading...</div>;

return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ margin: 0 }}>Weight Tracking</h1>
          <p style={{ color: "#aaa", marginTop: "0.5rem" }}>
            Max 1 entry per day. Log first thing in the morning before eating or drinking, ideally after using the bathroom.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <span style={{ color: "#aaa" }}>Units</span>
          <select
            value={unit}
            onChange={(e) => {
              setUnit(e.target.value);
              setEditingId(null);
              resetInputs();
            }}
            style={{ background: "#1e1e1e", color: "#fff", border: "1px solid #333", padding: "0.4rem 0.6rem" }}
          >
            <option value="kg">kg</option>
            <option value="lb">lb</option>
            <option value="st">st/lb</option>
          </select>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginTop: "1.5rem" }}>
        <div style={{ background: "#1e1e1e", padding: "1rem", border: "1px solid #222" }}>
          <div style={{ color: "#aaa" }}>Current weight</div>
          <div style={{ fontSize: "1.4rem", marginTop: "0.4rem" }}>
            {latest ? displayWeight(latest.weight_kg) : "—"}
          </div>
          <div style={{ color: "#666", marginTop: "0.4rem" }}>
            {latest ? `Last logged: ${latest.log_date}` : "No logs yet"}
          </div>
        </div>

        <div style={{ background: "#1e1e1e", padding: "1rem", border: "1px solid #222" }}>
          <div style={{ color: "#aaa" }}>7-day average</div>
          <div style={{ fontSize: "1.4rem", marginTop: "0.4rem" }}>
            {avg7 !== null ? `${avg7} ${unit === "st" ? "lb (avg)" : unit}` : "—"}
          </div>
          <div style={{ color: "#666", marginTop: "0.4rem" }}>
            Based on your most recent 7 logs
          </div>
        </div>

        <div style={{ background: "#1e1e1e", padding: "1rem", border: "1px solid #222" }}>
          <div style={{ color: "#aaa" }}>Today</div>
          <div style={{ fontSize: "1.2rem", marginTop: "0.4rem" }}>
            {loggedToday ? "Logged" : "Not logged"}
          </div>
          <div style={{ color: "#666", marginTop: "0.4rem" }}>
            More consistent logs → better adjustments
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "1rem", marginTop: "1rem" }}>
        <div style={{ background: "#1e1e1e", padding: "1rem", border: "1px solid #222" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Trend</h2>
            <div style={{ color: "#666" }}>{logs.length ? `${logs.length} logs` : "No data"}</div>
          </div>

          <div style={{ height: "280px", marginTop: "0.75rem" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="date" tick={{ fill: "#aaa", fontSize: 12 }} />
                <YAxis tick={{ fill: "#aaa", fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ background: "#111", border: "1px solid #333", color: "#fff" }}
                  labelStyle={{ color: "#aaa" }}
                />
                <Line type="monotone" dataKey="value" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ background: "#1e1e1e", padding: "1rem", border: "1px solid #222" }}>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{editingId ? "Edit weight" : "Log today’s weight"}</h2>

          <div style={{ marginTop: "0.75rem" }}>
            {unit === "kg" && (
              <input
                type="number"
                value={weightKgInput}
                onChange={(e) => setWeightKgInput(e.target.value)}
                placeholder="e.g. 82.4"
                style={{ width: "100%", padding: "0.6rem", background: "#111", color: "#fff", border: "1px solid #333" }}
              />
            )}

            {unit === "lb" && (
              <input
                type="number"
                value={weightLbInput}
                onChange={(e) => setWeightLbInput(e.target.value)}
                placeholder="e.g. 181.7"
                style={{ width: "100%", padding: "0.6rem", background: "#111", color: "#fff", border: "1px solid #333" }}
              />
            )}

            {unit === "st" && (
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  type="number"
                  value={weightStInput}
                  onChange={(e) => setWeightStInput(e.target.value)}
                  placeholder="st"
                  style={{ width: "50%", padding: "0.6rem", background: "#111", color: "#fff", border: "1px solid #333" }}
                />
                <input
                  type="number"
                  value={weightStLbInput}
                  onChange={(e) => setWeightStLbInput(e.target.value)}
                  placeholder="lb"
                  style={{ width: "50%", padding: "0.6rem", background: "#111", color: "#fff", border: "1px solid #333" }}
                />
              </div>
            )}
          </div>

          {error && <div style={{ color: "#ff6b6b", marginTop: "0.75rem" }}>{error}</div>}

          <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
            {!editingId ? (
              <button
                onClick={saveToday}
                disabled={saving}
                style={{ flex: 1, padding: "0.7rem", background: "#2a2a2a", color: "#fff", border: "1px solid #333" }}
              >
                {saving ? "Saving..." : "Save today"}
              </button>
            ) : (
              <>
                <button
                  onClick={updateLog}
                  disabled={saving}
                  style={{ flex: 1, padding: "0.7rem", background: "#2a2a2a", color: "#fff", border: "1px solid #333" }}
                >
                  {saving ? "Saving..." : "Update"}
                </button>
                <button
                  onClick={() => {
                    setEditingId(null);
                    resetInputs();
                  }}
                  disabled={saving}
                  style={{ padding: "0.7rem", background: "transparent", color: "#aaa", border: "1px solid #333" }}
                >
                  Cancel
                </button>
              </>
            )}
          </div>

          <div style={{ color: "#666", marginTop: "0.9rem", fontSize: "0.9rem" }}>
            If you already logged today, saving again will overwrite today’s entry.
          </div>
        </div>
      </div>

      <div style={{ marginTop: "1rem", background: "#1e1e1e", padding: "1rem", border: "1px solid #222" }}>
        <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Recent entries</h2>

        <div style={{ marginTop: "0.75rem", display: "grid", gap: "0.5rem" }}>
          {logs.slice(0, 14).map((l) => (
            <div
              key={l.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0.75rem",
                background: "#111",
                border: "1px solid #222"
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{l.log_date}</div>
                <div style={{ color: "#aaa" }}>{displayWeight(l.weight_kg)}</div>
              </div>

              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  onClick={() => startEdit(l)}
                  style={{ padding: "0.45rem 0.8rem", background: "transparent", color: "#fff", border: "1px solid #333" }}
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteLog(l.id)}
                  style={{ padding: "0.45rem 0.8rem", background: "transparent", color: "#ff6b6b", border: "1px solid #333" }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}

          {logs.length === 0 && <div style={{ color: "#aaa" }}>No weight logs yet.</div>}
        </div>
      </div>
    </div>
  );
}

export default WeightTracking;