import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { supabase } from "../supabaseClient";
import { useProfile } from "../context/ProfileContext";
import PhysiquePilotLoader from "../components/PhysiquePilotLoader";

/* ─── constants ──────────────────────────────────────────────────────────── */
const TODAY = new Date().toISOString().slice(0, 10);
const SETUP_KEY = "pp_habits_setup_done";

function isoDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}
function subtractDay(iso) {
  const d = new Date(iso);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}
function dayDiff(a, b) {
  return Math.round((new Date(a) - new Date(b)) / 86400000);
}
function round1(n) { return Math.round(Number(n || 0) * 10) / 10; }

/* ─── default areas ───────────────────────────────────────────────────────── */
const DEFAULT_AREAS = [
  { name: "Body",      color: "#16a34a", sort_order: 0 },
  { name: "Nutrition", color: "#d97706", sort_order: 1 },
  { name: "Sleep",     color: "#1d4ed8", sort_order: 2 },
  { name: "Mind",      color: "#0891b2", sort_order: 3 },
  { name: "Recovery",  color: "#dc2626", sort_order: 4 },
];

/* ─── template library ────────────────────────────────────────────────────── */
// inherit_source: auto-complete from data on other pages (null = manual)
const TEMPLATES = [
  // Body
  { area:"Body",      name:"Mobility & Stretching",         habit_type:"quantified", target_value:15,   target_unit:"min",    time_of_day:"morning",   inherit_source:null },
  { area:"Body",      name:"Hit Daily Step Goal",            habit_type:"positive",   target_value:null, target_unit:null,     time_of_day:"anytime",   inherit_source:"steps_goal" },
  { area:"Body",      name:"Hit Daily Training Session",     habit_type:"positive",   target_value:null, target_unit:null,     time_of_day:"anytime",   inherit_source:"workout_session" },
  { area:"Body",      name:"Cardio Completed",               habit_type:"positive",   target_value:null, target_unit:null,     time_of_day:"anytime",   inherit_source:"cardio_logged" },
  // Nutrition
  { area:"Nutrition", name:"Drink 4L Water",                 habit_type:"quantified", target_value:4,    target_unit:"litres", time_of_day:"anytime",   inherit_source:null },
  { area:"Nutrition", name:"Hit Macros",                     habit_type:"positive",   target_value:null, target_unit:null,     time_of_day:"anytime",   inherit_source:"macros_hit" },
  { area:"Nutrition", name:"Limit Caffeine After 4pm",       habit_type:"negative",   target_value:null, target_unit:null,     time_of_day:"afternoon", inherit_source:null },
  { area:"Nutrition", name:"Hit Micronutrients",             habit_type:"positive",   target_value:null, target_unit:null,     time_of_day:"anytime",   inherit_source:"micros_hit" },
  { area:"Nutrition", name:"Food Shop",                      habit_type:"positive",   target_value:null, target_unit:null,     time_of_day:"anytime",   inherit_source:null },
  { area:"Nutrition", name:"Meal Prepping",                  habit_type:"positive",   target_value:null, target_unit:null,     time_of_day:"anytime",   inherit_source:null },
  // Sleep
  { area:"Sleep",     name:"Hit Sleep Goal",                 habit_type:"positive",   target_value:null, target_unit:null,     time_of_day:"morning",   inherit_source:null },
  { area:"Sleep",     name:"Limit Phone Use Before Bed",     habit_type:"negative",   target_value:null, target_unit:null,     time_of_day:"evening",   inherit_source:null },
  // Mind
  { area:"Mind",      name:"Complete Deep Work Block",       habit_type:"positive",   target_value:null, target_unit:null,     time_of_day:"anytime",   inherit_source:null },
  { area:"Mind",      name:"Reading",                        habit_type:"quantified", target_value:20,   target_unit:"pages",  time_of_day:"evening",   inherit_source:null },
  { area:"Mind",      name:"Meditation",                     habit_type:"quantified", target_value:10,   target_unit:"min",    time_of_day:"morning",   inherit_source:null },
  { area:"Mind",      name:"Journalling",                    habit_type:"positive",   target_value:null, target_unit:null,     time_of_day:"evening",   inherit_source:null },
  // Recovery
  { area:"Recovery",  name:"Supplements Taken",              habit_type:"positive",   target_value:null, target_unit:null,     time_of_day:"morning",   inherit_source:null },
  { area:"Recovery",  name:"Morning Sunlight Exposure",      habit_type:"quantified", target_value:10,   target_unit:"min",    time_of_day:"morning",   inherit_source:null },
  { area:"Recovery",  name:"Additional Recovery Protocols",  habit_type:"positive",   target_value:null, target_unit:null,     time_of_day:"anytime",   inherit_source:null },
];

const TIME_GROUPS = ["morning", "afternoon", "evening", "anytime"];
const TIME_LABELS = { morning: "MORNING", afternoon: "AFTERNOON", evening: "EVENING", anytime: "ANYTIME" };


/* ─── streak calculator ──────────────────────────────────────────────────── */
function calcStreaks(logs, habitId) {
  const dates = logs
    .filter(l => l.habit_id === habitId && l.status === "complete")
    .map(l => l.log_date)
    .sort()
    .reverse();

  if (!dates.length) return { current: 0, best: 0 };

  let current = 0, d = TODAY;
  for (const date of dates) {
    if (date === d) { current++; d = subtractDay(d); }
    else break;
  }

  const asc = [...dates].reverse();
  let best = 0, run = 1;
  for (let i = 1; i < asc.length; i++) {
    if (dayDiff(asc[i], asc[i - 1]) === 1) { run++; if (run > best) best = run; }
    else run = 1;
  }
  best = Math.max(best, current, asc.length === 1 ? 1 : 0);
  return { current, best };
}

/* ─── completion rate ─────────────────────────────────────────────────────── */
function completionRate(logs, habitId, days) {
  const since = isoDate(-days);
  const relevant = logs.filter(l => l.habit_id === habitId && l.log_date >= since);
  if (!relevant.length) return null;
  const done = relevant.filter(l => l.status === "complete").length;
  return Math.round((done / relevant.length) * 100);
}

/* ─── heatmap builder ─────────────────────────────────────────────────────── */
function buildHeatmap(logs, habits) {
  const map = {};
  const total = habits.filter(h => !h.is_archived).length;
  for (const l of logs) {
    if (!map[l.log_date]) map[l.log_date] = { done: 0, total };
    if (l.status === "complete") map[l.log_date].done++;
  }
  return map; // date → { done, total }
}

