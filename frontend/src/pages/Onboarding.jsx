import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState(null);

  const [unitSystem, setUnitSystem] = useState("metric");
  const [heightInput, setHeightInput] = useState("");
  const [startingWeightInput, setStartingWeightInput] = useState("");
  const [goalWeightInput, setGoalWeightInput] = useState("");

  const [goalType, setGoalType] = useState("maintain");
  const [weeklyChangeInput, setWeeklyChangeInput] = useState("");
  const [calorieMode, setCalorieMode] = useState("ai");
  const [customCalories, setCustomCalories] = useState("");

  const [trainingDaysSelected, setTrainingDaysSelected] = useState([]);
  const [splitMode, setSplitMode] = useState("fixed");
  const [trainingFrequencyRange, setTrainingFrequencyRange] = useState("2-4");
  const [rollingStartDate, setRollingStartDate] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("beginner");
  const [gymType, setGymType] = useState("commercial");
  const [gymChain, setGymChain] = useState("");

  const [activityLevel, setActivityLevel] = useState("moderate");
  const [baselineStepsInput, setBaselineStepsInput] = useState("");
  const [baselineCardioMinutesInput, setBaselineCardioMinutesInput] = useState("");
  const [baselineCardioHrInput, setBaselineCardioHrInput] = useState("");

  const [dietaryPreference, setDietaryPreference] = useState("omnivore");
  const [dietaryAdditional, setDietaryAdditional] = useState("");
  const [foodAllergies, setFoodAllergies] = useState("");
  const [dislikes, setDislikes] = useState("");
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      setError("");

      const { data: userRes, error: userError } = await supabase.auth.getUser();
      const user = userRes?.user;

      if (userError || !user) {
        setError("Not logged in.");
        setLoading(false);
        return;
      }

      const { data: existingProfile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileError && profileError.code !== "PGRST116") {
        setError(profileError.message);
        setLoading(false);
        return;
      }

      if (!existingProfile) {
        const { error: upsertErr } = await supabase
          .from("profiles")
          .upsert(
            {
              user_id: user.id,
              email: user.email,
              subscription_status: "inactive",
              is_suspended: false,
              onboarding_complete: false
            },
            { onConflict: "user_id" }
          );

        if (upsertErr) {
          setError(upsertErr.message);
          setLoading(false);
          return;
        }

        const { data: createdProfile, error: createdProfileErr } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (createdProfileErr && createdProfileErr.code !== "PGRST116") {
          setError(createdProfileErr.message);
          setLoading(false);
          return;
        }

        if (!createdProfile) {
          setError("Profile could not be created.");
          setLoading(false);
          return;
        }

        setProfile(createdProfile);
        setLoading(false);
        return;
      }

      setProfile(existingProfile);

      if (existingProfile.onboarding_complete) {
        navigate("/app/dashboard");
        return;
      }

      if (existingProfile.unit_system) setUnitSystem(existingProfile.unit_system);

      if (existingProfile.height_cm) {
        if (existingProfile.unit_system === "imperial") {
          const inches = existingProfile.height_cm / 2.54;
          const feet = Math.floor(inches / 12);
          const remInches = Math.round(inches - feet * 12);
          setHeightInput(`${feet}'${remInches}"`);
        } else {
          setHeightInput(String(existingProfile.height_cm));
        }
      }

      if (existingProfile.starting_weight_kg) {
        if (existingProfile.unit_system === "imperial") {
          const lbs = Math.round(existingProfile.starting_weight_kg * 2.20462);
          setStartingWeightInput(String(lbs));
        } else {
          setStartingWeightInput(String(existingProfile.starting_weight_kg));
        }
      }

      if (existingProfile.goal_weight_kg) {
        if (existingProfile.unit_system === "imperial") {
          const lbs = Math.round(existingProfile.goal_weight_kg * 2.20462);
          setGoalWeightInput(String(lbs));
        } else {
          setGoalWeightInput(String(existingProfile.goal_weight_kg));
        }
      }

      if (existingProfile.goal_type) setGoalType(existingProfile.goal_type);

      if (existingProfile.weekly_weight_change_target_kg) {
        if (existingProfile.unit_system === "imperial") {
          const lbs = existingProfile.weekly_weight_change_target_kg * 2.20462;
          setWeeklyChangeInput(String(lbs.toFixed(1)));
        } else {
          setWeeklyChangeInput(String(existingProfile.weekly_weight_change_target_kg));
        }
      }

      if (existingProfile.calorie_mode) setCalorieMode(existingProfile.calorie_mode);
      if (existingProfile.custom_calories) setCustomCalories(String(existingProfile.custom_calories));
      if (existingProfile.training_days) setTrainingDaysSelected(existingProfile.training_days);
      if (existingProfile.split_mode) setSplitMode(existingProfile.split_mode);
      if (existingProfile.training_frequency_range) setTrainingFrequencyRange(existingProfile.training_frequency_range);
      if (existingProfile.rolling_start_date) setRollingStartDate(String(existingProfile.rolling_start_date));
      if (existingProfile.experience_level) setExperienceLevel(existingProfile.experience_level);
      if (existingProfile.gym_type) setGymType(existingProfile.gym_type);
      if (existingProfile.gym_chain) setGymChain(existingProfile.gym_chain);
      if (existingProfile.dietary_preference) setDietaryPreference(existingProfile.dietary_preference);
      if (existingProfile.dietary_additional) setDietaryAdditional(existingProfile.dietary_additional);
      if (existingProfile.food_allergies) setFoodAllergies(existingProfile.food_allergies);
      if (existingProfile.dislikes) setDislikes(existingProfile.dislikes);

      if (existingProfile.activity_level) setActivityLevel(existingProfile.activity_level);
      if (existingProfile.baseline_steps_per_day !== null && existingProfile.baseline_steps_per_day !== undefined) {
        setBaselineStepsInput(String(existingProfile.baseline_steps_per_day));
      }
      if (
        existingProfile.baseline_cardio_minutes_per_week !== null &&
        existingProfile.baseline_cardio_minutes_per_week !== undefined
      ) {
        setBaselineCardioMinutesInput(String(existingProfile.baseline_cardio_minutes_per_week));
      }
      if (existingProfile.baseline_cardio_avg_hr !== null && existingProfile.baseline_cardio_avg_hr !== undefined) {
        setBaselineCardioHrInput(String(existingProfile.baseline_cardio_avg_hr));
      }

      setLoading(false);
    };

    loadProfile();
  }, [navigate]);

  const validateStep = (s) => {
    // Clear any previous error before re-validating
    setError("");

    // Step 1: Body metrics
    if (s === 1) {
      const heightCm = parseHeightToCm();
      const startingWeightKg = parseWeightToKg(startingWeightInput);
      const goalWeightKg = parseWeightToKg(goalWeightInput);

      if (!heightCm || !startingWeightKg || !goalWeightKg) {
        setError("Please fill in height, starting weight, and goal weight.");
        return false;
      }
      return true;
    }

    // Step 2: Goal & calories
    if (s === 2) {
      const weeklyChangeKgRaw = parseWeeklyChangeToKg();
      const weeklyChangeKg = safeWeeklyChangeKg(goalType, weeklyChangeKgRaw);

      if ((goalType === "lose" || goalType === "gain") && !weeklyChangeKg) {
        setError("Please choose a weekly rate of change.");
        return false;
      }

      if (calorieMode === "custom") {
        const cc = Number(customCalories);
        if (!Number.isFinite(cc) || cc < 1200) {
          setError("Custom calories must be at least 1200.");
          return false;
        }
      }

      return true;
    }

    // Step 3: Training setup
    if (s === 3) {
      if (splitMode === "fixed" && trainingDaysSelected.length === 0) {
        setError("Please select at least one training day.");
        return false;
      }

      if (splitMode === "rolling") {
        const d = rollingStartDate || new Date().toISOString().slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
          setError("Please choose a valid rolling split start date.");
          return false;
        }

        if (!trainingFrequencyRange) {
          setError("Please choose a training frequency range.");
          return false;
        }
      }

      return true;
    }

    // Step 4: Activity baseline (only lifestyle required; others optional)
    if (s === 4) {
      if (!activityLevel) {
        setError("Please choose your lifestyle activity level.");
        return false;
      }

      // Optional fields: steps/cardio/minutes/hr — allow empty
      // If provided, must be valid non-negative integers
      const baselineSteps = parseOptionalInt(baselineStepsInput);
      const baselineCardioMinutes = parseOptionalInt(baselineCardioMinutesInput);
      const baselineCardioHr = parseOptionalInt(baselineCardioHrInput);

      if (baselineStepsInput.trim() && baselineSteps === null) {
        setError("Average steps per day must be a non-negative number.");
        return false;
      }
      if (baselineCardioMinutesInput.trim() && baselineCardioMinutes === null) {
        setError("Cardio minutes per week must be a non-negative number.");
        return false;
      }
      if (baselineCardioHrInput.trim() && baselineCardioHr === null) {
        setError("Typical cardio heart rate must be a non-negative number.");
        return false;
      }

      return true;
    }

    // Step 5: Nutrition preferences (all optional; always valid)
    if (s === 5) {
      return true;
    }

    // Step 6: Safety
    if (s === 6) {
      if (!disclaimerAccepted) {
        setError("You must confirm the disclaimer to continue.");
        return false;
      }
      return true;
    }

    return true;
  };

  const nextStep = () => {
    if (saving) return;
    // Validate current step before moving forward
    const ok = validateStep(step);
    if (!ok) return;
    setStep((s) => Math.min(s + 1, 6));
  };
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  const toggleTrainingDay = (day) => {
    setTrainingDaysSelected((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const parseHeightToCm = () => {
    if (!heightInput) return null;
    if (unitSystem === "metric") {
      const v = Number(heightInput);
      return Number.isFinite(v) && v > 0 ? v : null;
    }

    const cleaned = heightInput.replace(/[^0-9'" ]/g, "").trim();
    const match = cleaned.match(/(\d+)'\s*(\d+)"/);

    if (match) {
      const feet = Number(match[1]);
      const inches = Number(match[2]);
      const totalInches = feet * 12 + inches;
      return Math.round(totalInches * 2.54);
    }

    const inchesOnly = Number(heightInput);
    if (!Number.isFinite(inchesOnly) || inchesOnly <= 0) return null;
    return Math.round(inchesOnly * 2.54);
  };

  const parseWeightToKg = (value) => {
    if (!value) return null;
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return null;
    if (unitSystem === "metric") return num;
    return num / 2.20462;
  };

  const parseWeeklyChangeToKg = () => {
    if (!weeklyChangeInput) return null;
    const num = Number(weeklyChangeInput);
    if (!Number.isFinite(num) || num <= 0) return null;
    if (unitSystem === "metric") return num;
    return num / 2.20462; 
  };

  const safeWeeklyChangeKg = (goal, kg) => {
    if (!kg || goal === "maintain") return null;
    if (goal === "lose") return Math.min(1, kg);
    if (goal === "gain") return Math.min(0.2, kg);
    return kg;
  };

  const parseOptionalInt = (v) => {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    if (!s) return null;
    const n = Math.round(Number(s));
    if (!Number.isFinite(n) || n < 0) return null;
    return n;
  };

  const handleSubmit = async () => {
    if (!profile) return;

    if (!validateStep(6)) return;

    setSaving(true);
    setError("");

    const heightCm = parseHeightToCm();
    const startingWeightKg = parseWeightToKg(startingWeightInput);
    const goalWeightKg = parseWeightToKg(goalWeightInput);
    const weeklyChangeKgRaw = parseWeeklyChangeToKg();
    const weeklyChangeKg = safeWeeklyChangeKg(goalType, weeklyChangeKgRaw);

    const baselineSteps = parseOptionalInt(baselineStepsInput);
    const baselineCardioMinutes = parseOptionalInt(baselineCardioMinutesInput);
    const baselineCardioHr = parseOptionalInt(baselineCardioHrInput);

    const basePayload = {
      unit_system: unitSystem,
      height_cm: heightCm,
      starting_weight_kg: startingWeightKg,
      current_weight_kg: startingWeightKg,
      goal_weight_kg: goalWeightKg,
      goal_type: goalType,
      weekly_weight_change_target_kg: goalType === "maintain" ? null : weeklyChangeKg,
      split_mode: splitMode,
      training_frequency_range: splitMode === "rolling" ? trainingFrequencyRange : null,
      rolling_start_date: splitMode === "rolling" ? rollingStartDate || new Date().toISOString().slice(0, 10) : null,
      training_days: splitMode === "fixed" ? trainingDaysSelected : null,
      training_days_per_week: splitMode === "fixed" ? trainingDaysSelected.length : null,
      experience_level: experienceLevel,
      gym_type: gymType,
      gym_chain: gymChain,
      dietary_preference: dietaryPreference,
      dietary_additional: dietaryAdditional,
      food_allergies: foodAllergies,
      dislikes,
      calorie_mode: calorieMode,
      custom_calories: calorieMode === "custom" ? Number(customCalories) || null : null,
      onboarding_complete: true
    };

    const activityPayload = {
      activity_level: activityLevel,
      baseline_steps_per_day: baselineSteps,
      baseline_cardio_minutes_per_week: baselineCardioMinutes,
      baseline_cardio_avg_hr: baselineCardioHr
    };

    let updateError = null;
    {
      const { error: e1 } = await supabase
        .from("profiles")
        .update({ ...basePayload, ...activityPayload })
        .eq("user_id", profile.user_id);
      updateError = e1;
    }

    if (updateError) {
      const msg = String(updateError.message || "");
      const looksLikeMissingColumn =
        msg.includes("Could not find") &&
        (msg.includes("activity_level") ||
          msg.includes("baseline_steps_per_day") ||
          msg.includes("baseline_cardio_minutes_per_week") ||
          msg.includes("baseline_cardio_avg_hr"));

      if (looksLikeMissingColumn) {
        const { error: e2 } = await supabase.from("profiles").update(basePayload).eq("user_id", profile.user_id);
        updateError = e2;
      }
    }

    if (updateError) {
      setSaving(false);
      setError(updateError.message);
      return;
    }

    const API_URL = (
      import.meta.env.VITE_API_URL ||
      import.meta.env.VITE_API_BASE_URL ||
      (import.meta.env.DEV ? "http://localhost:4000" : "https://physiquepilot.onrender.com")
    ).replace(/\/$/, "");

    const { error: initErr } = await fetch(`${API_URL}/api/nutrition/init`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: profile.user_id })
    }).then(async (r) => {
      const j = await r.json();
      return r.ok ? { error: null } : { error: j?.error || "Nutrition init failed" };
    });

    if (initErr) {
      setSaving(false);
      setError(String(initErr));
      return;
    }

    // --- Post-init nutrition logic: enforce sensible day-type differences ---
    // Rest day: lower calories, higher fats, lower carbs, protein unchanged
    // High day: slightly higher calories, more carbs than training day, protein unchanged
    try {
      const { data: tRows, error: tErr } = await supabase
        .from("nutrition_day_targets")
        .select("day_type, calories, protein_g, carbs_g, fats_g")
        .eq("user_id", profile.user_id)
        .in("day_type", ["training", "rest", "high"]);

      if (tErr) throw tErr;

      const byType = { training: null, rest: null, high: null };
      (tRows || []).forEach((r) => {
        byType[r.day_type] = r;
      });

      const kgToLb = (kg) => Number(kg) * 2.2046226218;
      const clamp0 = (n) => Math.max(0, Math.round(Number(n) || 0));

      // Build a reasonable training baseline if it doesn't exist
      let training = byType.training;
      if (!training) {
        const trainingCalories = calorieMode === "custom" ? Math.round(Number(customCalories) || 0) : 0;
        // Fallback if neither AI init nor custom calories produced a base
        const safeCalories = trainingCalories >= 1200 ? trainingCalories : 2500;

        const bwLb = kgToLb(startingWeightKg || 0);
        const protein = clamp0(bwLb * 1.0); // default 1.0 g/lb

        // Baseline fat, carbs fill
        const fats = clamp0(bwLb * 0.30);
        const carbs = clamp0((safeCalories - protein * 4 - fats * 9) / 4);

        training = {
          user_id: profile.user_id,
          day_type: "training",
          calories: safeCalories,
          protein_g: protein,
          fats_g: fats,
          carbs_g: carbs
        };

        await supabase
          .from("nutrition_day_targets")
          .upsert(training, { onConflict: "user_id,day_type" });
      }

      const trainingCalories = clamp0(training.calories);
      const proteinG = clamp0(training.protein_g);
      const trainingFats = clamp0(training.fats_g);
      const trainingCarbs = clamp0(training.carbs_g);

      // Rest day: -10% calories, +10% fats (carbs fill), protein same
      const restCalories = clamp0(trainingCalories * 0.90);
      let restFats = clamp0(trainingFats * 1.10);
      let restCarbs = clamp0((restCalories - proteinG * 4 - restFats * 9) / 4);

      // If carbs hit 0 because fats too high, cap fats to keep carbs >= 25g
      if (restCarbs < 25) {
        restCarbs = 25;
        const remaining = restCalories - proteinG * 4 - restCarbs * 4;
        restFats = clamp0(remaining / 9);
      }

      // High day: +5% calories, slightly lower fats, carbs fill (ensure > training carbs)
      const highCalories = clamp0(trainingCalories * 1.05);
      let highFats = clamp0(trainingFats * 0.95);
      let highCarbs = clamp0((highCalories - proteinG * 4 - highFats * 9) / 4);

      // Ensure high day carbs are meaningfully higher than training day
      if (highCarbs <= trainingCarbs) {
        highCarbs = clamp0(trainingCarbs * 1.10);
        const remaining = highCalories - proteinG * 4 - highCarbs * 4;
        highFats = clamp0(remaining / 9);
      }

      const upserts = [
        {
          user_id: profile.user_id,
          day_type: "rest",
          calories: restCalories,
          protein_g: proteinG,
          carbs_g: restCarbs,
          fats_g: restFats
        },
        {
          user_id: profile.user_id,
          day_type: "high",
          calories: highCalories,
          protein_g: proteinG,
          carbs_g: highCarbs,
          fats_g: highFats
        }
      ];

      await supabase
        .from("nutrition_day_targets")
        .upsert(upserts, { onConflict: "user_id,day_type" });
    } catch (e) {
      // Don't block onboarding if targets can't be tuned yet (schema/RLS/etc).
      console.warn("Post-init day-target tuning skipped:", e);
    }

    // Training days selected in onboarding are already persisted to profiles.training_days.
    // The Training page can build the schedule from that baseline.

    setSaving(false);
    navigate("/app/dashboard", { replace: true });
  };

  // ---- nicer centered UI styles ----

  const pageWrap = {
    width: "100vw",
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#0f0f0f",
    padding: "2.5rem"
  };

  // No container feel: no boxed card, just a centered content column
  const card = {
    width: "100%",
    maxWidth: "1100px",
    background: "transparent",
    border: "none",
    borderRadius: 0,
    boxShadow: "none",
    overflow: "visible"
  };

  const header = {
    paddingBottom: "1.5rem",
    marginBottom: "1.5rem",
    borderBottom: "1px solid #222"
  };

  const body = {
    padding: 0,
    display: "grid",
    gap: "1.5rem"
  };

  const h1 = { margin: 0, fontSize: "2.2rem", letterSpacing: "0.3px" };
  const sub = { marginTop: "0.55rem", color: "#aaa", lineHeight: 1.55, fontSize: "1.02rem" };

  const stepRow = {
    marginTop: "1rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "1rem"
  };

  const dots = { display: "flex", gap: "0.35rem", flexWrap: "wrap" };

  const dot = (active) => ({
    width: "10px",
    height: "10px",
    borderRadius: "999px",
    background: active ? "#fff" : "#3a3a3a",
    border: "1px solid #2a2a2a"
  });

  const stepText = { color: "#666", fontSize: "0.95rem" };
  const sectionTitle = { margin: 0, fontSize: "1.4rem" };

  const label = {
    display: "block",
    color: "#aaa",
    fontSize: "0.95rem",
    marginBottom: "0.35rem"
  };

  const field = {
    width: "100%",
    padding: "0.85rem",
    background: "#0f0f0f",
    color: "#fff",
    border: "1px solid #333",
    borderRadius: "12px",
    outline: "none",
    fontSize: "1rem"
  };

  const help = { color: "#666", fontSize: "0.95rem", marginTop: "0.5rem", lineHeight: 1.45 };

  const segmentedWrap = { display: "flex", gap: "0.5rem", marginTop: "0.35rem" };

  const segBtn = (active) => ({
    padding: "0.75rem 1.1rem",
    borderRadius: "12px",
    border: "1px solid #333",
    background: active ? "#2a2a2a" : "transparent",
    color: active ? "#fff" : "#aaa",
    cursor: "pointer",
    fontSize: "1rem"
  });

  const dayBtn = (active) => ({
    padding: "0.55rem 0.9rem",
    borderRadius: "999px",
    border: "1px solid #333",
    background: active ? "#2a2a2a" : "transparent",
    color: active ? "#fff" : "#aaa",
    cursor: "pointer",
    fontSize: "0.98rem"
  });

  const footer = {
    marginTop: "2rem",
    paddingTop: "1.5rem",
    borderTop: "1px solid #222",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "1rem"
  };

  const btn = (variant, disabled) => {
    const base = {
      padding: "0.85rem 1.15rem",
      borderRadius: "12px",
      border: "1px solid #333",
      cursor: disabled ? "default" : "pointer",
      opacity: disabled ? 0.6 : 1,
      fontSize: "1rem"
    };
    if (variant === "primary") return { ...base, background: "#2a2a2a", color: "#fff" };
    return { ...base, background: "transparent", color: "#fff" };
  };

  const errorBox = {
    marginTop: "1rem",
    padding: "0.9rem 1.1rem",
    borderRadius: "12px",
    border: "1px solid #3a1b1b",
    background: "rgba(255, 107, 107, 0.08)",
    color: "#ff6b6b"
  };

  const grid2 = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "0.9rem"
  };

  if (loading) {
    return (
      <div style={pageWrap}>
        <div style={card}>
          <div style={header}>
            <h1 style={h1}>Onboarding</h1>
            <div style={sub}>Loading your profile…</div>
          </div>
          <div style={body} />
        </div>
      </div>
    );
  }

  if (error && !saving && step === 1 && !profile) {
    return (
      <div style={pageWrap}>
        <div style={{ ...card, maxWidth: "640px" }}>
          <div style={header}>
            <h1 style={h1}>Onboarding</h1>
            <div style={sub}>Something went wrong.</div>
            <div style={errorBox}>{error}</div>
          </div>
          <div style={body} />
        </div>
      </div>
    );
  }

  return (
    <div style={pageWrap}>
      <div style={card}>
        <div style={header}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "1rem" }}>
            <div>
              <h1 style={h1}>Onboarding</h1>
              <div style={sub}>Set your baseline so PhysiquePilot can guide training, nutrition, steps and cardio.</div>
            </div>
            <div style={stepText}>Step {step} of 6</div>
          </div>

          <div style={stepRow}>
            <div style={dots}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={dot(i + 1 === step)} />
              ))}
            </div>
            <div style={{ color: "#666", fontSize: "0.9rem" }}>{saving ? "Saving…" : ""}</div>
          </div>

          {error && <div style={errorBox}>{error}</div>}
        </div>

        <div style={body}>
          {step === 1 && (
            <div style={{ display: "grid", gap: "1rem" }}>
              <h2 style={sectionTitle}>Body metrics</h2>

              <div>
                <div style={label}>Unit system</div>
                <div style={segmentedWrap}>
                  <button type="button" onClick={() => setUnitSystem("metric")} style={segBtn(unitSystem === "metric")}>
                    Metric
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnitSystem("imperial")}
                    style={segBtn(unitSystem === "imperial")}
                  >
                    Imperial
                  </button>
                </div>
              </div>

              <div style={grid2}>
                <div>
                  <div style={label}>Height ({unitSystem === "metric" ? "cm" : `e.g. 5'10"`})</div>
                  <input type="text" value={heightInput} onChange={(e) => setHeightInput(e.target.value)} style={field} />
                </div>

                <div>
                  <div style={label}>Starting weight ({unitSystem === "metric" ? "kg" : "lbs"})</div>
                  <input
                    type="number"
                    value={startingWeightInput}
                    onChange={(e) => setStartingWeightInput(e.target.value)}
                    style={field}
                  />
                </div>
              </div>

              <div>
                <div style={label}>Goal weight ({unitSystem === "metric" ? "kg" : "lbs"})</div>
                <input
                  type="number"
                  value={goalWeightInput}
                  onChange={(e) => setGoalWeightInput(e.target.value)}
                  style={field}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: "grid", gap: "1rem" }}>
              <h2 style={sectionTitle}>Goal & calories</h2>

              <div>
                <div style={label}>Main goal</div>
                <select value={goalType} onChange={(e) => setGoalType(e.target.value)} style={field}>
                  <option value="maintain">Maintain weight</option>
                  <option value="lose">Lose weight</option>
                  <option value="gain">Gain weight</option>
                </select>
              </div>

              {goalType !== "maintain" && (
                <div>
                  <div style={label}>Target rate per week ({unitSystem === "metric" ? "kg/week" : "lbs/week"})</div>
                  <input
                    type="number"
                    step="0.1"
                    value={weeklyChangeInput}
                    onChange={(e) => setWeeklyChangeInput(e.target.value)}
                    style={field}
                  />
                  <div style={help}>Safe defaults: cutting capped at 1kg/week, gaining capped at 0.2kg/week.</div>
                </div>
              )}

              <div>
                <div style={label}>Calories</div>
                <select value={calorieMode} onChange={(e) => setCalorieMode(e.target.value)} style={field}>
                  <option value="ai">Let PhysiquePilot calculate for me</option>
                  <option value="custom">I want to enter my own calorie target</option>
                </select>
              </div>

              {calorieMode === "custom" && (
                <div>
                  <div style={label}>Daily calorie target</div>
                  <input
                    type="number"
                    value={customCalories}
                    onChange={(e) => setCustomCalories(e.target.value)}
                    style={field}
                  />
                  <div style={help}>Minimum 1200 kcal.</div>
                </div>
              )}

              <div style={help}>The more consistent your weight logs, the better the app can guide adjustments.</div>
            </div>
          )}

          {step === 3 && (
            <div style={{ display: "grid", gap: "1rem" }}>
              <h2 style={sectionTitle}>Training setup</h2>

              <div>
                <div style={label}>Training split type</div>
                <select value={splitMode} onChange={(e) => setSplitMode(e.target.value)} style={field}>
                  <option value="fixed">Weekly (fixed days)</option>
                  <option value="rolling">Rolling (cycle repeats)</option>
                </select>
              </div>

              {splitMode === "fixed" && (
                <div>
                  <div style={label}>Which days do you usually train?</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.5rem" }}>
                    {daysOfWeek.map((d) => (
                      <button key={d} type="button" onClick={() => toggleTrainingDay(d)} style={dayBtn(trainingDaysSelected.includes(d))}>
                        {d}
                      </button>
                    ))}
                  </div>
                  <div style={help}>You can refine the split inside Training later.</div>
                </div>
              )}

              {splitMode === "rolling" && (
                <div style={{ display: "grid", gap: "0.75rem" }}>
                  <div>
                    <div style={label}>How many days per week do you want to train?</div>
                    <select value={trainingFrequencyRange} onChange={(e) => setTrainingFrequencyRange(e.target.value)} style={field}>
                      <option value="1-2">1–2 days</option>
                      <option value="2-4">2–4 days</option>
                      <option value="5-6">5–6 days</option>
                      <option value="7">7 days</option>
                    </select>
                  </div>

                  <div>
                    <div style={label}>When did you start your current training block?</div>
                    <input type="date" value={rollingStartDate} onChange={(e) => setRollingStartDate(e.target.value)} style={field} />
                  </div>

                  <div style={help}>You’ll set the exact rolling split pattern (e.g. 8-day cycle) in the Training section.</div>
                </div>
              )}

              <div style={grid2}>
                <div>
                  <div style={label}>Experience level</div>
                  <select value={experienceLevel} onChange={(e) => setExperienceLevel(e.target.value)} style={field}>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>

                <div>
                  <div style={label}>Gym type</div>
                  <select value={gymType} onChange={(e) => setGymType(e.target.value)} style={field}>
                    <option value="home">Home gym</option>
                    <option value="commercial">Commercial gym</option>
                    <option value="independent">Independent gym</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <div style={label}>Gym chain or name (optional)</div>
                <input type="text" value={gymChain} onChange={(e) => setGymChain(e.target.value)} style={field} placeholder="PureGym, JD, The Gym Group, etc." />
              </div>
            </div>
          )}

          {step === 4 && (
            <div style={{ display: "grid", gap: "1rem" }}>
              <h2 style={sectionTitle}>Activity baseline</h2>

              <div>
                <div style={label}>Lifestyle (excluding weight training)</div>
                <select value={activityLevel} onChange={(e) => setActivityLevel(e.target.value)} style={field}>
                  <option value="inactive">Inactive</option>
                  <option value="light">Lightly active</option>
                  <option value="moderate">Moderately active</option>
                  <option value="heavy">Highly active</option>
                  <option value="extreme">Extreme</option>
                </select>
                <div style={help}>This is used as your baseline for steps/cardio planning later.</div>
              </div>

              <div style={grid2}>
                <div>
                  <div style={label}>Average steps per day (optional)</div>
                  <input
                    type="number"
                    min="0"
                    value={baselineStepsInput}
                    onChange={(e) => setBaselineStepsInput(e.target.value)}
                    style={field}
                    placeholder="e.g. 8000"
                  />
                </div>

                <div>
                  <div style={label}>Cardio minutes per week (optional)</div>
                  <input
                    type="number"
                    min="0"
                    value={baselineCardioMinutesInput}
                    onChange={(e) => setBaselineCardioMinutesInput(e.target.value)}
                    style={field}
                    placeholder="e.g. 60"
                  />
                </div>
              </div>

              <div>
                <div style={label}>Typical cardio heart rate (optional)</div>
                <input
                  type="number"
                  min="0"
                  value={baselineCardioHrInput}
                  onChange={(e) => setBaselineCardioHrInput(e.target.value)}
                  style={field}
                  placeholder="e.g. 120"
                />
                <div style={help}>We’ll encourage LISS later (incline walk, stairmaster), but for now we just record baseline.</div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div style={{ display: "grid", gap: "1rem" }}>
              <h2 style={sectionTitle}>Nutrition preferences</h2>

              <div>
                <div style={label}>Dietary preference</div>
                <select value={dietaryPreference} onChange={(e) => setDietaryPreference(e.target.value)} style={field}>
                  <option value="omnivore">Omnivore</option>
                  <option value="vegetarian">Vegetarian</option>
                  <option value="vegan">Vegan</option>
                  <option value="pescatarian">Pescatarian</option>
                  <option value="halal">Halal</option>
                  <option value="gluten_free">Gluten free</option>
                  <option value="lactose_free">Lactose free</option>
                </select>
              </div>

              <div>
                <div style={label}>Additional dietary notes</div>
                <textarea
                  value={dietaryAdditional}
                  onChange={(e) => setDietaryAdditional(e.target.value)}
                  style={{ ...field, minHeight: "110px" }}
                  placeholder="Any extra preferences you want the app to consider."
                />
              </div>

              <div>
                <div style={label}>Food dislikes</div>
                <textarea
                  value={dislikes}
                  onChange={(e) => setDislikes(e.target.value)}
                  style={{ ...field, minHeight: "110px" }}
                  placeholder="Foods you strongly prefer to avoid."
                />
              </div>
            </div>
          )}

          {step === 6 && (
            <div style={{ display: "grid", gap: "1rem" }}>
              <h2 style={sectionTitle}>Safety</h2>

              <div>
                <div style={label}>Food allergies</div>
                <textarea
                  value={foodAllergies}
                  onChange={(e) => setFoodAllergies(e.target.value)}
                  style={{ ...field, minHeight: "110px" }}
                  placeholder="List any food allergies."
                />
              </div>

              <div style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start" }}>
                <input
                  type="checkbox"
                  checked={disclaimerAccepted}
                  onChange={(e) => setDisclaimerAccepted(e.target.checked)}
                  style={{ marginTop: "0.15rem" }}
                />
                <div style={{ color: "#aaa", lineHeight: 1.35 }}>
                  I confirm I am healthy enough for exercise and nutrition changes and understand this is not medical advice or an emergency service.
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={footer}>
          <div style={{ color: "#666", fontSize: "0.9rem" }}>{step === 1 ? "" : "You can change these later in Settings."}</div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            {step > 1 && (
              <button onClick={prevStep} disabled={saving} style={btn("secondary", saving)}>
                Back
              </button>
            )}

            {step < 6 && (
              <button onClick={nextStep} disabled={saving} style={btn("primary", saving)}>
                Next
              </button>
            )}

            {step === 6 && (
              <button onClick={handleSubmit} disabled={saving} style={btn("primary", saving)}>
                {saving ? "Saving…" : "Finish"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Onboarding;