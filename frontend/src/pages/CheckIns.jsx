import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

const dayNameToIndex = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6
};

const formatISO = (d) => {
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const addDays = (iso, n) => {
  const dt = new Date(`${iso}T00:00:00`);
  dt.setDate(dt.getDate() + n);
  return formatISO(dt);
};

const startOfCheckInWeek = (todayIso, checkInDayName) => {
  const target = dayNameToIndex[checkInDayName] ?? 1;
  const dt = new Date(`${todayIso}T00:00:00`);
  const todayIdx = dt.getDay();
  const diff = (todayIdx - target + 7) % 7;
  dt.setDate(dt.getDate() - diff);
  return formatISO(dt);
};

const round1 = (n) => Math.round(n * 10) / 10;

function CheckIns() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [userId, setUserId] = useState(null);
  const [checkInDay, setCheckInDay] = useState("Monday");

  const [weekStart, setWeekStart] = useState("");
  const [weekEnd, setWeekEnd] = useState("");

  const [metrics, setMetrics] = useState({
    avgWeightKg: null,
    weightChangeKg: null,
    avgCalories: null,
    trainingCompleted: 0,
    avgSteps: 0,
    cardioSessions: 0
  });

  const [form, setForm] = useState({
    hunger: 3,
    energy: 3,
    performance: 3,
    recovery: 3,
    adherence: 3,
    notes: ""
  });

  const [existingThisWeek, setExistingThisWeek] = useState(null);
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState(null);

  const [photos, setPhotos] = useState([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoCaption, setPhotoCaption] = useState("");
  const [photoTakenOn, setPhotoTakenOn] = useState(formatISO(new Date()));
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState(null);

  const todayIso = useMemo(() => formatISO(new Date()), []);

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
        .select("check_in_day")
        .eq("user_id", user.id)
        .maybeSingle();

      if (pErr && pErr.code !== "PGRST116") {
        setError(pErr.message);
        setLoading(false);
        return;
      }

      const cid = profile?.check_in_day || "Monday";
      setCheckInDay(cid);

      const ws = startOfCheckInWeek(todayIso, cid);
      const we = addDays(ws, 6);
      setWeekStart(ws);
      setWeekEnd(we);

      await Promise.all([
        loadWeekState(user.id, ws, we),
        loadHistory(user.id),
        loadPhotos(user.id)
      ]);

      setLoading(false);
    };

    load();
  }, [todayIso]);

  const loadHistory = async (uid) => {
    const { data, error: e } = await supabase
      .from("weekly_check_ins")
      .select("*")
      .eq("user_id", uid)
      .order("week_start", { ascending: false })
      .limit(30);

    if (e) {
      setError(e.message);
      return;
    }

    setHistory(data || []);
  };

  const loadWeekState = async (uid, ws, we) => {
    setExistingThisWeek(null);
    setSelected(null);
    setSelectedPhotoUrl(null);

    const { data: existing, error: exErr } = await supabase
      .from("weekly_check_ins")
      .select("*")
      .eq("user_id", uid)
      .eq("week_start", ws)
      .maybeSingle();

    if (exErr && exErr.code !== "PGRST116") {
      setError(exErr.message);
      return;
    }

    if (existing) {
      setExistingThisWeek(existing);
      setSelected(existing);
      setForm({
        hunger: existing.hunger_rating ?? 3,
        energy: existing.energy_rating ?? 3,
        performance: existing.performance_rating ?? 3,
        recovery: existing.recovery_rating ?? 3,
        adherence: existing.adherence_rating ?? 3,
        notes: existing.notes || ""
      });
      setMetrics({
        avgWeightKg: existing.avg_weight_kg ?? null,
        weightChangeKg: existing.weight_change_kg ?? null,
        avgCalories: existing.avg_calories ?? null,
        trainingCompleted: existing.training_sessions_completed ?? 0,
        avgSteps: existing.avg_steps ?? 0,
        cardioSessions: existing.cardio_sessions ?? 0
      });
      return;
    }

    const weight = await computeWeightMetrics(uid, ws, we);
    const nutrition = await computeCaloriesAvg(uid, ws, we);
    const training = await computeTrainingCompleted(uid, ws, we);
    const steps = await computeStepsAvg(uid, ws, we);
    const cardio = await computeCardioCount(uid, ws, we);

    setMetrics({
      avgWeightKg: weight.avgWeightKg,
      weightChangeKg: weight.weightChangeKg,
      avgCalories: nutrition.avgCalories,
      trainingCompleted: training.completed,
      avgSteps: steps.avgSteps,
      cardioSessions: cardio.count
    });

    setForm((f) => ({ ...f, notes: "" }));
  };

  // Helper functions for photos (must be at top-level, not nested in loadWeekState)
  const loadPhotos = async (uid) => {
    const { data, error: e } = await supabase
      .from("progress_photos")
      .select("id, taken_on, image_path, caption, created_at")
      .eq("user_id", uid)
      .order("taken_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(60);

    if (e) {
      setError(e.message);
      return;
    }

    setPhotos(data || []);
  };

  const getPhotoSignedUrl = async (imagePath) => {
    const { data, error: e } = await supabase.storage
      .from("progress-photos")
      .createSignedUrl(imagePath, 60 * 10);

    if (e) {
      setError(e.message);
      return null;
    }

    return data?.signedUrl || null;
  };

  const uploadProgressPhoto = async (file) => {
    if (!userId || !file) return;

    setUploadingPhoto(true);
    setError("");

    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
    const taken = photoTakenOn && /^\d{4}-\d{2}-\d{2}$/.test(photoTakenOn) ? photoTakenOn : formatISO(new Date());

    const filename = `${crypto.randomUUID()}.${safeExt}`;
    const path = `${userId}/${taken}/${filename}`;

    const { error: upErr } = await supabase.storage
      .from("progress-photos")
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "image/jpeg"
      });

    if (upErr) {
      setUploadingPhoto(false);
      setError(upErr.message);
      return;
    }

    const { error: rowErr } = await supabase
      .from("progress_photos")
      .insert({
        user_id: userId,
        taken_on: taken,
        image_path: path,
        caption: photoCaption || null
      });

    setUploadingPhoto(false);

    if (rowErr) {
      setError(rowErr.message);
      return;
    }

    setPhotoCaption("");
    await loadPhotos(userId);
  };

  const deletePhoto = async (photo) => {
    if (!userId || !photo?.id) return;
    setError("");

    const { error: delRowErr } = await supabase
      .from("progress_photos")
      .delete()
      .eq("id", photo.id)
      .eq("user_id", userId);

    if (delRowErr) {
      setError(delRowErr.message);
      return;
    }

    const { error: delObjErr } = await supabase.storage
      .from("progress-photos")
      .remove([photo.image_path]);

    if (delObjErr) {
      setError(delObjErr.message);
    }

    await loadPhotos(userId);
  };

  const computeWeightMetrics = async (uid, ws, we) => {
    const { data: logs, error: e } = await supabase
      .from("weight_logs")
      .select("log_date, weight_kg")
      .eq("user_id", uid)
      .gte("log_date", ws)
      .lte("log_date", we)
      .order("log_date", { ascending: true });

    if (e) return { avgWeightKg: null, weightChangeKg: null };

    const arr = (logs || []).map((l) => Number(l.weight_kg)).filter((n) => isFinite(n));
    const avg = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

    const prevWs = addDays(ws, -7);
    const prevWe = addDays(ws, -1);

    const { data: prevLogs } = await supabase
      .from("weight_logs")
      .select("weight_kg")
      .eq("user_id", uid)
      .gte("log_date", prevWs)
      .lte("log_date", prevWe);

    const prevArr = (prevLogs || []).map((l) => Number(l.weight_kg)).filter((n) => isFinite(n));
    const prevAvg = prevArr.length ? prevArr.reduce((a, b) => a + b, 0) / prevArr.length : null;

    const change = avg !== null && prevAvg !== null ? avg - prevAvg : null;

    return {
      avgWeightKg: avg !== null ? round1(avg) : null,
      weightChangeKg: change !== null ? round1(change) : null
    };
  };

  const computeCaloriesAvg = async (uid, ws, we) => {
    const { data, error: e } = await supabase
      .from("daily_nutrition")
      .select("log_date, calories")
      .eq("user_id", uid)
      .gte("log_date", ws)
      .lte("log_date", we);

    if (e) return { avgCalories: null };

    const arr = (data || []).map((r) => Number(r.calories)).filter((n) => isFinite(n) && n > 0);
    const avg = arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
    return { avgCalories: avg };
  };

  const computeTrainingCompleted = async (uid, ws, we) => {
    const { data, error: e } = await supabase
      .from("training_sessions")
      .select("id")
      .eq("user_id", uid)
      .gte("session_date", ws)
      .lte("session_date", we)
      .eq("completed", true);

    if (e) return { completed: 0 };
    return { completed: (data || []).length };
  };

  const computeStepsAvg = async (uid, ws, we) => {
    const { data, error: e } = await supabase
      .from("steps_logs")
      .select("log_date, steps")
      .eq("user_id", uid)
      .gte("log_date", ws)
      .lte("log_date", we);

    if (e) return { avgSteps: 0 };

    const arr = (data || []).map((r) => Number(r.steps)).filter((n) => isFinite(n) && n >= 0);
    const avg = arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    return { avgSteps: avg };
  };

  const computeCardioCount = async (uid, ws, we) => {
    const { data, error: e } = await supabase
      .from("cardio_logs")
      .select("id")
      .eq("user_id", uid)
      .gte("log_date", ws)
      .lte("log_date", we);

    if (e) return { count: 0 };
    return { count: (data || []).length };
  };

  const submit = async () => {
    if (!userId || !weekStart || !weekEnd) return;
    setSubmitting(true);
    setError("");

    const payload = {
      user_id: userId,
      week_start: weekStart,
      week_end: weekEnd,

      avg_weight_kg: metrics.avgWeightKg,
      weight_change_kg: metrics.weightChangeKg,
      avg_calories: metrics.avgCalories,
      training_sessions_completed: metrics.trainingCompleted,
      avg_steps: metrics.avgSteps,
      cardio_sessions: metrics.cardioSessions,

      hunger_rating: Number(form.hunger),
      energy_rating: Number(form.energy),
      performance_rating: Number(form.performance),
      recovery_rating: Number(form.recovery),
      adherence_rating: Number(form.adherence),
      notes: form.notes || ""
    };

    const { data, error: e } = await supabase
      .from("weekly_check_ins")
      .upsert(payload, { onConflict: "user_id,week_start" })
      .select("*")
      .maybeSingle();

    setSubmitting(false);

    if (e) {
      setError(e.message);
      return;
    }

    setExistingThisWeek(data);
    setSelected(data);
    await loadHistory(userId);
  };

  if (loading) return <div>Loading...</div>;

    const responsiveCss = `
    @media (max-width: 980px) {
      .pp-grid-2col {
        grid-template-columns: 1fr !important;
      }
      .pp-grid-3col {
        grid-template-columns: 1fr !important;
      }
      .pp-photo-grid {
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)) !important;
      }
    }
  `;

  const card = {
    background: "#050507",
    border: "1px solid #2a1118",
    padding: "1rem"
  };

  const label = { color: "#aaa", fontSize: "0.9rem" };

  const field = {
    width: "100%",
    padding: "0.6rem",
    background: "#111",
    color: "#fff",
    border: "1px solid #2a1118"
  };

  const pill = (active) => ({
    padding: "0.5rem 0.75rem",
    border: "1px solid #2a1118",
    background: active ? "#0b0b10" : "transparent",
    color: active ? "#fff" : "#aaa",
    cursor: "pointer"
  });

  return (
  <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "1rem" }}>
    <style>{responsiveCss}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <h1 style={{ margin: 0 }}>Check-ins</h1>
          <div style={{ color: "#aaa", marginTop: "0.5rem" }}>
            Weekly summary and feedback. This will power adjustments later.
          </div>
        </div>
        <div style={{ color: "#666" }}>
          {existingThisWeek ? "Submitted" : "Not submitted"}
        </div>
      </div>

      {error && <div style={{ color: "#ff6b6b", marginTop: "1rem" }}>{error}</div>}

      <div className="pp-grid-2col" style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "1rem", marginTop: "1rem" }}>
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={{ fontWeight: 700 }}>This week</div>
            <div style={{ color: "#666" }}>{weekStart} → {weekEnd}</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", marginTop: "1rem" }}>
            <div>
              <div style={label}>Avg weight</div>
              <div style={{ marginTop: "0.35rem", fontSize: "1.2rem" }}>
                {metrics.avgWeightKg !== null ? `${metrics.avgWeightKg} kg` : "—"}
              </div>
              <div style={{ color: "#666", marginTop: "0.25rem" }}>
                {metrics.weightChangeKg !== null ? `${metrics.weightChangeKg > 0 ? "+" : ""}${metrics.weightChangeKg} kg vs last week` : "—"}
              </div>
            </div>

            <div>
              <div style={label}>Avg calories</div>
              <div style={{ marginTop: "0.35rem", fontSize: "1.2rem" }}>
                {metrics.avgCalories !== null ? `${metrics.avgCalories}` : "—"}
              </div>
              <div style={{ color: "#666", marginTop: "0.25rem" }}>From daily logs</div>
            </div>

            <div>
              <div style={label}>Training completed</div>
              <div style={{ marginTop: "0.35rem", fontSize: "1.2rem" }}>
                {metrics.trainingCompleted}
              </div>
              <div style={{ color: "#666", marginTop: "0.25rem" }}>Completed sessions</div>
            </div>

            <div>
              <div style={label}>Avg steps</div>
              <div style={{ marginTop: "0.35rem", fontSize: "1.2rem" }}>
                {metrics.avgSteps}
              </div>
              <div style={{ color: "#666", marginTop: "0.25rem" }}>Daily average</div>
            </div>

            <div>
              <div style={label}>Cardio sessions</div>
              <div style={{ marginTop: "0.35rem", fontSize: "1.2rem" }}>
                {metrics.cardioSessions}
              </div>
              <div style={{ color: "#666", marginTop: "0.25rem" }}>Logged sessions</div>
            </div>
          </div>

          <div style={{ marginTop: "1rem", color: "#666", fontSize: "0.9rem" }}>
            If any of these show “—”, it means you haven’t logged that data yet for the week.
          </div>
        </div>

        <div style={card}>
          <div style={{ fontWeight: 700 }}>How did the week feel?</div>

          <div style={{ display: "grid", gap: "0.75rem", marginTop: "0.9rem" }}>
            <div>
              <div style={label}>Hunger (1–5)</div>
              <input type="number" min="1" max="5" value={form.hunger}
                onChange={(e) => setForm((f) => ({ ...f, hunger: e.target.value }))}
                style={field}
              />
            </div>

            <div>
              <div style={label}>Energy (1–5)</div>
              <input type="number" min="1" max="5" value={form.energy}
                onChange={(e) => setForm((f) => ({ ...f, energy: e.target.value }))}
                style={field}
              />
            </div>

            <div>
              <div style={label}>Performance (1–5)</div>
              <input type="number" min="1" max="5" value={form.performance}
                onChange={(e) => setForm((f) => ({ ...f, performance: e.target.value }))}
                style={field}
              />
            </div>

            <div>
              <div style={label}>Recovery (1–5)</div>
              <input type="number" min="1" max="5" value={form.recovery}
                onChange={(e) => setForm((f) => ({ ...f, recovery: e.target.value }))}
                style={field}
              />
            </div>

            <div>
              <div style={label}>Adherence (1–5)</div>
              <input type="number" min="1" max="5" value={form.adherence}
                onChange={(e) => setForm((f) => ({ ...f, adherence: e.target.value }))}
                style={field}
              />
            </div>

            <div>
              <div style={label}>Notes</div>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                style={{ ...field, minHeight: "120px" }}
                placeholder="Anything the coach should know (sleep, stress, appetite, schedule issues, cravings, etc.)"
              />
            </div>

            <button
              onClick={submit}
              disabled={submitting}
              style={{
                padding: "0.75rem",
                background: "#0b0b10",
                color: "#fff",
                border: "1px solid #2a1118",
                cursor: submitting ? "default" : "pointer"
              }}
            >
              {submitting ? "Submitting..." : existingThisWeek ? "Update check-in" : "Submit check-in"}
            </button>
          </div>
        </div>
      </div>

      <div className="pp-grid-2col" style={{ display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: "1rem", marginTop: "1rem" }}>
        <div style={card}>
          <div style={{ fontWeight: 700 }}>Past check-ins</div>

          <div style={{ marginTop: "0.75rem", display: "grid", gap: "0.5rem" }}>
            {history.length === 0 && <div style={{ color: "#666" }}>No check-ins yet.</div>}

            {history.map((c) => (
              <div
                key={c.id}
                onClick={() => setSelected(c)}
                style={pill(selected?.id === c.id)}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div style={{ fontWeight: 600 }}>{c.week_start}</div>
                  <div style={{ color: "#666" }}>{c.week_end}</div>
                </div>
                <div style={{ marginTop: "0.25rem", color: "#aaa", fontSize: "0.9rem" }}>
                  Avg wt: {c.avg_weight_kg ?? "—"} kg · Avg cal: {c.avg_calories ?? "—"} · Training: {c.training_sessions_completed ?? 0}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={card}>
          <div style={{ fontWeight: 700 }}>Check-in details</div>

          {!selected ? (
            <div style={{ marginTop: "0.75rem", color: "#666" }}>Select a check-in to view.</div>
          ) : (
            <div style={{ marginTop: "0.9rem", display: "grid", gap: "0.65rem" }}>
              <div style={{ color: "#aaa" }}>
                Week: <span style={{ color: "#fff" }}>{selected.week_start} → {selected.week_end}</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
                <div>
                  <div style={label}>Avg weight</div>
                  <div style={{ marginTop: "0.35rem", fontSize: "1.1rem" }}>{selected.avg_weight_kg ?? "—"} kg</div>
                </div>
                <div>
                  <div style={label}>Change</div>
                  <div style={{ marginTop: "0.35rem", fontSize: "1.1rem" }}>{selected.weight_change_kg ?? "—"} kg</div>
                </div>
                <div>
                  <div style={label}>Avg calories</div>
                  <div style={{ marginTop: "0.35rem", fontSize: "1.1rem" }}>{selected.avg_calories ?? "—"}</div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
                <div>
                  <div style={label}>Training</div>
                  <div style={{ marginTop: "0.35rem", fontSize: "1.1rem" }}>{selected.training_sessions_completed ?? 0}</div>
                </div>
                <div>
                  <div style={label}>Avg steps</div>
                  <div style={{ marginTop: "0.35rem", fontSize: "1.1rem" }}>{selected.avg_steps ?? 0}</div>
                </div>
                <div>
                  <div style={label}>Cardio</div>
                  <div style={{ marginTop: "0.35rem", fontSize: "1.1rem" }}>{selected.cardio_sessions ?? 0}</div>
                </div>
              </div>

              <div style={{ marginTop: "0.5rem" }}>
                <div style={label}>Ratings</div>
                <div style={{ marginTop: "0.35rem", color: "#aaa" }}>
                  Hunger {selected.hunger_rating ?? "—"} · Energy {selected.energy_rating ?? "—"} · Performance {selected.performance_rating ?? "—"} · Recovery {selected.recovery_rating ?? "—"} · Adherence {selected.adherence_rating ?? "—"}
                </div>
              </div>

              <div>
                <div style={label}>Notes</div>
                <div style={{ marginTop: "0.35rem", color: "#aaa", whiteSpace: "pre-wrap" }}>
                  {selected.notes || "—"}
                </div>
              </div>

              <div style={{ marginTop: "0.75rem", color: "#666", fontSize: "0.9rem" }}>
                PDF export + AI adjustments will be added after we finish the remaining pages.
              </div>
            </div>
          )}
        </div>
      </div>
    <div className="pp-grid-2col" style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "1rem" }}>
        <div style={card}>
          <div style={{ fontWeight: 700 }}>Progress photo upload</div>
          <div style={{ color: "#aaa", marginTop: "0.5rem" }}>
            Add photos weekly (or anytime). This builds your visual logbook.
          </div>

          <div style={{ marginTop: "1rem", display: "grid", gap: "0.75rem" }}>
            <div>
              <div style={label}>Taken on</div>
              <input
                type="date"
                value={photoTakenOn}
                onChange={(e) => setPhotoTakenOn(e.target.value)}
                style={field}
              />
            </div>

            <div>
              <div style={label}>Caption (optional)</div>
              <input
                type="text"
                value={photoCaption}
                onChange={(e) => setPhotoCaption(e.target.value)}
                style={field}
                placeholder="e.g. morning fasted, post-carb-up"
              />
            </div>

            <div>
              <div style={label}>Choose image</div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadProgressPhoto(f);
                  e.target.value = "";
                }}
                style={{ ...field, padding: "0.55rem" }}
                disabled={uploadingPhoto}
              />
              <div style={{ color: "#666", marginTop: "0.5rem", fontSize: "0.9rem" }}>
                JPG/PNG/WEBP recommended.
              </div>
            </div>

            <div style={{ color: "#666" }}>{uploadingPhoto ? "Uploading..." : " "}</div>
          </div>
        </div>

        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={{ fontWeight: 700 }}>Photo logbook</div>
            <div style={{ color: "#666" }}>{photos.length} photos</div>
          </div>

          {photos.length === 0 ? (
            <div style={{ marginTop: "0.75rem", color: "#666" }}>No photos yet.</div>
          ) : (
            <div
              style={{
                marginTop: "1rem",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: "0.75rem"
              }}
            >
              {photos.map((p) => (
                <div
                  key={p.id}
                  style={{
                    border: "1px solid #2a1118",
                    background: "#111",
                    padding: "0.5rem"
                  }}
                >
                  <button
                    onClick={async () => {
                      const url = await getPhotoSignedUrl(p.image_path);
                      if (url) setSelectedPhotoUrl(url);
                    }}
                    style={{
                      width: "100%",
                      border: "none",
                      padding: 0,
                      background: "transparent",
                      cursor: "pointer"
                    }}
                    title="Open"
                  >
                    <div
                      style={{
                        width: "100%",
                        aspectRatio: "1 / 1",
                        background: "#0b0b0b",
                        border: "1px solid #2a1118",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#666",
                        fontSize: "0.9rem"
                      }}
                    >
                      View
                    </div>
                  </button>

                  <div style={{ marginTop: "0.5rem", color: "#aaa", fontSize: "0.9rem" }}>{p.taken_on}</div>
                  {p.caption && (
                    <div style={{ marginTop: "0.25rem", color: "#666", fontSize: "0.85rem" }}>{p.caption}</div>
                  )}

                  <button
                    onClick={() => deletePhoto(p)}
                    style={{
                      marginTop: "0.6rem",
                      width: "100%",
                      padding: "0.45rem",
                      background: "transparent",
                      color: "#ff6b6b",
                      border: "1px solid #2a1118",
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
      </div>

      {selectedPhotoUrl && (
        <div
          onClick={() => setSelectedPhotoUrl(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            zIndex: 50
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "1100px",
              width: "100%",
              background: "#060609",
              border: "1px solid #2a1118",
              padding: "1rem"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div style={{ color: "#aaa" }}>Progress photo</div>
              <button
                onClick={() => setSelectedPhotoUrl(null)}
                style={{
                  background: "transparent",
                  color: "#fff",
                  border: "1px solid #2a1118",
                  padding: "0.4rem 0.6rem",
                  cursor: "pointer"
                }}
              >
                Close
              </button>
            </div>

            <img
              src={selectedPhotoUrl}
              alt="Progress"
              style={{ width: "100%", marginTop: "0.75rem", border: "1px solid #2a1118" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default CheckIns;