/* ─── correlation ─────────────────────────────────────────────────────────── */
function buildCorrelation(logs, habits, weightData, sessions, nutritionData, stepsData) {
  const total = habits.filter(h => !h.is_archived).length;
  if (!total) return null;

  const byDate = {};
  for (const l of logs) {
    if (!byDate[l.log_date]) byDate[l.log_date] = 0;
    if (l.status === "complete") byDate[l.log_date]++;
  }

  const dates = Object.keys(byDate);
  if (dates.length < 7) return null;

  const highDays = dates.filter(d => (byDate[d] / total) >= 0.66);
  const lowDays  = dates.filter(d => (byDate[d] / total) <= 0.33);

  // Weight Δ: average change vs 3-day prior
  const wMap = {};
  for (const w of weightData) wMap[w.date] = w.weight_kg ?? w.value;
  const weightDelta = (dayList) => {
    const vals = dayList.map(d => {
      const today = wMap[d];
      const prior = wMap[subtractDay(subtractDay(subtractDay(d)))];
      return today != null && prior != null ? today - prior : null;
    }).filter(v => v != null);
    return vals.length ? round1(vals.reduce((s, v) => s + v, 0) / vals.length) : null;
  };

  // Training: sessions per day
  const sSet = new Set(sessions.map(s => s.session_date ?? s.date));
  const trainRate = (dayList) => {
    if (!dayList.length) return null;
    return Math.round((dayList.filter(d => sSet.has(d)).length / dayList.length) * 100);
  };

  // Calories: % of target
  const calMap = {};
  for (const n of nutritionData) {
    const date = n.log_date ?? n.date;
    if (date) calMap[date] = n.calories ?? n.total_calories ?? n.kcal;
  }
  const calAdherence = (dayList) => {
    const vals = dayList.map(d => calMap[d]).filter(v => v != null);
    return vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : null;
  };

  // Steps
  const stMap = {};
  for (const s of stepsData) stMap[s.date ?? s.log_date] = s.steps ?? s.count;
  const avgSteps = (dayList) => {
    const vals = dayList.map(d => stMap[d]).filter(v => v != null);
    return vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : null;
  };

  return {
    weight:   { high: weightDelta(highDays),  low: weightDelta(lowDays),  n: highDays.length },
    training: { high: trainRate(highDays),    low: trainRate(lowDays),    n: highDays.length },
    calories: { high: calAdherence(highDays), low: calAdherence(lowDays), n: highDays.length },
    steps:    { high: avgSteps(highDays),     low: avgSteps(lowDays),     n: highDays.length },
    sampleSize: { high: highDays.length, low: lowDays.length },
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════════════ */
export default function HabitsTracker() {
  const { profile } = useProfile();

  const [tab, setTab]               = useState("today");
  const [habits, setHabits]         = useState([]);
  const [areas, setAreas]           = useState([]);
  const [logs, setLogs]             = useState([]);
  const [todayLogs, setTodayLogs]   = useState({});    // habitId → log obj
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);

  // Modals
  const [showModal, setShowModal]           = useState(false);
  const [editingHabit, setEditingHabit]     = useState(null);
  const [showTemplates, setShowTemplates]   = useState(false);
  const [quantTarget, setQuantTarget]       = useState(null); // { habitId, currentVal }

  // Correlation data (lazy-loaded on analytics tab open)
  const [corrLoaded, setCorrLoaded]       = useState(false);
  const [weightData, setWeightData]       = useState([]);
  const [sessionsData, setSessionsData]   = useState([]);
  const [nutritionData, setNutritionData] = useState([]);
  const [stepsData, setStepsData]         = useState([]);

  // Inherit sync data (today only)
  const [inheritData, setInheritData] = useState({
    workout: null,         // workout_sessions row for today
    steps: null,           // steps_logs row for today
    cardio: null,          // cardio_logs row for today (truthy = logged)
    nutrition: [],         // daily_nutrition_items rows for today
    nutritionTargets: [],  // nutrition_day_targets rows
  });

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!profile?.user_id) return;
    load(profile.user_id);
  }, [profile?.user_id]);

  // Re-run inherit sync whenever page becomes visible (user switches back from another tab)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && profile?.user_id) {
        loadInheritData(profile.user_id);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [profile?.user_id]);

  const loadInheritData = useCallback(async (uid) => {
    if (!uid) return;
    try {
      const [workoutRes, stepsRes, cardioRes, nutritionRes, targetsRes] = await Promise.all([
        supabase.from("workout_sessions").select("session_date,completed_at,program_day_id")
          .eq("user_id", uid).eq("session_date", TODAY),
        supabase.from("steps_logs").select("log_date,steps")
          .eq("user_id", uid).eq("log_date", TODAY).maybeSingle(),
        supabase.from("cardio_logs").select("log_date")
          .eq("user_id", uid).eq("log_date", TODAY).limit(1),
        supabase.from("daily_nutrition_items").select("protein_g,carbs_g,fats_g,calories")
          .eq("user_id", uid).eq("log_date", TODAY),
        supabase.from("nutrition_day_targets").select("day_type,protein_g,carbs_g,fats_g,calories")
          .eq("user_id", uid),
      ]);
      return {
        workout:          workoutRes.data?.[0] ?? null,
        steps:            stepsRes.data ?? null,
        cardio:           (cardioRes.data?.length ?? 0) > 0 ? cardioRes.data[0] : null,
        nutrition:        nutritionRes.data || [],
        nutritionTargets: targetsRes.data || [],
      };
    } catch (e) {
      console.error("loadInheritData error:", e);
      return null;
    }
  }, []);

  const load = async (uid) => {
    setLoading(true);
    try {
      const since366 = isoDate(-366);
      const [areasRes, habitsRes, logsRes, iData] = await Promise.all([
        supabase.from("habit_areas").select("*").eq("user_id", uid).order("sort_order"),
        supabase.from("habits").select("*").eq("user_id", uid).eq("is_archived", false).order("sort_order"),
        supabase.from("habit_logs").select("*").eq("user_id", uid).gte("log_date", since366),
        loadInheritData(uid),
      ]);

      const loadedAreas  = areasRes.data  || [];
      const loadedHabits = habitsRes.data || [];
      const loadedLogs   = logsRes.data   || [];

      setAreas(loadedAreas);
      setHabits(loadedHabits);
      setLogs(loadedLogs);
      if (iData) setInheritData(iData);

      // Build today's log map
      const tl = {};
      for (const l of loadedLogs) {
        if (l.log_date === TODAY) tl[l.habit_id] = l;
      }
      setTodayLogs(tl);

      // Auto-apply inherited logs
      if (iData && loadedHabits.length) {
        await applyInheritedLogs(uid, loadedHabits, iData, tl);
      }

      // Show template picker if no habits and not already set up
      if (loadedHabits.length === 0 && !localStorage.getItem(SETUP_KEY)) {
        setShowTemplates(true);
      }
    } catch (e) {
      console.error("HabitsTracker load error:", e);
    } finally {
      setLoading(false);
    }
  };

  // ── Inherit: compute status from synced data, upsert logs ──────────────────
  const applyInheritedLogs = useCallback(async (uid, habitList, iData, existingTodayLogs) => {
    const inherited = habitList.filter(h => h.inherit_source);
    if (!inherited.length) return;

    // Determine if today is a training day using profile.training_days
    const todayName = new Date().toLocaleDateString("en-US", { weekday: "short" }).toLowerCase().slice(0, 3);
    const trainingDays = profile?.training_days ?? [];
    const isScheduledTrainingDay = trainingDays.length === 0 || trainingDays.includes(todayName);

    // Macro targets: prefer training day targets if a workout was logged
    const dayType = iData.workout ? "training" : "rest";
    const macroTarget = iData.nutritionTargets.find(t => t.day_type === dayType) || iData.nutritionTargets[0];

    // Sum today's nutrition
    const totalProtein  = iData.nutrition.reduce((s, n) => s + (n.protein_g || 0), 0);
    const totalCarbs    = iData.nutrition.reduce((s, n) => s + (n.carbs_g  || 0), 0);
    const totalFats     = iData.nutrition.reduce((s, n) => s + (n.fats_g   || 0), 0);

    const upserts = [];
    for (const h of inherited) {
      let status = "incomplete";

      switch (h.inherit_source) {
        case "steps_goal": {
          const target = profile?.steps_target;
          if (!target) { status = "skipped"; break; }
          status = (iData.steps?.steps ?? 0) >= target ? "complete" : "incomplete";
          break;
        }
        case "workout_session": {
          if (!isScheduledTrainingDay) { status = "skipped"; break; }
          status = iData.workout?.completed_at ? "complete" : "incomplete";
          break;
        }
        case "cardio_logged": {
          status = iData.cardio ? "complete" : "incomplete";
          break;
        }
        case "macros_hit": {
          if (!iData.nutrition.length || !macroTarget) { status = "incomplete"; break; }
          const tol = 0.10; // 10% tolerance
          const pOk = macroTarget.protein_g > 0 && totalProtein >= macroTarget.protein_g * (1 - tol);
          const cOk = macroTarget.carbs_g   > 0 && totalCarbs   >= macroTarget.carbs_g   * (1 - tol);
          const fOk = macroTarget.fats_g    > 0 && totalFats    >= macroTarget.fats_g    * (1 - tol);
          status = (pOk && cOk && fOk) ? "complete" : "incomplete";
          break;
        }
        case "micros_hit": {
          // Simplified: if any nutrition logged today, mark complete (detailed micro check is complex)
          status = iData.nutrition.length > 0 ? "incomplete" : "incomplete";
          // We'll check via daily_nutrition_item_nutrients for key nutrients
          // For now, if calories >= 80% of target → assume micros tracked
          if (iData.nutrition.length > 0 && macroTarget?.calories) {
            const totalCal = iData.nutrition.reduce((s, n) => s + (n.calories || 0), 0);
            status = totalCal >= macroTarget.calories * 0.7 ? "complete" : "incomplete";
          }
          break;
        }
        default:
          continue;
      }

      // Only upsert if status changed from what's stored
      const existing = existingTodayLogs[h.id];
      if (existing?.status !== status) {
        upserts.push({ user_id: uid, habit_id: h.id, log_date: TODAY, status, value: null });
      }
    }

    if (!upserts.length) return;

    try {
      const { data, error } = await supabase
        .from("habit_logs")
        .upsert(upserts, { onConflict: "user_id,habit_id,log_date" })
        .select();
      if (error) throw error;

      if (data?.length) {
        setTodayLogs(prev => {
          const next = { ...prev };
          for (const row of data) next[row.habit_id] = row;
          return next;
        });
        setLogs(prev => {
          let updated = [...prev];
          for (const row of data) {
            updated = updated.filter(l => !(l.habit_id === row.habit_id && l.log_date === TODAY));
            updated.push(row);
          }
          return updated;
        });
      }
    } catch (e) {
      console.error("applyInheritedLogs error:", e);
    }
  }, [profile]);

  // ── Lazy-load correlation data ─────────────────────────────────────────────
  const loadCorrelation = useCallback(async () => {
    if (corrLoaded || !profile?.user_id) return;
    const since = isoDate(-180);
    const uid = profile.user_id;
    try {
      const [wRes, sRes, nRes, stRes] = await Promise.all([
        supabase.from("weight_logs").select("date,weight_kg").eq("user_id", uid).gte("date", since),
        supabase.from("workout_sessions").select("session_date").eq("user_id", uid).gte("session_date", since),
        supabase.from("nutrition_logs").select("log_date,calories").eq("user_id", uid).gte("log_date", since),
        supabase.from("steps_logs").select("date,steps").eq("user_id", uid).gte("date", since),
      ]);
      setWeightData(wRes.data || []);
      setSessionsData(sRes.data || []);
      setNutritionData(nRes.data || []);
      setStepsData(stRes.data || []);
      setCorrLoaded(true);
    } catch (e) {
      console.error("Correlation load error:", e);
      setCorrLoaded(true); // don't retry on error
    }
  }, [corrLoaded, profile?.user_id]);

  useEffect(() => {
    if (tab === "analytics") loadCorrelation();
  }, [tab, loadCorrelation]);

  // ── Toggle habit log ───────────────────────────────────────────────────────
  const toggleLog = useCallback(async (habit) => {
    if (!profile?.user_id) return;
    const existing = todayLogs[habit.id];

    if (habit.habit_type === "quantified") {
      setQuantTarget({ habitId: habit.id, habit, currentVal: existing?.value ?? 0 });
      return;
    }

    const nextStatus = (() => {
      if (!existing) return habit.habit_type === "negative" ? "incomplete" : "complete";
      if (existing.status === "complete") return "incomplete";
      if (existing.status === "incomplete") return "complete";
      return "complete";
    })();

    await upsertLog(habit.id, nextStatus, null);
  }, [todayLogs, profile?.user_id]);

  const upsertLog = async (habitId, status, value) => {
    if (!profile?.user_id) return;
    setSaving(true);
    try {
      const payload = {
        user_id: profile.user_id,
        habit_id: habitId,
        log_date: TODAY,
        status,
        value: value ?? null,
      };
      const { data, error } = await supabase
        .from("habit_logs")
        .upsert(payload, { onConflict: "user_id,habit_id,log_date" })
        .select()
        .single();
      if (error) throw error;

      setTodayLogs(prev => ({ ...prev, [habitId]: data }));
      setLogs(prev => {
        const filtered = prev.filter(l => !(l.habit_id === habitId && l.log_date === TODAY));
        return [...filtered, data];
      });
    } catch (e) {
      console.error("upsertLog error:", e);
    } finally {
      setSaving(false);
    }
  };

  // ── Save habit (create / update) ──────────────────────────────────────────
  const saveHabit = async (form) => {
    if (!profile?.user_id) return;
    setSaving(true);
    try {
      const payload = {
        user_id:      profile.user_id,
        area_id:      form.area_id || null,
        name:         form.name,
        icon:         null,
        habit_type:   form.habit_type,
        target_value: form.habit_type === "quantified" ? Number(form.target_value) : null,
        target_unit:  form.habit_type === "quantified" ? form.target_unit : null,
        time_of_day:  form.time_of_day,
        is_archived:  form.is_archived ?? false,
        sort_order:   form.sort_order ?? habits.length,
      };

      let result;
      if (form.id) {
        const { data, error } = await supabase.from("habits").update(payload).eq("id", form.id).select().single();
        if (error) throw error;
        result = data;
        setHabits(prev => prev.map(h => h.id === result.id ? result : h).filter(h => !h.is_archived));
      } else {
        const { data, error } = await supabase.from("habits").insert(payload).select().single();
        if (error) throw error;
        result = data;
        setHabits(prev => [...prev, result]);
      }
    } catch (e) {
      console.error("saveHabit error:", e);
    } finally {
      setSaving(false);
      setShowModal(false);
      setEditingHabit(null);
    }
  };

  // ── Ensure default areas exist ────────────────────────────────────────────
  const ensureDefaultAreas = async () => {
    if (!profile?.user_id) return areas;
    const existing = [...areas];
    const toCreate = DEFAULT_AREAS.filter(da => !existing.find(a => a.name === da.name));
    if (!toCreate.length) return existing;
    const { data, error } = await supabase.from("habit_areas")
      .insert(toCreate.map(a => ({ ...a, user_id: profile.user_id })))
      .select();
    if (error) { console.error(error); return existing; }
    const all = [...existing, ...(data || [])];
    setAreas(all);
    return all;
  };

  // ── Confirm templates ──────────────────────────────────────────────────────
  const confirmTemplates = async (selected) => {
    if (!profile?.user_id || !selected.length) {
      localStorage.setItem(SETUP_KEY, "1");
      setShowTemplates(false);
      return;
    }
    setSaving(true);
    try {
      const allAreas = await ensureDefaultAreas();
      const areaMap = {};
      for (const a of allAreas) areaMap[a.name] = a.id;

      const payload = selected.map((t, i) => ({
        user_id:        profile.user_id,
        area_id:        areaMap[t.area] || null,
        name:           t.name,
        icon:           null,
        habit_type:     t.habit_type,
        target_value:   t.target_value,
        target_unit:    t.target_unit,
        time_of_day:    t.time_of_day,
        inherit_source: t.inherit_source || null,
        is_archived:    false,
        sort_order:     i,
      }));

      const { data, error } = await supabase.from("habits").insert(payload).select();
      if (error) throw error;
      setHabits(prev => [...prev, ...(data || [])]);
      localStorage.setItem(SETUP_KEY, "1");
    } catch (e) {
      console.error("confirmTemplates error:", e);
    } finally {
      setSaving(false);
      setShowTemplates(false);
    }
  };

  // ── Computed ───────────────────────────────────────────────────────────────
  const areaMap = useMemo(() => {
    const m = {};
    for (const a of areas) m[a.id] = a;
    return m;
  }, [areas]);

  const todayDone = useMemo(() =>
    habits.filter(h => todayLogs[h.id]?.status === "complete").length,
  [habits, todayLogs]);

  const grouped = useMemo(() => {
    const g = {};
    for (const tod of TIME_GROUPS) g[tod] = habits.filter(h => h.time_of_day === tod);
    return g;
  }, [habits]);

  const heatmapData = useMemo(() => buildHeatmap(logs, habits), [logs, habits]);

  const correlation = useMemo(() => {
    if (!corrLoaded) return null;
    return buildCorrelation(logs, habits, weightData, sessionsData, nutritionData, stepsData);
  }, [corrLoaded, logs, habits, weightData, sessionsData, nutritionData, stepsData]);

  const habitStats = useMemo(() => habits.map(h => ({
    ...h,
    ...calcStreaks(logs, h.id),
    rate30:  completionRate(logs, h.id, 30),
    rate90:  completionRate(logs, h.id, 90),
  })), [habits, logs]);

  // ─────────────────────────────────────────────────────────────────────────
  if (loading) return <PhysiquePilotLoader />;

  return (
    <>
      <style>{CSS}</style>

      {/* ── Template picker overlay ────────────────────────────────────────── */}
      {showTemplates && (
        <TemplatePicker
          onConfirm={confirmTemplates}
          onSkip={() => { localStorage.setItem(SETUP_KEY, "1"); setShowTemplates(false); }}
          saving={saving}
        />
      )}

      {/* ── Quantified input overlay ──────────────────────────────────────── */}
      {quantTarget && (
        <QuantifiedInput
          habit={quantTarget.habit}
          currentVal={quantTarget.currentVal}
          onConfirm={async (val) => {
            const status = val >= (quantTarget.habit.target_value || 1) ? "complete" : "incomplete";
            await upsertLog(quantTarget.habitId, status, val);
            setQuantTarget(null);
          }}
          onClose={() => setQuantTarget(null)}
        />
      )}

      {/* ── Habit modal ───────────────────────────────────────────────────── */}
      {showModal && (
        <HabitModal
          habit={editingHabit}
          areas={areas}
          onSave={saveHabit}
          onClose={() => { setShowModal(false); setEditingHabit(null); }}
          saving={saving}
        />
      )}

      {/* ── Page ──────────────────────────────────────────────────────────── */}
      <div className="ht-page">

        {/* Header */}
        <div className="ht-header">
          <div className="ht-header-left">
            <span className="ht-title">◈ HABIT TRACKER</span>
            <span className="ht-date">
              {new Date().toLocaleDateString("en-GB", { weekday:"short", day:"2-digit", month:"short", year:"numeric" }).toUpperCase()}
            </span>
          </div>
          <div className="ht-tabs">
            {[["today","Today"],["analytics","Analytics"]].map(([key,label]) => (
              <button key={key} className={`ht-tab${tab === key ? " ht-tab--active" : ""}`} onClick={() => setTab(key)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── TODAY TAB ───────────────────────────────────────────────────── */}
        {tab === "today" && (
          <div className="ht-today">

            {/* Progress ring */}
            <ProgressRing done={todayDone} total={habits.length} />

            {/* Habit groups */}
            {habits.length === 0 ? (
              <div className="ht-empty">
                <div className="ht-empty-icon">◈</div>
                <div className="ht-empty-title">No habits yet</div>
                <div className="ht-empty-sub">Add your first habit to start tracking</div>
                <button className="ht-btn ht-btn--primary" onClick={() => { setEditingHabit(null); setShowModal(true); }}>+ Add Habit</button>
              </div>
            ) : (
              <>
                {TIME_GROUPS.map(tod => {
                  const group = grouped[tod];
                  if (!group.length) return null;
                  return (
                    <div key={tod} className="ht-group">
                      <div className="ht-group-label">{TIME_LABELS[tod]}</div>
                      <div className="ht-group-list">
                        {group.map(h => (
                          <HabitRow
                            key={h.id}
                            habit={h}
                            area={areaMap[h.area_id]}
                            log={todayLogs[h.id]}
                            onToggle={() => toggleLog(h)}
                            onEdit={() => { setEditingHabit(h); setShowModal(true); }}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}

                {/* Add habit button */}
                <button
                  className="ht-add-btn"
                  onClick={() => { setEditingHabit(null); setShowModal(true); }}
                >
                  + Add Habit
                </button>
              </>
            )}
          </div>
        )}

        {/* ── ANALYTICS TAB ───────────────────────────────────────────────── */}
        {tab === "analytics" && (
          <div className="ht-analytics">

            {/* Heatmap */}
            <div className="ht-panel">
              <div className="ht-section-label">◈ COMPLETION HEATMAP — 12 MONTHS</div>
              <HeatmapGrid data={heatmapData} />
            </div>

            {/* Correlation */}
            <div className="ht-panel">
              <div className="ht-section-label">◈ CROSS-METRIC CORRELATION</div>
              {!corrLoaded ? (
                <div className="ht-loading-inline">Loading correlation data…</div>
              ) : !correlation ? (
                <div className="ht-empty-inline">Log habits for at least 7 days to unlock correlation insights.</div>
              ) : (
                <CorrelationPanel corr={correlation} />
              )}
            </div>

            {/* Per-habit stats */}
            <div className="ht-panel">
              <div className="ht-section-label">◈ PER-HABIT STATS</div>
              {habitStats.length === 0 ? (
                <div className="ht-empty-inline">No habits yet.</div>
              ) : (
                <div className="ht-stats-table">
                  <div className="ht-stats-header">
                    <span>Habit</span>
                    <span>Streak</span>
                    <span>Best</span>
                    <span>30d %</span>
                    <span>90d %</span>
                  </div>
                  {habitStats.map(h => {
                    const area = areaMap[h.area_id];
                    return (
                      <div key={h.id} className="ht-stats-row">
                        <span className="ht-stats-name">
                          <span className="ht-stats-dot" style={{ background: area?.color || "var(--line-2)" }} />
                          {h.name}
                        </span>
                        <span className="ht-stats-val">{h.current > 0 ? h.current : "—"}</span>
                        <span className="ht-stats-val">{h.best > 0 ? h.best : "—"}</span>
                        <span className="ht-stats-val" style={{ color: h.rate30 >= 80 ? "var(--ok)" : h.rate30 >= 50 ? "var(--warn)" : h.rate30 !== null ? "var(--bad)" : "var(--text-3)" }}>
                          {h.rate30 !== null ? `${h.rate30}%` : "—"}
                        </span>
                        <span className="ht-stats-val" style={{ color: h.rate90 >= 80 ? "var(--ok)" : h.rate90 >= 50 ? "var(--warn)" : h.rate90 !== null ? "var(--bad)" : "var(--text-3)" }}>
                          {h.rate90 !== null ? `${h.rate90}%` : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
═══════════════════════════════════════════════════════════════════════════ */

/* ── Progress ring ─────────────────────────────────────────────────────────── */
function ProgressRing({ done, total }) {
  const R = 48, C = 2 * Math.PI * R;
  const pct = total > 0 ? done / total : 0;
  const isComplete = total > 0 && done >= total;
  return (
    <div className="ht-ring-wrap">
      <div className="ht-ring-svg-wrap">
        <svg width="120" height="120" viewBox="0 0 120 120" style={{ transform: "rotate(-90deg)" }}>
          <defs>
            <linearGradient id="htRingGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={isComplete ? "var(--ok)" : "var(--accent-1)"} />
              <stop offset="100%" stopColor={isComplete ? "#4ade80" : "var(--accent-3)"} />
            </linearGradient>
          </defs>
          <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
          <circle cx="60" cy="60" r={R} fill="none"
            stroke="url(#htRingGrad)" strokeWidth="10" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - pct)}
            style={{ transition: "stroke-dashoffset 600ms cubic-bezier(.22,.68,0,1.2)", filter: `drop-shadow(0 0 6px ${isComplete ? "rgba(74,222,128,0.7)" : "rgba(222,41,82,0.6)"})` }}
          />
          {[0,60,120,180,240,300].map(a => {
            const r1 = (a * Math.PI) / 180;
            const x1 = 60 + (R - 6) * Math.cos(r1), y1 = 60 + (R - 6) * Math.sin(r1);
            const x2 = 60 + (R + 6) * Math.cos(r1), y2 = 60 + (R + 6) * Math.sin(r1);
            return <line key={a} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />;
          })}
        </svg>
        <div className="ht-ring-center">
          <span className="ht-ring-num">{done}</span>
          <span className="ht-ring-denom">/ {total}</span>
        </div>
      </div>
      <div className="ht-ring-label">
        {total === 0 ? "No habits yet" : done >= total ? "All habits complete" : `${total - done} remaining today`}
      </div>
    </div>
  );
}

/* ── Inherit source label map ───────────────────────────────────────────────── */
const INHERIT_LABELS = {
  steps_goal:       "Synced from Steps",
  workout_session:  "Synced from Training",
  cardio_logged:    "Synced from Cardio",
  macros_hit:       "Synced from Nutrition",
  micros_hit:       "Synced from Nutrition",
};

/* ── Sync icon SVG ──────────────────────────────────────────────────────────── */
function SyncIcon({ color, glowing }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ filter: glowing ? `drop-shadow(0 0 4px ${color}99)` : "none" }}>
      <path d="M3 9a6 6 0 0 1 9.87-4.6L14 3v3h-3l1.18-1.18A4.5 4.5 0 1 0 13.5 9" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14 9a6 6 0 0 1-9.87 4.6L3 15v-3h3l-1.18 1.18A4.5 4.5 0 1 0 4.5 9" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/* ── Habit row ──────────────────────────────────────────────────────────────── */
function HabitRow({ habit, area, log, onToggle, onEdit }) {
  const isComplete   = log?.status === "complete";
  const isIncomplete = log?.status === "incomplete";
  const isSkipped    = log?.status === "skipped";
  const isInherited  = !!habit.inherit_source;
  const color        = area?.color || "var(--accent-3)";

  // Manual habits: tap circle
  const circleContent = (() => {
    if (habit.habit_type === "negative") {
      if (isComplete)   return { bg: "var(--ok)",  glow: "rgba(40,183,141,0.5)", symbol: "✓" };
      if (isIncomplete) return { bg: "var(--bad)",  glow: "rgba(255,79,115,0.5)",  symbol: "✗" };
      return { bg: "transparent", glow: null, symbol: null, border: color };
    }
    if (isComplete) return { bg: color, glow: `${color}80`, symbol: "✓" };
    return { bg: "transparent", glow: null, symbol: null, border: color };
  })();

  return (
    <div className={`ht-habit-row${isSkipped ? " ht-habit-row--skipped" : ""}`}>
      {isInherited ? (
        /* Sync indicator — read-only */
        <div className="ht-sync-icon" title={INHERIT_LABELS[habit.inherit_source]}>
          {isSkipped
            ? <span className="ht-sync-dash">—</span>
            : <SyncIcon color={isComplete ? color : "var(--text-3)"} glowing={isComplete} />
          }
        </div>
      ) : (
        /* Manual tap circle */
        <button
          className="ht-habit-circle"
          onClick={onToggle}
          style={{
            background: circleContent.bg,
            border: `2px solid ${circleContent.border || color}`,
            boxShadow: circleContent.glow ? `0 0 10px ${circleContent.glow}` : "none",
          }}
          aria-label={`Toggle ${habit.name}`}
        >
          {circleContent.symbol && <span className="ht-habit-circle-sym">{circleContent.symbol}</span>}
        </button>
      )}
      <div className="ht-habit-info" onClick={onEdit}>
        <div className="ht-habit-text">
          <span className="ht-habit-name" style={{ opacity: isIncomplete ? 0.45 : isSkipped ? 0.35 : 1 }}>{habit.name}</span>
          {isInherited && (
            <span className="ht-habit-inherit-label">
              {isSkipped ? "Rest day" : INHERIT_LABELS[habit.inherit_source]}
            </span>
          )}
          {!isInherited && habit.habit_type === "quantified" && (
            <span className="ht-habit-quant">
              {log?.value != null ? `${log.value} / ${habit.target_value} ${habit.target_unit}` : `Target: ${habit.target_value} ${habit.target_unit}`}
            </span>
          )}
        </div>
        {area && (
          <span className="ht-area-badge" style={{ background: `${color}22`, border: `1px solid ${color}55`, color }}>
            {area.name}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Quantified input overlay ──────────────────────────────────────────────── */
function QuantifiedInput({ habit, currentVal, onConfirm, onClose }) {
  const [val, setVal] = useState(currentVal || 0);
  const step = habit.target_unit === "litres" ? 0.25 : habit.target_unit === "pages" ? 5 : 1;
  const pct = habit.target_value > 0 ? Math.min(100, (val / habit.target_value) * 100) : 0;

  return (
    <div className="ht-overlay" onClick={onClose}>
      <div className="ht-quant-modal" onClick={e => e.stopPropagation()}>
        <div className="ht-quant-header">
          <span>{habit.name}</span>
          <button className="ht-quant-close" onClick={onClose}>✕</button>
        </div>
        <div className="ht-quant-body">
          <div className="ht-quant-controls">
            <button className="ht-quant-btn" onClick={() => setVal(v => Math.max(0, round1(v - step)))}>−</button>
            <div className="ht-quant-val-wrap">
              <span className="ht-quant-val">{val}</span>
              <span className="ht-quant-unit">{habit.target_unit}</span>
            </div>
            <button className="ht-quant-btn" onClick={() => setVal(v => round1(v + step))}>+</button>
          </div>
          <div className="ht-quant-track">
            <div className="ht-quant-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="ht-quant-meta">Target: {habit.target_value} {habit.target_unit}</div>
          <button className="ht-btn ht-btn--primary" onClick={() => onConfirm(val)}>Log {val} {habit.target_unit}</button>
        </div>
      </div>
    </div>
  );
}

/* ── Heatmap ────────────────────────────────────────────────────────────────── */
function HeatmapGrid({ data }) {
  const [tooltip, setTooltip] = useState(null);

  const weeks = useMemo(() => {
    const cells = [];
    const start = new Date();
    start.setDate(start.getDate() - 364);
    // Align to Sunday
    start.setDate(start.getDate() - start.getDay());

    for (let w = 0; w < 53; w++) {
      const week = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(start);
        date.setDate(start.getDate() + w * 7 + d);
        const iso = date.toISOString().slice(0, 10);
        const entry = data[iso];
        const pct = entry ? (entry.total > 0 ? entry.done / entry.total : 0) : -1; // -1 = no data
        week.push({ iso, pct, done: entry?.done ?? 0, total: entry?.total ?? 0 });
      }
      cells.push(week);
    }
    return cells;
  }, [data]);

  const monthLabels = useMemo(() => {
    const labels = [];
    let lastMonth = -1;
    weeks.forEach((week, wi) => {
      const month = new Date(week[0].iso).getMonth();
      if (month !== lastMonth) {
        labels.push({ wi, label: new Date(week[0].iso).toLocaleString("en-US", { month: "short" }) });
        lastMonth = month;
      }
    });
    return labels;
  }, [weeks]);

  const cellColor = (pct) => {
    if (pct < 0) return "var(--surface-3)";
    if (pct === 0) return "rgba(222,41,82,0.06)";
    if (pct < 0.26) return "rgba(222,41,82,0.25)";
    if (pct < 0.51) return "rgba(222,41,82,0.45)";
    if (pct < 0.76) return "rgba(222,41,82,0.68)";
    return "var(--accent-3)";
  };

  return (
    <div className="ht-heatmap-wrap">
      {/* Month labels */}
      <div className="ht-heatmap-months" style={{ gridTemplateColumns: `repeat(${weeks.length}, 1fr)` }}>
        {weeks.map((_, wi) => {
          const ml = monthLabels.find(m => m.wi === wi);
          return <div key={wi} className="ht-heatmap-month-label">{ml ? ml.label : ""}</div>;
        })}
      </div>
      {/* Grid */}
      <div className="ht-heatmap-grid" style={{ gridTemplateColumns: `repeat(${weeks.length}, 1fr)` }}>
        {weeks.map((week, wi) =>
          week.map((cell, di) => (
            <div
              key={`${wi}-${di}`}
              className="ht-heatmap-cell"
              style={{ background: cellColor(cell.pct) }}
              onMouseEnter={(e) => setTooltip({ cell, x: e.clientX, y: e.clientY })}
              onMouseLeave={() => setTooltip(null)}
            />
          ))
        )}
      </div>
      {/* Legend */}
      <div className="ht-heatmap-legend">
        <span className="ht-heatmap-legend-label">Less</span>
        {[0, 0.25, 0.5, 0.75, 1].map(p => (
          <div key={p} className="ht-heatmap-cell ht-heatmap-cell--lg" style={{ background: cellColor(p) }} />
        ))}
        <span className="ht-heatmap-legend-label">More</span>
      </div>
      {/* Tooltip */}
      {tooltip && (
        <div className="ht-heatmap-tooltip" style={{ left: tooltip.x + 12, top: tooltip.y - 36, position: "fixed" }}>
          {tooltip.cell.pct < 0
            ? `${tooltip.cell.iso} — no data`
            : `${tooltip.cell.iso} — ${tooltip.cell.done}/${tooltip.cell.total} complete`
          }
        </div>
      )}
    </div>
  );
}

/* ── Correlation panel ──────────────────────────────────────────────────────── */
function CorrelationPanel({ corr }) {
  const cards = [
    {
      key: "weight",
      label: "Weight Trend",
      fmt: (v) => v == null ? "—" : `${v > 0 ? "+" : ""}${v} kg/day`,
      better: "lower",
      high: corr.weight.high,
      low:  corr.weight.low,
    },
    {
      key: "training",
      label: "Training Days",
      fmt: (v) => v == null ? "—" : `${v}% of days`,
      better: "higher",
      high: corr.training.high,
      low:  corr.training.low,
    },
    {
      key: "calories",
      label: "Avg Calories",
      fmt: (v) => v == null ? "—" : `${v.toLocaleString()} kcal`,
      better: null,
      high: corr.calories.high,
      low:  corr.calories.low,
    },
    {
      key: "steps",
      label: "Daily Steps",
      fmt: (v) => v == null ? "—" : v.toLocaleString(),
      better: "higher",
      high: corr.steps.high,
      low:  corr.steps.low,
    },
  ];

  return (
    <div className="ht-corr-wrap">
      <div className="ht-corr-legend">
        <span className="ht-corr-badge ht-corr-badge--high">High habit days (&gt;66%)</span>
        <span className="ht-corr-badge ht-corr-badge--low">Low habit days (&lt;33%)</span>
        <span className="ht-corr-sample">Based on {corr.sampleSize.high} / {corr.sampleSize.low} days</span>
      </div>
      <div className="ht-corr-grid">
        {cards.map(c => {
          const diff = c.high != null && c.low != null ? c.high - c.low : null;
          const goodHigh = diff != null && (
            (c.better === "higher" && diff > 0) ||
            (c.better === "lower"  && diff < 0)
          );
          return (
            <div key={c.key} className="ht-corr-card">
              <div className="ht-corr-card-title">{c.label}</div>
              <div className="ht-corr-card-rows">
                <div className="ht-corr-card-row">
                  <span className="ht-corr-card-label ht-corr-card-label--high">HIGH</span>
                  <span className="ht-corr-card-val" style={{ color: goodHigh ? "var(--ok)" : "var(--text-1)" }}>
                    {c.fmt(c.high)}
                  </span>
                </div>
                <div className="ht-corr-card-row">
                  <span className="ht-corr-card-label ht-corr-card-label--low">LOW</span>
                  <span className="ht-corr-card-val" style={{ color: !goodHigh && diff != null ? "var(--text-1)" : "var(--text-2)" }}>
                    {c.fmt(c.low)}
                  </span>
                </div>
              </div>
              {diff != null && (
                <div className="ht-corr-card-delta" style={{ color: goodHigh ? "var(--ok)" : diff !== 0 ? "var(--warn)" : "var(--text-3)" }}>
                  {diff > 0 ? "↑" : diff < 0 ? "↓" : "→"} {c.fmt(Math.abs(diff))} difference
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Template picker ────────────────────────────────────────────────────────── */
function TemplatePicker({ onConfirm, onSkip, saving }) {
  const [selected, setSelected] = useState(new Set());
  const toggle = (t) => setSelected(prev => {
    const n = new Set(prev);
    n.has(t) ? n.delete(t) : n.add(t);
    return n;
  });
  const byArea = useMemo(() => {
    const g = {};
    for (const t of TEMPLATES) {
      if (!g[t.area]) g[t.area] = [];
      g[t.area].push(t);
    }
    return g;
  }, []);
  const areaInfo = Object.fromEntries(DEFAULT_AREAS.map(a => [a.name, a]));

  return (
    <div className="ht-overlay">
      <div className="ht-template-modal">
        <div className="ht-template-header">
          <span className="ht-template-title">◈ GET STARTED</span>
          <span className="ht-template-sub">Choose habits to add, or build your own</span>
        </div>
        <div className="ht-template-body">
          {Object.entries(byArea).map(([areaName, templates]) => {
            const info = areaInfo[areaName];
            return (
              <div key={areaName} className="ht-template-area">
                <div className="ht-template-area-label" style={{ color: info?.color }}>
                  {areaName.toUpperCase()}
                </div>
                {templates.map(t => (
                  <button
                    key={t.name}
                    className={`ht-template-item${selected.has(t) ? " ht-template-item--selected" : ""}`}
                    style={selected.has(t) ? { borderColor: info?.color, background: `${info?.color}18` } : {}}
                    onClick={() => toggle(t)}
                  >
                    <div className="ht-template-item-text">
                      <div className="ht-template-item-name-row">
                        <span className="ht-template-item-name">{t.name}</span>
                        {t.inherit_source && (
                          <span className="ht-template-sync-badge">auto-sync</span>
                        )}
                      </div>
                      <span className="ht-template-item-meta">
                        {t.habit_type === "quantified" ? `${t.target_value} ${t.target_unit} · ` : ""}
                        {t.time_of_day}
                        {t.habit_type === "negative" ? " · avoid" : ""}
                      </span>
                    </div>
                    <span className="ht-template-check">{selected.has(t) ? "✓" : ""}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
        <div className="ht-template-footer">
          <button className="ht-btn" onClick={onSkip}>Skip — I'll build my own</button>
          <button
            className="ht-btn ht-btn--primary"
            disabled={selected.size === 0 || saving}
            onClick={() => onConfirm([...selected])}
          >
            {saving ? "Adding…" : `Add selected (${selected.size})`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Habit modal (create / edit) ─────────────────────────────────────────────── */
function HabitModal({ habit, areas, onSave, onClose, saving }) {
  const [form, setForm] = useState({
    id:           habit?.id           ?? null,
    name:         habit?.name         ?? "",
    area_id:      habit?.area_id      ?? (areas[0]?.id || null),
    habit_type:   habit?.habit_type   ?? "positive",
    target_value: habit?.target_value ?? "",
    target_unit:  habit?.target_unit  ?? "",
    time_of_day:  habit?.time_of_day  ?? "morning",
    is_archived:  habit?.is_archived  ?? false,
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="ht-overlay" onClick={onClose}>
      <div className="ht-modal" onClick={e => e.stopPropagation()}>
        <div className="ht-modal-header">
          <span className="ht-modal-title">{habit ? "EDIT HABIT" : "NEW HABIT"}</span>
          <button className="ht-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="ht-modal-body">
          {/* Name */}
          <div className="ht-modal-field">
            <label className="ht-modal-label">Habit name</label>
            <input
              className="ht-input ht-input--name"
              placeholder="e.g. Drink 3L water"
              value={form.name}
              onChange={e => set("name", e.target.value)}
              autoFocus
            />
          </div>

          {/* Area */}
          <div className="ht-modal-field">
            <label className="ht-modal-label">Area</label>
            <select className="ht-select" value={form.area_id || ""} onChange={e => set("area_id", e.target.value || null)}>
              <option value="">No area</option>
              {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>

          {/* Type */}
          <div className="ht-modal-field">
            <label className="ht-modal-label">Type</label>
            <div className="ht-pill-group">
              {[["positive","✓ Do more"],["negative","✗ Avoid"],["quantified","# Measure"]].map(([v,l]) => (
                <button key={v} className={`ht-pill${form.habit_type === v ? " ht-pill--active" : ""}`} onClick={() => set("habit_type", v)}>{l}</button>
              ))}
            </div>
          </div>

          {/* Quantified target */}
          {form.habit_type === "quantified" && (
            <div className="ht-modal-field ht-modal-field--row">
              <div style={{ flex: 1 }}>
                <label className="ht-modal-label">Target</label>
                <input className="ht-input" type="number" min="0" step="any" value={form.target_value} onChange={e => set("target_value", e.target.value)} placeholder="e.g. 3" />
              </div>
              <div style={{ flex: 1 }}>
                <label className="ht-modal-label">Unit</label>
                <input className="ht-input" value={form.target_unit} onChange={e => set("target_unit", e.target.value)} placeholder="litres, pages, min…" />
              </div>
            </div>
          )}

          {/* Time of day */}
          <div className="ht-modal-field">
            <label className="ht-modal-label">Time of day</label>
            <div className="ht-pill-group">
              {TIME_GROUPS.map(t => (
                <button key={t} className={`ht-pill${form.time_of_day === t ? " ht-pill--active" : ""}`} onClick={() => set("time_of_day", t)}>{TIME_LABELS[t]}</button>
              ))}
            </div>
          </div>

          {/* Archive (edit only) */}
          {habit && (
            <div className="ht-modal-field ht-modal-field--row ht-modal-field--archive">
              <label className="ht-modal-label">Archive this habit</label>
              <button
                className={`ht-pill${form.is_archived ? " ht-pill--active ht-pill--warn" : ""}`}
                onClick={() => set("is_archived", !form.is_archived)}
              >
                {form.is_archived ? "Archived" : "Active"}
              </button>
            </div>
          )}
        </div>
        <div className="ht-modal-footer">
          <button className="ht-btn" onClick={onClose}>Cancel</button>
          <button
            className="ht-btn ht-btn--primary"
            disabled={!form.name.trim() || saving}
            onClick={() => onSave(form)}
          >
            {saving ? "Saving…" : habit ? "Save Changes" : "Add Habit"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CSS
═══════════════════════════════════════════════════════════════════════════ */
const CSS = `
  .ht-page { display:flex; flex-direction:column; gap:1.1rem; font-family:var(--font-body); }

  /* ── Header ── */
  .ht-header { display:flex; justify-content:space-between; align-items:center; gap:1rem; flex-wrap:wrap; }
  .ht-header-left { display:flex; flex-direction:column; gap:0.22rem; }
  .ht-title { font-family:var(--font-display); font-size:0.72rem; letter-spacing:0.22em; text-transform:uppercase; color:var(--accent-3); display:flex; align-items:center; gap:0.55rem; }
  .ht-title::before { content:""; display:inline-block; width:28px; height:2px; background:var(--accent-1); border-radius:999px; }
  .ht-date { font-family:var(--font-display); font-size:0.64rem; letter-spacing:0.14em; color:var(--text-3); padding-left:calc(28px + 0.55rem); }

  /* ── Tabs ── */
  .ht-tabs { display:flex; gap:0.25rem; }
  .ht-tab { background:transparent; border:1px solid var(--line-1); color:var(--text-3); cursor:pointer; font-size:0.72rem; font-family:var(--font-display); letter-spacing:0.1em; padding:0.4rem 0.9rem; border-radius:var(--radius-sm); transition:all var(--motion-fast); }
  .ht-tab:hover { border-color:var(--line-2); color:var(--text-2); }
  .ht-tab--active { background:var(--surface-3); border-color:var(--accent-2); color:var(--text-1); box-shadow:0 0 10px rgba(222,41,82,0.12); }

  /* ── Panels ── */
  .ht-panel { background:var(--surface-2); border:1px solid var(--line-1); border-radius:var(--radius-md); padding:0.9rem 1rem; position:relative; overflow:hidden; }
  .ht-panel::before { content:""; position:absolute; top:0; left:0; right:0; height:1px; background:linear-gradient(90deg,transparent,var(--accent-3) 50%,transparent); pointer-events:none; }
  .ht-section-label { font-family:var(--font-display); font-size:0.65rem; letter-spacing:0.2em; text-transform:uppercase; color:var(--accent-3); margin-bottom:0.75rem; display:flex; align-items:center; gap:0.5rem; }

  /* ── Today layout ── */
  .ht-today { display:flex; flex-direction:column; gap:0.9rem; }
  .ht-analytics { display:flex; flex-direction:column; gap:0.9rem; }

  /* ── Progress ring ── */
  .ht-ring-wrap { display:flex; align-items:center; gap:1.2rem; background:var(--surface-2); border:1px solid var(--line-1); border-radius:var(--radius-md); padding:0.9rem 1.2rem; position:relative; overflow:hidden; }
  .ht-ring-wrap::before { content:""; position:absolute; inset:0; background:radial-gradient(280px 160px at 50% 50%,rgba(181,21,60,0.08),transparent 70%); pointer-events:none; }
  .ht-ring-svg-wrap { position:relative; width:120px; height:120px; flex-shrink:0; }
  .ht-ring-center { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; }
  .ht-ring-num { font-family:var(--font-display); font-size:2rem; font-weight:700; color:var(--text-1); line-height:1; letter-spacing:-0.03em; }
  .ht-ring-denom { font-family:var(--font-display); font-size:0.75rem; color:var(--text-3); }
  .ht-ring-label { font-family:var(--font-display); font-size:0.8rem; color:var(--text-2); letter-spacing:0.06em; }

  /* ── Groups ── */
  .ht-group { display:flex; flex-direction:column; gap:0.38rem; }
  .ht-group-label { font-family:var(--font-display); font-size:0.62rem; letter-spacing:0.2em; text-transform:uppercase; color:var(--text-3); padding:0 0.1rem; }
  .ht-group-list { display:flex; flex-direction:column; gap:0.28rem; }

  /* ── Habit row ── */
  .ht-habit-row { display:flex; align-items:center; gap:0.75rem; background:var(--surface-2); border:1px solid var(--line-1); border-radius:var(--radius-md); padding:0.65rem 0.9rem; transition:all var(--motion-fast); }
  .ht-habit-row:hover { border-color:var(--line-2); transform:translateX(2px); }
  .ht-habit-circle { width:32px; height:32px; border-radius:50%; cursor:pointer; flex-shrink:0; display:flex; align-items:center; justify-content:center; transition:all 200ms cubic-bezier(.22,.68,0,1.2); }
  .ht-habit-circle:hover { transform:scale(1.12); }
  .ht-habit-circle-sym { font-size:0.75rem; color:#fff; font-weight:700; line-height:1; }
  .ht-habit-info { display:flex; align-items:center; gap:0.6rem; flex:1; min-width:0; cursor:pointer; }
  .ht-habit-icon { font-size:1.1rem; flex-shrink:0; }
  .ht-habit-text { display:flex; flex-direction:column; gap:0.08rem; flex:1; min-width:0; }
  .ht-habit-name { font-size:0.92rem; color:var(--text-1); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .ht-habit-quant { font-family:var(--font-display); font-size:0.62rem; letter-spacing:0.08em; color:var(--text-3); }
  .ht-habit-inherit-label { font-family:var(--font-display); font-size:0.59rem; letter-spacing:0.1em; color:var(--text-3); opacity:0.7; }
  .ht-area-badge { font-family:var(--font-display); font-size:0.58rem; letter-spacing:0.1em; text-transform:uppercase; padding:0.14rem 0.45rem; border-radius:999px; white-space:nowrap; flex-shrink:0; }
  .ht-habit-row--skipped { opacity:0.5; }
  .ht-sync-icon { width:32px; height:32px; flex-shrink:0; display:flex; align-items:center; justify-content:center; }
  .ht-sync-dash { font-family:var(--font-display); font-size:0.9rem; color:var(--text-3); }

  /* ── Empty state ── */
  .ht-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:0.6rem; padding:3rem 1rem; text-align:center; }
  .ht-empty-icon { font-family:var(--font-display); font-size:2rem; color:var(--line-2); }
  .ht-empty-title { font-family:var(--font-display); font-size:0.9rem; letter-spacing:0.1em; color:var(--text-2); }
  .ht-empty-sub { font-size:0.82rem; color:var(--text-3); }
  .ht-empty-inline { font-size:0.82rem; color:var(--text-3); padding:0.5rem 0; }
  .ht-loading-inline { font-family:var(--font-display); font-size:0.72rem; letter-spacing:0.12em; color:var(--text-3); padding:0.5rem 0; }

  /* ── Add button ── */
  .ht-add-btn { display:flex; align-items:center; justify-content:center; gap:0.38rem; padding:0.55rem 0.9rem; background:transparent; border:1px dashed var(--line-2); border-radius:var(--radius-md); color:var(--text-3); cursor:pointer; font-size:0.82rem; width:100%; transition:all var(--motion-fast); }
  .ht-add-btn:hover { border-color:var(--accent-2); color:var(--accent-3); background:rgba(222,41,82,0.05); box-shadow:0 0 12px rgba(222,41,82,0.08); }

  /* ── Buttons ── */
  .ht-btn { background:transparent; border:1px solid var(--line-1); color:var(--text-2); cursor:pointer; font-size:0.78rem; font-family:var(--font-display); letter-spacing:0.08em; padding:0.5rem 1rem; border-radius:var(--radius-sm); transition:all var(--motion-fast); }
  .ht-btn:hover { border-color:var(--line-2); color:var(--text-1); }
  .ht-btn:disabled { opacity:0.45; cursor:not-allowed; }
  .ht-btn--primary { background:rgba(222,41,82,0.12); border-color:var(--accent-2); color:var(--accent-3); }
  .ht-btn--primary:hover:not(:disabled) { background:rgba(222,41,82,0.22); box-shadow:0 0 14px rgba(222,41,82,0.25); }

  /* ── Heatmap ── */
  .ht-heatmap-wrap { display:flex; flex-direction:column; gap:0.35rem; overflow-x:auto; padding-bottom:0.5rem; }
  .ht-heatmap-months { display:grid; gap:2px; margin-bottom:0.1rem; }
  .ht-heatmap-month-label { font-family:var(--font-display); font-size:0.58rem; letter-spacing:0.06em; color:var(--text-3); white-space:nowrap; }
  .ht-heatmap-grid { display:grid; gap:2px; grid-auto-rows:12px; }
  .ht-heatmap-cell { width:12px; height:12px; border-radius:2px; cursor:default; transition:opacity var(--motion-fast); }
  .ht-heatmap-cell:hover { opacity:0.8; }
  .ht-heatmap-cell--lg { width:14px; height:14px; }
  .ht-heatmap-legend { display:flex; align-items:center; gap:3px; margin-top:0.4rem; }
  .ht-heatmap-legend-label { font-family:var(--font-display); font-size:0.58rem; color:var(--text-3); margin:0 0.3rem; }
  .ht-heatmap-tooltip { background:var(--surface-3); border:1px solid var(--line-1); border-radius:var(--radius-sm); padding:0.3rem 0.6rem; font-family:var(--font-display); font-size:0.65rem; color:var(--text-1); pointer-events:none; z-index:999; white-space:nowrap; }

  /* ── Correlation ── */
  .ht-corr-wrap { display:flex; flex-direction:column; gap:0.75rem; }
  .ht-corr-legend { display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap; }
  .ht-corr-badge { font-family:var(--font-display); font-size:0.62rem; letter-spacing:0.08em; padding:0.2rem 0.55rem; border-radius:999px; }
  .ht-corr-badge--high { background:rgba(40,183,141,0.12); border:1px solid rgba(40,183,141,0.3); color:var(--ok); }
  .ht-corr-badge--low  { background:rgba(255,79,115,0.1);  border:1px solid rgba(255,79,115,0.25); color:var(--bad); }
  .ht-corr-sample { font-family:var(--font-display); font-size:0.6rem; color:var(--text-3); letter-spacing:0.06em; }
  .ht-corr-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:0.6rem; }
  @media(min-width:900px) { .ht-corr-grid { grid-template-columns:repeat(4,1fr); } }
  .ht-corr-card { background:var(--surface-3); border:1px solid var(--line-1); border-radius:var(--radius-md); padding:0.75rem 0.85rem; display:flex; flex-direction:column; gap:0.45rem; }
  .ht-corr-card-title { font-family:var(--font-display); font-size:0.65rem; letter-spacing:0.12em; text-transform:uppercase; color:var(--text-3); }
  .ht-corr-card-rows { display:flex; flex-direction:column; gap:0.28rem; }
  .ht-corr-card-row { display:flex; align-items:center; justify-content:space-between; gap:0.4rem; }
  .ht-corr-card-label { font-family:var(--font-display); font-size:0.6rem; letter-spacing:0.12em; padding:0.1rem 0.38rem; border-radius:999px; }
  .ht-corr-card-label--high { background:rgba(40,183,141,0.12); color:var(--ok); }
  .ht-corr-card-label--low  { background:rgba(255,79,115,0.1);  color:var(--bad); }
  .ht-corr-card-val { font-family:var(--font-display); font-size:0.78rem; font-weight:600; color:var(--text-1); }
  .ht-corr-card-delta { font-family:var(--font-display); font-size:0.62rem; color:var(--text-3); border-top:1px solid var(--line-1); padding-top:0.3rem; }

  /* ── Per-habit stats table ── */
  .ht-stats-table { display:flex; flex-direction:column; gap:0; }
  .ht-stats-header { display:grid; grid-template-columns:1fr 72px 60px 56px 56px; gap:0.5rem; padding:0.35rem 0.5rem; font-family:var(--font-display); font-size:0.6rem; letter-spacing:0.12em; text-transform:uppercase; color:var(--text-3); border-bottom:1px solid var(--line-1); }
  .ht-stats-row { display:grid; grid-template-columns:1fr 72px 60px 56px 56px; gap:0.5rem; padding:0.48rem 0.5rem; border-bottom:1px solid rgba(255,255,255,0.03); transition:background var(--motion-fast); align-items:center; }
  .ht-stats-row:hover { background:rgba(255,255,255,0.02); }
  .ht-stats-name { display:flex; align-items:center; gap:0.42rem; font-size:0.85rem; color:var(--text-1); min-width:0; }
  .ht-stats-icon { font-size:0.9rem; flex-shrink:0; }
  .ht-stats-dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
  .ht-stats-val { font-family:var(--font-display); font-size:0.75rem; color:var(--text-2); text-align:right; }

  /* ── Overlay ── */
  .ht-overlay { position:fixed; inset:0; background:rgba(9,5,6,0.88); z-index:200; display:flex; align-items:flex-start; justify-content:center; padding:4vh 1rem; backdrop-filter:blur(4px); overflow-y:auto; }

  /* ── Quantified input ── */
  .ht-quant-modal { background:var(--surface-2); border:1px solid var(--line-1); border-top:2px solid var(--accent-2); border-radius:var(--radius-lg); width:100%; max-width:340px; overflow:hidden; box-shadow:0 0 40px rgba(181,21,60,0.15); margin-top:10vh; }
  .ht-quant-header { display:flex; justify-content:space-between; align-items:center; padding:0.8rem 1rem; border-bottom:1px solid var(--line-1); font-family:var(--font-display); font-size:0.8rem; color:var(--text-1); letter-spacing:0.06em; }
  .ht-quant-close { background:transparent; border:none; color:var(--text-3); cursor:pointer; font-size:0.9rem; padding:0.1rem 0.3rem; }
  .ht-quant-body { padding:1.2rem 1rem; display:flex; flex-direction:column; gap:0.9rem; align-items:center; }
  .ht-quant-controls { display:flex; align-items:center; gap:1rem; }
  .ht-quant-btn { width:44px; height:44px; border-radius:50%; border:1px solid var(--line-2); background:var(--surface-3); color:var(--text-1); font-size:1.4rem; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all var(--motion-fast); }
  .ht-quant-btn:hover { border-color:var(--accent-2); color:var(--accent-3); }
  .ht-quant-val-wrap { display:flex; flex-direction:column; align-items:center; min-width:80px; }
  .ht-quant-val { font-family:var(--font-display); font-size:2.4rem; font-weight:700; color:var(--text-1); line-height:1; }
  .ht-quant-unit { font-family:var(--font-display); font-size:0.7rem; color:var(--text-3); letter-spacing:0.1em; }
  .ht-quant-track { width:100%; height:6px; border-radius:999px; background:var(--surface-1); overflow:hidden; }
  .ht-quant-fill { height:100%; border-radius:999px; background:linear-gradient(90deg,var(--accent-1),var(--accent-3)); transition:width 300ms ease; }
  .ht-quant-meta { font-family:var(--font-display); font-size:0.65rem; color:var(--text-3); letter-spacing:0.1em; }

  /* ── Template modal ── */
  .ht-template-modal { background:var(--surface-2); border:1px solid var(--line-1); border-top:2px solid var(--accent-2); border-radius:var(--radius-lg); width:100%; max-width:500px; max-height:82vh; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 0 40px rgba(181,21,60,0.12); }
  .ht-template-header { padding:1rem 1.2rem; border-bottom:1px solid var(--line-1); background:linear-gradient(135deg,rgba(138,15,46,0.18),rgba(181,21,60,0.04)); }
  .ht-template-title { font-family:var(--font-display); font-size:0.72rem; letter-spacing:0.24em; text-transform:uppercase; color:var(--accent-3); display:block; margin-bottom:0.3rem; }
  .ht-template-sub { font-size:0.82rem; color:var(--text-3); }
  .ht-template-body { flex:1; overflow-y:auto; padding:0.75rem 1rem; display:flex; flex-direction:column; gap:0.9rem; }
  .ht-template-area { display:flex; flex-direction:column; gap:0.3rem; }
  .ht-template-area-label { font-family:var(--font-display); font-size:0.62rem; letter-spacing:0.18em; text-transform:uppercase; margin-bottom:0.18rem; }
  .ht-template-item { display:flex; align-items:center; gap:0.65rem; padding:0.55rem 0.7rem; background:var(--surface-3); border:1px solid var(--line-1); border-radius:var(--radius-sm); cursor:pointer; transition:all var(--motion-fast); text-align:left; width:100%; }
  .ht-template-item:hover { border-color:var(--line-2); }
  .ht-template-item--selected { }
  .ht-template-item-icon { font-size:1.1rem; flex-shrink:0; }
  .ht-template-item-text { display:flex; flex-direction:column; gap:0.06rem; flex:1; min-width:0; }
  .ht-template-item-name-row { display:flex; align-items:center; gap:0.45rem; flex-wrap:wrap; }
  .ht-template-item-name { font-size:0.9rem; color:var(--text-1); }
  .ht-template-sync-badge { font-family:var(--font-display); font-size:0.55rem; letter-spacing:0.1em; text-transform:uppercase; padding:0.1rem 0.38rem; border-radius:999px; background:rgba(8,145,178,0.12); border:1px solid rgba(8,145,178,0.3); color:#38bdf8; flex-shrink:0; }
  .ht-template-item-meta { font-family:var(--font-display); font-size:0.6rem; letter-spacing:0.08em; color:var(--text-3); text-transform:uppercase; }
  .ht-template-check { font-size:0.8rem; color:var(--ok); width:18px; text-align:center; flex-shrink:0; }
  .ht-template-footer { padding:0.8rem 1rem; border-top:1px solid var(--line-1); display:flex; justify-content:space-between; gap:0.5rem; }

  /* ── Habit modal ── */
  .ht-modal { background:var(--surface-2); border:1px solid var(--line-1); border-top:2px solid var(--accent-2); border-radius:var(--radius-lg); width:100%; max-width:460px; max-height:88vh; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 0 40px rgba(181,21,60,0.12); }
  .ht-modal-header { display:flex; justify-content:space-between; align-items:center; padding:0.8rem 1.1rem; border-bottom:1px solid var(--line-1); }
  .ht-modal-title { font-family:var(--font-display); font-size:0.66rem; letter-spacing:0.22em; text-transform:uppercase; color:var(--text-2); }
  .ht-modal-close { background:transparent; border:none; color:var(--text-3); cursor:pointer; font-size:1rem; padding:0.1rem 0.3rem; }
  .ht-modal-body { flex:1; overflow-y:auto; padding:0.9rem 1.1rem; display:flex; flex-direction:column; gap:0.85rem; }
  .ht-modal-footer { padding:0.75rem 1.1rem; border-top:1px solid var(--line-1); display:flex; justify-content:flex-end; gap:0.5rem; }
  .ht-modal-row--icon { display:flex; align-items:flex-start; gap:0.65rem; position:relative; }
  .ht-modal-field { display:flex; flex-direction:column; gap:0.35rem; }
  .ht-modal-field--row { flex-direction:row; align-items:center; justify-content:space-between; gap:0.75rem; }
  .ht-modal-field--archive { padding:0.5rem 0; border-top:1px solid var(--line-1); }
  .ht-modal-label { font-family:var(--font-display); font-size:0.62rem; letter-spacing:0.14em; text-transform:uppercase; color:var(--text-3); }
  .ht-input { background:var(--surface-1); border:1px solid var(--line-1); border-radius:var(--radius-sm); color:var(--text-1); font-family:var(--font-body); font-size:0.9rem; padding:0.5rem 0.7rem; width:100%; box-sizing:border-box; transition:border-color var(--motion-fast); }
  .ht-input:focus { outline:none; border-color:var(--accent-2); }
  .ht-input--name { font-size:1rem; }
  .ht-select { background:var(--surface-1); border:1px solid var(--line-1); border-radius:var(--radius-sm); color:var(--text-1); font-family:var(--font-display); font-size:0.8rem; padding:0.48rem 0.7rem; width:100%; cursor:pointer; }
  .ht-icon-pick { width:48px; height:48px; border:1px solid var(--line-1); border-radius:var(--radius-sm); background:var(--surface-3); display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0; transition:border-color var(--motion-fast); }
  .ht-icon-pick:hover { border-color:var(--accent-2); }
  .ht-emoji-grid { position:absolute; top:52px; left:0; background:var(--surface-2); border:1px solid var(--line-1); border-radius:var(--radius-md); padding:0.5rem; display:grid; grid-template-columns:repeat(8,1fr); gap:2px; z-index:10; box-shadow:0 8px 24px rgba(0,0,0,0.4); max-width:280px; }
  .ht-emoji-btn { background:transparent; border:none; font-size:1.1rem; cursor:pointer; padding:0.2rem; border-radius:4px; transition:background var(--motion-fast); }
  .ht-emoji-btn:hover { background:var(--surface-3); }
  .ht-pill-group { display:flex; gap:0.28rem; flex-wrap:wrap; }
  .ht-pill { background:transparent; border:1px solid var(--line-1); color:var(--text-3); cursor:pointer; font-size:0.72rem; font-family:var(--font-display); letter-spacing:0.06em; padding:0.32rem 0.72rem; border-radius:999px; transition:all var(--motion-fast); }
  .ht-pill:hover { border-color:var(--line-2); color:var(--text-2); }
  .ht-pill--active { background:var(--surface-3); border-color:var(--accent-2); color:var(--text-1); box-shadow:inset 0 0 8px rgba(222,41,82,0.1); }
  .ht-pill--warn.ht-pill--active { border-color:var(--warn); color:var(--warn); }
`;
