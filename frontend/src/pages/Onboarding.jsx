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
      if (existingProfile.baseline_cardio_minutes_per_week !== null && existingProfile.baseline_cardio_minutes_per_week !== undefined) {
        setBaselineCardioMinutesInput(String(existingProfile.baseline_cardio_minutes_per_week));
      }
      if (existingProfile.baseline_cardio_avg_hr !== null && existingProfile.baseline_cardio_avg_hr !== undefined) {
        setBaselineCardioHrInput(String(existingProfile.baseline_cardio_avg_hr));
      }

      setLoading(false);
    };

    loadProfile();
  }, [navigate]);

  const nextStep = () => setStep((s) => Math.min(s + 1, 6));
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  const toggleTrainingDay = (day) => {
    setTrainingDaysSelected((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
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

  const parseOptionalFloat = (v) => {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    if (!s) return null;
    const n = Number(s);
    if (!Number.isFinite(n) || n < 0) return null;
    return n;
  };

  const handleSubmit = async () => {
    if (!profile) return;

    if (!disclaimerAccepted) {
      setError("You must confirm the disclaimer to continue.");
      return;
    }

    setSaving(true);
    setError("");

    const heightCm = parseHeightToCm();
    const startingWeightKg = parseWeightToKg(startingWeightInput);
    const goalWeightKg = parseWeightToKg(goalWeightInput);
    const weeklyChangeKgRaw = parseWeeklyChangeToKg();
    const weeklyChangeKg = safeWeeklyChangeKg(goalType, weeklyChangeKgRaw);

    if (!heightCm || !startingWeightKg || !goalWeightKg) {
      setSaving(false);
      setError("Please fill in height, starting weight, and goal weight.");
      return;
    }

    if ((goalType === "lose" || goalType === "gain") && !weeklyChangeKg) {
      setSaving(false);
      setError("Please choose a weekly rate of change.");
      return;
    }

    if (splitMode === "fixed" && trainingDaysSelected.length === 0) {
      setSaving(false);
      setError("Please select at least one training day.");
      return;
    }

    if (splitMode === "rolling") {
      const d = rollingStartDate || new Date().toISOString().slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
        setSaving(false);
        setError("Please choose a valid rolling split start date.");
        return;
      }
    }

    if (calorieMode === "custom") {
      const cc = Number(customCalories);
      if (!Number.isFinite(cc) || cc < 1200) {
        setSaving(false);
        setError("Custom calories must be at least 1200.");
        return;
      }
    }

    const baselineSteps = parseOptionalInt(baselineStepsInput);
    const baselineCardioMinutes = parseOptionalInt(baselineCardioMinutesInput);
    const baselineCardioHr = parseOptionalInt(baselineCardioHrInput);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        unit_system: unitSystem,
        height_cm: heightCm,
        starting_weight_kg: startingWeightKg,
        current_weight_kg: startingWeightKg,
        goal_weight_kg: goalWeightKg,
        goal_type: goalType,
        weekly_weight_change_target_kg: goalType === "maintain" ? null : weeklyChangeKg,
        split_mode: splitMode,
        training_frequency_range: splitMode === "rolling" ? trainingFrequencyRange : null,
        rolling_start_date: splitMode === "rolling" ? (rollingStartDate || new Date().toISOString().slice(0, 10)) : null,
        training_days: splitMode === "fixed" ? trainingDaysSelected : null,
        training_days_per_week: splitMode === "fixed" ? trainingDaysSelected.length : null,
        experience_level: experienceLevel,
        gym_type: gymType,
        gym_chain: gymChain,
        activity_level: activityLevel,
        baseline_steps_per_day: baselineSteps,
        baseline_cardio_minutes_per_week: baselineCardioMinutes,
        baseline_cardio_avg_hr: baselineCardioHr,
        dietary_preference: dietaryPreference,
        dietary_additional: dietaryAdditional,
        food_allergies: foodAllergies,
        dislikes,
        calorie_mode: calorieMode,
        custom_calories: calorieMode === "custom" ? Number(customCalories) || null : null,
        onboarding_complete: true
      })
      .eq("user_id", profile.user_id);

    if (updateError) {
      setSaving(false);
      setError(updateError.message);
      return;
    }

    const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

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

    setSaving(false);
    navigate("/app/dashboard");
  };

  if (loading) {
    return (
      <div style={{ padding: "2rem" }}>
        <h1>Onboarding</h1>
        <p>Loading...</p>
      </div>
    );
  }

  if (error && !saving && step === 1 && !profile) {
    return (
      <div style={{ padding: "2rem" }}>
        <h1>Onboarding</h1>
        <p style={{ color: "red" }}>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", maxWidth: "600px" }}>
      <h1>Onboarding</h1>
      <p>Step {step} of 6</p>

      {step === 1 && (
        <div style={{ marginTop: "1rem" }}>
          <h2>Body metrics</h2>

          <label>Unit system</label>
          <div style={{ marginBottom: "1rem", marginTop: "0.25rem" }}>
            <button
              type="button"
              onClick={() => setUnitSystem("metric")}
              style={{
                marginRight: "0.5rem",
                padding: "0.25rem 0.75rem",
                background: unitSystem === "metric" ? "#ddd" : "transparent"
              }}
            >
              Metric
            </button>
            <button
              type="button"
              onClick={() => setUnitSystem("imperial")}
              style={{
                padding: "0.25rem 0.75rem",
                background: unitSystem === "imperial" ? "#ddd" : "transparent"
              }}
            >
              Imperial
            </button>
          </div>

          <label>Height ({unitSystem === "metric" ? "cm" : `e.g. 5'10"`})</label>
          <input
            type="text"
            value={heightInput}
            onChange={(e) => setHeightInput(e.target.value)}
            style={{ width: "100%", marginBottom: "1rem" }}
          />

          <label>Starting weight ({unitSystem === "metric" ? "kg" : "lbs"})</label>
          <input
            type="number"
            value={startingWeightInput}
            onChange={(e) => setStartingWeightInput(e.target.value)}
            style={{ width: "100%", marginBottom: "1rem" }}
          />

          <label>Goal weight ({unitSystem === "metric" ? "kg" : "lbs"})</label>
          <input
            type="number"
            value={goalWeightInput}
            onChange={(e) => setGoalWeightInput(e.target.value)}
            style={{ width: "100%", marginBottom: "1rem" }}
          />
        </div>
      )}

      {step === 2 && (
        <div style={{ marginTop: "1rem" }}>
          <h2>Goal and rate of change</h2>

          <label>Main goal</label>
          <select
            value={goalType}
            onChange={(e) => setGoalType(e.target.value)}
            style={{ width: "100%", marginBottom: "1rem" }}
          >
            <option value="maintain">Maintain weight</option>
            <option value="lose">Lose weight</option>
            <option value="gain">Gain weight</option>
          </select>

          {goalType !== "maintain" && (
            <>
              <label>Target rate per week ({unitSystem === "metric" ? "kg/week" : "lbs/week"})</label>
              <input
                type="number"
                step="0.1"
                value={weeklyChangeInput}
                onChange={(e) => setWeeklyChangeInput(e.target.value)}
                style={{ width: "100%", marginBottom: "0.25rem" }}
              />
              <p style={{ fontSize: "0.9rem", color: "#555", marginBottom: "1rem" }}>
                Safe defaults: cutting capped at 1kg/week, gaining capped at 0.2kg/week.
              </p>
            </>
          )}

          <label>Calories</label>
          <select
            value={calorieMode}
            onChange={(e) => setCalorieMode(e.target.value)}
            style={{ width: "100%", marginBottom: "1rem" }}
          >
            <option value="ai">Let PhysiquePilot calculate for me</option>
            <option value="custom">I want to enter my own calorie target</option>
          </select>

          {calorieMode === "custom" && (
            <>
              <label>Daily calorie target</label>
              <input
                type="number"
                value={customCalories}
                onChange={(e) => setCustomCalories(e.target.value)}
                style={{ width: "100%", marginBottom: "1rem" }}
              />
            </>
          )}

          <p style={{ fontSize: "0.9rem", color: "#555" }}>
            The more consistent your weight logs, the better the app can guide adjustments.
          </p>
        </div>
      )}

      {step === 3 && (
        <div style={{ marginTop: "1rem" }}>
          <h2>Training setup</h2>

          <label>Training split type</label>
          <select
            value={splitMode}
            onChange={(e) => setSplitMode(e.target.value)}
            style={{ width: "100%", marginBottom: "1rem" }}
          >
            <option value="fixed">Weekly (fixed days)</option>
            <option value="rolling">Rolling (cycle repeats)</option>
          </select>

          {splitMode === "fixed" && (
            <>
              <label>Which days do you usually train?</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", margin: "0.5rem 0 1rem" }}>
                {daysOfWeek.map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleTrainingDay(day)}
                    style={{
                      padding: "0.25rem 0.7rem",
                      background: trainingDaysSelected.includes(day) ? "#ddd" : "transparent",
                      border: "1px solid #ccc"
                    }}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </>
          )}

          {splitMode === "rolling" && (
            <>
              <label>How many days per week do you want to train?</label>
              <select
                value={trainingFrequencyRange}
                onChange={(e) => setTrainingFrequencyRange(e.target.value)}
                style={{ width: "100%", marginBottom: "1rem" }}
              >
                <option value="1-2">1–2 days</option>
                <option value="2-4">2–4 days</option>
                <option value="5-6">5–6 days</option>
                <option value="7">7 days</option>
              </select>

              <label>When did you start your current training block?</label>
              <input
                type="date"
                value={rollingStartDate}
                onChange={(e) => setRollingStartDate(e.target.value)}
                style={{ width: "100%", marginBottom: "0.75rem" }}
              />

              <div style={{ color: "#555", fontSize: "0.9rem", marginBottom: "1rem" }}>
                You’ll set the exact rolling split pattern (e.g. 8-day cycle) in the Training section.
              </div>
            </>
          )}

          <label>Experience level</label>
          <select
            value={experienceLevel}
            onChange={(e) => setExperienceLevel(e.target.value)}
            style={{ width: "100%", marginBottom: "1rem" }}
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>

          <label>Gym type</label>
          <select
            value={gymType}
            onChange={(e) => setGymType(e.target.value)}
            style={{ width: "100%", marginBottom: "1rem" }}
          >
            <option value="home">Home gym</option>
            <option value="commercial">Commercial gym</option>
            <option value="independent">Independent gym</option>
            <option value="other">Other</option>
          </select>

          <label>Gym chain or name (optional)</label>
          <input
            type="text"
            value={gymChain}
            onChange={(e) => setGymChain(e.target.value)}
            style={{ width: "100%", marginBottom: "1rem" }}
            placeholder="PureGym, JD, The Gym Group, etc."
          />
        </div>
      )}

      {step === 4 && (
        <div style={{ marginTop: "1rem" }}>
          <h2>Activity (steps & cardio)</h2>

          <label>Day-to-day activity level (excluding weight training)</label>
          <select
            value={activityLevel}
            onChange={(e) => setActivityLevel(e.target.value)}
            style={{ width: "100%", marginBottom: "1rem" }}
          >
            <option value="inactive">Inactive</option>
            <option value="light">Lightly active</option>
            <option value="moderate">Moderately active</option>
            <option value="heavy">Highly active</option>
            <option value="extreme">Extreme</option>
          </select>

          <label>Average steps per day (optional)</label>
          <input
            type="number"
            min="0"
            value={baselineStepsInput}
            onChange={(e) => setBaselineStepsInput(e.target.value)}
            style={{ width: "100%", marginBottom: "0.75rem" }}
            placeholder="e.g. 8000"
          />

          <div style={{ color: "#555", fontSize: "0.9rem", marginBottom: "1rem" }}>
            This helps the app set a sensible starting point. You’ll be able to track daily steps in the Steps page.
          </div>

          <label>Current cardio minutes per week (optional)</label>
          <input
            type="number"
            min="0"
            value={baselineCardioMinutesInput}
            onChange={(e) => setBaselineCardioMinutesInput(e.target.value)}
            style={{ width: "100%", marginBottom: "0.75rem" }}
            placeholder="e.g. 60"
          />

          <label>Typical cardio heart rate (optional)</label>
          <input
            type="number"
            min="0"
            value={baselineCardioHrInput}
            onChange={(e) => setBaselineCardioHrInput(e.target.value)}
            style={{ width: "100%", marginBottom: "0.75rem" }}
            placeholder="e.g. 120"
          />

          <div style={{ color: "#555", fontSize: "0.9rem" }}>
            We won’t prescribe cardio here. This is just baseline info so the training plan can be adjusted intelligently later.
          </div>
        </div>
      )}

      {step === 5 && (
        <div style={{ marginTop: "1rem" }}>
          <h2>Nutrition preferences</h2>

          <label>Dietary preference</label>
          <select
            value={dietaryPreference}
            onChange={(e) => setDietaryPreference(e.target.value)}
            style={{ width: "100%", marginBottom: "1rem" }}
          >
            <option value="omnivore">Omnivore</option>
            <option value="vegetarian">Vegetarian</option>
            <option value="vegan">Vegan</option>
            <option value="pescatarian">Pescatarian</option>
            <option value="halal">Halal</option>
            <option value="gluten_free">Gluten free</option>
            <option value="lactose_free">Lactose free</option>
          </select>

          <label>Additional dietary notes</label>
          <textarea
            value={dietaryAdditional}
            onChange={(e) => setDietaryAdditional(e.target.value)}
            style={{ width: "100%", marginBottom: "1rem", minHeight: "70px" }}
            placeholder="Any extra preferences you want the app to consider."
          />

          <label>Food dislikes</label>
          <textarea
            value={dislikes}
            onChange={(e) => setDislikes(e.target.value)}
            style={{ width: "100%", marginBottom: "1rem", minHeight: "70px" }}
            placeholder="Foods you strongly prefer to avoid."
          />
        </div>
      )}

      {step === 6 && (
        <div style={{ marginTop: "1rem" }}>
          <h2>Safety and preferences</h2>

          <label>Food allergies</label>
          <textarea
            value={foodAllergies}
            onChange={(e) => setFoodAllergies(e.target.value)}
            style={{ width: "100%", marginBottom: "1rem", minHeight: "60px" }}
            placeholder="List any food allergies."
          />

          <div style={{ marginTop: "0.5rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                type="checkbox"
                checked={disclaimerAccepted}
                onChange={(e) => setDisclaimerAccepted(e.target.checked)}
              />
              <span>
                I confirm I am healthy enough for exercise and nutrition changes and understand this is not medical advice or an emergency service.
              </span>
            </label>
          </div>
        </div>
      )}

      {error && <p style={{ color: "red", marginTop: "1rem" }}>{error}</p>}

      <div style={{ marginTop: "1.5rem", display: "flex", gap: "0.5rem" }}>
        {step > 1 && (
          <button onClick={prevStep} disabled={saving}>
            Back
          </button>
        )}
        {step < 6 && (
          <button onClick={nextStep} disabled={saving}>
            Next
          </button>
        )}
        {step === 6 && (
          <button onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving..." : "Finish"}
          </button>
        )}
      </div>
    </div>
  );
}

export default Onboarding;