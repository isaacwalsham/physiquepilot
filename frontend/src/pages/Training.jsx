import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";


const todayISO = () => new Date().toISOString().slice(0, 10);

const pad2 = (n) => String(n).padStart(2, "0");

const addDaysISO = (iso, days) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const isoToDow = (iso) => {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "short" });
};

export default function Training() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [userId, setUserId] = useState(null);

  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [weekSessionsByDate, setWeekSessionsByDate] = useState({});

  const [session, setSession] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [setsByExercise, setSetsByExercise] = useState({});

  const [newExerciseName, setNewExerciseName] = useState("");

  // Mobile detection
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 900);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 900);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const week = useMemo(() => {
    const t = todayISO();
    const start = t; // next 7 days starting today
    return Array.from({ length: 7 }).map((_, i) => {
      const iso = addDaysISO(start, i);
      const d = new Date(`${iso}T00:00:00`);
      return {
        iso,
        label: isoToDow(iso),
        day: d.getDate(),
        isToday: iso === t
      };
    });
  }, []);

  const card = {
    background: "#1e1e1e",
    border: "1px solid #222",
    padding: "1rem"
  };

  const input = {
    width: "100%",
    padding: "0.6rem",
    background: "#111",
    color: "#fff",
    border: "1px solid #333"
  };

  const smallBtn = (active) => ({
    padding: "0.55rem 0.8rem",
    background: active ? "#2a2a2a" : "transparent",
    color: active ? "#fff" : "#aaa",
    border: "1px solid #333",
    cursor: "pointer",
    borderRadius: "10px",
    minWidth: "58px"
  });

  const daysBetweenISO = (aISO, bISO) => {
    // b - a in whole days
    const a = new Date(`${aISO}T00:00:00Z`);
    const b = new Date(`${bISO}T00:00:00Z`);
    const ms = b.getTime() - a.getTime();
    return Math.floor(ms / (1000 * 60 * 60 * 24));
  };

  const normalizeRollingPattern = (raw) => {
    // Accept a few shapes:
    // - array: [true,false] or ["training","rest"]
    // - object: { pattern: [...] } or { days: [...] } or { sequence: [...] }
    const arr = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.pattern)
        ? raw.pattern
        : Array.isArray(raw?.days)
          ? raw.days
          : Array.isArray(raw?.sequence)
            ? raw.sequence
            : null;

    if (!arr) return null;

    const norm = arr
      .map((v) => {
        if (typeof v === "boolean") return v;
        if (typeof v === "number") return v > 0;
        const s = String(v || "").toLowerCase().trim();
        if (!s) return false;
        if (s === "t" || s === "train" || s === "training" || s === "workout" || s === "lift") return true;
        if (s === "r" || s === "rest" || s === "off") return false;
        // Fallback: treat unknown strings as false (rest)
        return false;
      })
      .filter((x) => typeof x === "boolean");

    return norm.length ? norm : null;
  };

  const preloadWeekFromProfile = async (uid) => {
    // Pull schedule settings from onboarding
    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select(
        "split_mode, training_days, rolling_start_date, rolling_pattern, rolling_cycle_length, training_frequency_range"
      )
      .eq("user_id", uid)
      .maybeSingle();

    if (pErr && pErr.code !== "PGRST116") {
      setError(pErr.message);
      return;
    }

    const splitMode = profile?.split_mode || "fixed";
    const fixedDays = Array.isArray(profile?.training_days) ? profile.training_days : [];

    const rollingStart = profile?.rolling_start_date
      ? String(profile.rolling_start_date)
      : todayISO();

    const rollingPattern = normalizeRollingPattern(profile?.rolling_pattern);

    // If user chose rolling split but hasn't set a pattern yet, don't guess.
    if (splitMode === "rolling" && !rollingPattern) {
      // Not fatal: user can set it inside Training later.
      return;
    }

    const cycleLen = (() => {
      if (Array.isArray(rollingPattern)) return rollingPattern.length;
      const n = Number(profile?.rolling_cycle_length);
      return Number.isFinite(n) && n > 0 ? Math.round(n) : 7;
    })();

    const isTrainingForDate = (dateISO) => {
      if (splitMode !== "rolling") {
        const dow = isoToDow(dateISO); // e.g. "Mon"
        return fixedDays.includes(dow);
      }

      const delta = daysBetweenISO(rollingStart, dateISO);
      const idx = ((delta % cycleLen) + cycleLen) % cycleLen;
      return Boolean(rollingPattern[idx]);
    };

    // Next 7 days (today + 6)
    const dates = week.map((d) => d.iso);

    // Check which sessions already exist
    const { data: existing, error: exErr } = await supabase
      .from("training_sessions")
      .select("session_date")
      .eq("user_id", uid)
      .in("session_date", dates);

    if (exErr) {
      setError(exErr.message);
      return;
    }

    const existingSet = new Set((existing || []).map((r) => r.session_date));

    // Only insert TRAINING days by default (rest days can be left unassigned)
    const rowsToInsert = dates
      .filter((d) => !existingSet.has(d))
      .filter((d) => isTrainingForDate(d))
      .map((d) => ({
        user_id: uid,
        session_date: d,
        is_rest_day: false,
        name: "Training (Unassigned)",
        notes: ""
      }));

    if (!rowsToInsert.length) return;

    const { error: insErr } = await supabase.from("training_sessions").insert(rowsToInsert);
    if (insErr) {
      setError(insErr.message);
      return;
    }

    await fetchWeekSessions(uid);

    if (selectedDate === todayISO()) {
      await loadDay(uid, selectedDate);
    }
  };

  const fetchWeekSessions = async (uid) => {
    const start = week[0].iso;
    const endExclusive = addDaysISO(week[6].iso, 1);

    const { data, error: e } = await supabase
      .from("training_sessions")
      .select("id, session_date, is_rest_day, name")
      .eq("user_id", uid)
      .gte("session_date", start)
      .lt("session_date", endExclusive);

    if (e) {
      setError(e.message);
      return;
    }

    const map = {};
    (data || []).forEach((s) => {
      map[s.session_date] = s;
    });
    setWeekSessionsByDate(map);
  };

  const loadDay = async (uid, dateISO) => {
    setError("");

    const { data: sData, error: sErr } = await supabase
      .from("training_sessions")
      .select("id, session_date, is_rest_day, notes, name")
      .eq("user_id", uid)
      .eq("session_date", dateISO)
      .maybeSingle();

    if (sErr && sErr.code !== "PGRST116") {
      setError(sErr.message);
      setSession(null);
      setExercises([]);
      setSetsByExercise({});
      return;
    }

    if (!sData) {
      setSession(null);
      setExercises([]);
      setSetsByExercise({});
      await syncTodayDayTypeToProfile(null);
      return;
    }

    setSession(sData);

    const { data: eData, error: eErr } = await supabase
      .from("training_exercises")
      .select("id, name, sort_order")
      .eq("user_id", uid)
      .eq("session_id", sData.id)
      .order("sort_order", { ascending: true });

    if (eErr) {
      setError(eErr.message);
      setExercises([]);
      setSetsByExercise({});
      return;
    }

    setExercises(eData || []);

    const exerciseIds = (eData || []).map((e) => e.id);
    if (!exerciseIds.length) {
      setSetsByExercise({});
      return;
    }

    const { data: setData, error: setErr } = await supabase
      .from("training_sets")
      .select("id, exercise_id, set_number, reps, weight, rir")
      .eq("user_id", uid)
      .in("exercise_id", exerciseIds)
      .order("set_number", { ascending: true });

    if (setErr) {
      setError(setErr.message);
      setSetsByExercise({});
      return;
    }

    const grouped = {};
    for (const row of setData || []) {
      if (!grouped[row.exercise_id]) grouped[row.exercise_id] = [];
      grouped[row.exercise_id].push(row);
    }
    setSetsByExercise(grouped);
  };

  const createSession = async (mode) => {
    if (!userId) return;
    setBusy(true);
    setError("");

    const payload = {
      user_id: userId,
      session_date: selectedDate,
      is_rest_day: mode === "rest",
      name: mode === "rest" ? "Rest Day" : "",
      notes: ""
    };

    const { data, error: e } = await supabase
      .from("training_sessions")
      .insert(payload)
      .select("id, session_date, is_rest_day, notes, name")
      .single();

    setBusy(false);

    if (e) {
      setError(e.message);
      return;
    }

    setSession(data);
    setExercises([]);
    setSetsByExercise({});
    await syncTodayDayTypeToProfile(data);
    await fetchWeekSessions(userId);
  };
  // Sync today's day type (training/rest) to profiles table if editing today
  const syncTodayDayTypeToProfile = async (nextSession) => {
    // Only sync if we are editing today
    const t = todayISO();
    if (!userId) return;
    if (selectedDate !== t) return;

    // If no session exists for today, clear override
    if (!nextSession) {
      await supabase
        .from("profiles")
        .update({
          today_day_type: null,
          today_day_type_date: null,
          training_day_type_override: false,
          nutrition_day_type_override: false
        })
        .eq("user_id", userId);
      return;
    }

    const dayType = nextSession.is_rest_day ? "rest" : "training";

    await supabase
      .from("profiles")
      .update({
        today_day_type: dayType,
        today_day_type_date: t,
        training_day_type_override: true,
        nutrition_day_type_override: true
      })
      .eq("user_id", userId);
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setError("");

      const { data, error: e } = await supabase.auth.getUser();
      if (e || !data?.user) {
        setError("Not logged in.");
        setLoading(false);
        return;
      }

      const uid = data.user.id;
      setUserId(uid);

      await fetchWeekSessions(uid);
      await preloadWeekFromProfile(uid);
      await fetchWeekSessions(uid);
      await loadDay(uid, selectedDate);

      setLoading(false);
    };

    init();
  }, []);

  useEffect(() => {
    if (!userId) return;
    loadDay(userId, selectedDate);
  }, [selectedDate, userId]);

  const toggleRestDay = async () => {
    if (!userId || !session) return;
    setBusy(true);
    setError("");

    const next = !session.is_rest_day;

    const { error: e } = await supabase
      .from("training_sessions")
      .update({ is_rest_day: next })
      .eq("id", session.id)
      .eq("user_id", userId);

    setBusy(false);

    if (e) {
      setError(e.message);
      return;
    }

    setSession({ ...session, is_rest_day: next });
    await syncTodayDayTypeToProfile({ ...session, is_rest_day: next });
    await fetchWeekSessions(userId);
  };

  const saveNotes = async (val) => {
    if (!userId || !session) return;
    setSession({ ...session, notes: val });

    const { error: e } = await supabase
      .from("training_sessions")
      .update({ notes: val })
      .eq("id", session.id)
      .eq("user_id", userId);

    if (e) setError(e.message);
  };

  const addExercise = async () => {
    if (!userId || !session) return;
    const name = newExerciseName.trim();
    if (!name) return;

    setBusy(true);
    setError("");

    const sortOrder = exercises.length
      ? Math.max(...exercises.map((x) => Number(x.sort_order) || 0)) + 1
      : 0;

    const { data, error: e } = await supabase
      .from("training_exercises")
      .insert({
        user_id: userId,
        session_id: session.id,
        name,
        sort_order: sortOrder
      })
      .select("id, name, sort_order")
      .single();

    setBusy(false);

    if (e) {
      setError(e.message);
      return;
    }

    setExercises([...exercises, data]);
    setSetsByExercise({ ...setsByExercise, [data.id]: [] });
    setNewExerciseName("");
  };

  const deleteExercise = async (exerciseId) => {
    if (!userId) return;
    setBusy(true);
    setError("");

    const { error: e } = await supabase
      .from("training_exercises")
      .delete()
      .eq("id", exerciseId)
      .eq("user_id", userId);

    setBusy(false);

    if (e) {
      setError(e.message);
      return;
    }

    const nextExercises = exercises.filter((x) => x.id !== exerciseId);
    const nextSets = { ...setsByExercise };
    delete nextSets[exerciseId];
    setExercises(nextExercises);
    setSetsByExercise(nextSets);
  };

  const moveExercise = async (exerciseId, dir) => {
    const idx = exercises.findIndex((x) => x.id === exerciseId);
    if (idx < 0) return;
    const j = idx + dir;
    if (j < 0 || j >= exercises.length) return;

    const a = exercises[idx];
    const b = exercises[j];

    const swapped = exercises.slice();
    swapped[idx] = b;
    swapped[j] = a;

    const normalized = swapped.map((ex, i) => ({ ...ex, sort_order: i }));
    setExercises(normalized);

    setBusy(true);
    setError("");

    const updates = normalized.map((ex) =>
      supabase
        .from("training_exercises")
        .update({ sort_order: ex.sort_order })
        .eq("id", ex.id)
        .eq("user_id", userId)
    );

    const results = await Promise.all(updates);
    const firstErr = results.find((r) => r.error)?.error;

    setBusy(false);

    if (firstErr) setError(firstErr.message);
  };

  const addSet = async (exerciseId) => {
    if (!userId) return;
    setError("");

    const existing = setsByExercise[exerciseId] || [];
    const nextNumber = existing.length ? Math.max(...existing.map((s) => Number(s.set_number) || 0)) + 1 : 1;

    const { data, error: e } = await supabase
      .from("training_sets")
      .insert({
        user_id: userId,
        exercise_id: exerciseId,
        set_number: nextNumber,
        reps: null,
        weight: null,
        rir: null
      })
      .select("id, exercise_id, set_number, reps, weight, rir")
      .single();

    if (e) {
      setError(e.message);
      return;
    }

    setSetsByExercise({
      ...setsByExercise,
      [exerciseId]: [...existing, data]
    });
  };

  const updateSetLocal = (exerciseId, setId, patch) => {
    const list = setsByExercise[exerciseId] || [];
    const next = list.map((s) => (s.id === setId ? { ...s, ...patch } : s));
    setSetsByExercise({ ...setsByExercise, [exerciseId]: next });
  };

  const saveSet = async (exerciseId, setRow) => {
    if (!userId) return;

    const reps = setRow.reps === "" ? null : Number(setRow.reps);
    const weight = setRow.weight === "" ? null : Number(setRow.weight);
    const rir = setRow.rir === "" ? null : Number(setRow.rir);

    const clean = {
      reps: Number.isFinite(reps) ? reps : null,
      weight: Number.isFinite(weight) ? weight : null,
      rir: Number.isFinite(rir) ? rir : null
    };

    const { error: e } = await supabase
      .from("training_sets")
      .update(clean)
      .eq("id", setRow.id)
      .eq("user_id", userId);

    if (e) setError(e.message);
  };

  const deleteSet = async (exerciseId, setId) => {
    if (!userId) return;
    setError("");

    const { error: e } = await supabase
      .from("training_sets")
      .delete()
      .eq("id", setId)
      .eq("user_id", userId);

    if (e) {
      setError(e.message);
      return;
    }

    const list = setsByExercise[exerciseId] || [];
    const next = list.filter((s) => s.id !== setId);
    const renumbered = next.map((s, i) => ({ ...s, set_number: i + 1 }));
    setSetsByExercise({ ...setsByExercise, [exerciseId]: renumbered });

    const updates = renumbered.map((s) =>
      supabase
        .from("training_sets")
        .update({ set_number: s.set_number })
        .eq("id", s.id)
        .eq("user_id", userId)
    );

    await Promise.all(updates);
  };

  const hasAssignment = (dateISO) => !!weekSessionsByDate[dateISO];

  const dayBadge = (dateISO) => {
    const s = weekSessionsByDate[dateISO];
    if (!s) return "Unassigned";
    if (s.is_rest_day) return "Rest";
    return s.name || "Training";
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div style={{ maxWidth: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <h1 style={{ margin: 0 }}>Training</h1>
          <div style={{ color: "#aaa", marginTop: "0.5rem" }}>
            {selectedDate === todayISO() ? "Today" : selectedDate} · {session?.name || dayBadge(selectedDate)}
          </div>
        </div>

        <div style={{ color: "#666" }}>
          {busy ? "Saving..." : "Saved"}
        </div>
      </div>

      {error && <div style={{ color: "#ff6b6b", marginTop: "1rem" }}>{error}</div>}

      {isMobile ? (
        <div style={{ marginTop: "1rem" }}>
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{
              width: "100%",
              padding: "0.75rem",
              background: "#111",
              color: "#fff",
              border: "1px solid #333",
              borderRadius: "10px"
            }}
          >
            {week.map((d) => (
              <option key={d.iso} value={d.iso}>
                {d.label} {d.day} — {dayBadge(d.iso)}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem", flexWrap: "wrap" }}>
          {week.map((d) => (
            <button
              key={d.iso}
              onClick={() => setSelectedDate(d.iso)}
              style={smallBtn(d.iso === selectedDate)}
            >
              <div style={{ fontSize: "0.75rem" }}>{d.label}</div>
              <div style={{ fontWeight: 700 }}>{d.day}</div>
              <div
                style={{
                  fontSize: "0.7rem",
                  color: d.iso === selectedDate ? "#aaa" : "#666",
                  marginTop: "0.25rem"
                }}
              >
                {dayBadge(d.iso)}
              </div>
            </button>
          ))}
        </div>
      )}

      {!session && (
        <div style={{ ...card, marginTop: "1rem" }}>
          <div style={{ fontWeight: 700 }}>No session assigned</div>
          <div style={{ color: "#aaa", marginTop: "0.5rem" }}>
            Your onboarding schedule preloads the next 7 days. You can still create/edit a day manually here.
          </div>

          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
            <button
              onClick={() => createSession("training")}
              disabled={busy}
              style={{
                padding: "0.7rem 1rem",
                background: "#2a2a2a",
                color: "#fff",
                border: "1px solid #333",
                cursor: "pointer"
              }}
            >
              Create training day
            </button>

            <button
              onClick={() => createSession("rest")}
              disabled={busy}
              style={{
                padding: "0.7rem 1rem",
                background: "transparent",
                color: "#fff",
                border: "1px solid #333",
                cursor: "pointer"
              }}
            >
              Mark rest day
            </button>
          </div>
        </div>
      )}

      {session && (
        <div style={{ marginTop: "1rem", display: "grid", gridTemplateColumns: "1fr", gap: "1rem" }}>
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div style={{ fontWeight: 700 }}>Day settings</div>
              <button
                onClick={toggleRestDay}
                disabled={busy}
                style={{
                  padding: "0.55rem 0.9rem",
                  background: session.is_rest_day ? "transparent" : "#2a2a2a",
                  color: "#fff",
                  border: "1px solid #333",
                  cursor: "pointer"
                }}
              >
                {session.is_rest_day ? "Switch to training day" : "Switch to rest day"}
              </button>
            </div>

            {/* Session name input */}
            <div style={{ marginBottom: "0.75rem" }}>
              <div style={{ color: "#aaa", marginBottom: "0.25rem" }}>Session name</div>
              <input
                value={session.name || ""}
                onChange={(e) => setSession({ ...session, name: e.target.value })}
                onBlur={async (e) => {
                  const val = e.target.value.trim();
                  setSession((s) => ({ ...s, name: val }));
                  const { error: nameErr } = await supabase
                    .from("training_sessions")
                    .update({ name: val })
                    .eq("id", session.id)
                    .eq("user_id", userId);

                  if (nameErr) setError(nameErr.message);
                  await fetchWeekSessions(userId);
                }}
                placeholder="e.g. Push, Pull, Legs"
                style={input}
              />
            </div>

            <div style={{ marginTop: "0.75rem" }}>
              <div style={{ color: "#aaa", marginBottom: "0.25rem" }}>Workout notes</div>
              <textarea
                value={session.notes || ""}
                onChange={(e) => setSession({ ...session, notes: e.target.value })}
                onBlur={(e) => saveNotes(e.target.value)}
                placeholder="Notes for today’s session"
                style={{ ...input, minHeight: "110px" }}
              />
            </div>
          </div>

          {!session.is_rest_day && (
            <div style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ fontWeight: 700 }}>Exercises</div>
              </div>

              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                <input
                  value={newExerciseName}
                  onChange={(e) => setNewExerciseName(e.target.value)}
                  placeholder="Add exercise"
                  style={input}
                />
                <button
                  onClick={addExercise}
                  disabled={busy}
                  style={{
                    padding: "0.65rem 1rem",
                    background: "#2a2a2a",
                    color: "#fff",
                    border: "1px solid #333",
                    cursor: "pointer"
                  }}
                >
                  Add
                </button>
              </div>

              {exercises.length === 0 && (
                <div style={{ color: "#666", marginTop: "0.75rem" }}>
                  Add your first exercise to start logging.
                </div>
              )}

              <div style={{ marginTop: "1rem", display: "grid", gap: "1rem" }}>
                {exercises.map((ex, idx) => {
                  const sets = setsByExercise[ex.id] || [];

                  return (
                    <div key={ex.id} style={{ border: "1px solid #2a2a2a", padding: "0.9rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem" }}>
                        <div style={{ fontWeight: 700 }}>{ex.name}</div>

                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                          <button
                            onClick={() => moveExercise(ex.id, -1)}
                            disabled={busy || idx === 0}
                            style={{ padding: "0.45rem 0.7rem", background: "transparent", color: "#fff", border: "1px solid #333", cursor: "pointer" }}
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => moveExercise(ex.id, 1)}
                            disabled={busy || idx === exercises.length - 1}
                            style={{ padding: "0.45rem 0.7rem", background: "transparent", color: "#fff", border: "1px solid #333", cursor: "pointer" }}
                          >
                            ↓
                          </button>
                          <button
                            onClick={() => deleteExercise(ex.id)}
                            disabled={busy}
                            style={{ padding: "0.45rem 0.7rem", background: "transparent", color: "#ff6b6b", border: "1px solid #333", cursor: "pointer" }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      <div style={{ marginTop: "0.75rem", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <div style={{ color: "#aaa" }}>Sets</div>
                        <button
                          onClick={() => addSet(ex.id)}
                          disabled={busy}
                          style={{
                            padding: "0.45rem 0.8rem",
                            background: "#2a2a2a",
                            color: "#fff",
                            border: "1px solid #333",
                            cursor: "pointer"
                          }}
                        >
                          Add set
                        </button>
                      </div>

                      {sets.length === 0 && (
                        <div style={{ color: "#666", marginTop: "0.5rem" }}>
                          No sets yet.
                        </div>
                      )}

                      {sets.length > 0 && (
                        <div style={{ marginTop: "0.65rem", display: "grid", gap: "0.5rem" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "70px 1fr 1fr 1fr 90px", gap: "0.5rem", color: "#aaa", fontSize: "0.9rem" }}>
                            <div>Set</div>
                            <div>Reps</div>
                            <div>Weight</div>
                            <div>RIR</div>
                            <div></div>
                          </div>

                          {sets.map((s) => (
                            <div
                              key={s.id}
                              style={{
                                display: "grid",
                                gridTemplateColumns: "70px 1fr 1fr 1fr 90px",
                                gap: "0.5rem",
                                alignItems: "center"
                              }}
                            >
                              <div style={{ color: "#aaa" }}>#{s.set_number}</div>

                              <input
                                type="number"
                                value={s.reps ?? ""}
                                onChange={(e) => updateSetLocal(ex.id, s.id, { reps: e.target.value })}
                                onBlur={() => saveSet(ex.id, { ...s, reps: s.reps ?? "" })}
                                style={input}
                                placeholder="reps"
                              />

                              <input
                                type="number"
                                value={s.weight ?? ""}
                                onChange={(e) => updateSetLocal(ex.id, s.id, { weight: e.target.value })}
                                onBlur={() => saveSet(ex.id, { ...s, weight: s.weight ?? "" })}
                                style={input}
                                placeholder="weight"
                              />

                              <input
                                type="number"
                                value={s.rir ?? ""}
                                onChange={(e) => updateSetLocal(ex.id, s.id, { rir: e.target.value })}
                                onBlur={() => saveSet(ex.id, { ...s, rir: s.rir ?? "" })}
                                style={input}
                                placeholder="rir"
                              />

                              <button
                                onClick={() => deleteSet(ex.id, s.id)}
                                style={{
                                  padding: "0.55rem 0.7rem",
                                  background: "transparent",
                                  color: "#ff6b6b",
                                  border: "1px solid #333",
                                  cursor: "pointer"
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}