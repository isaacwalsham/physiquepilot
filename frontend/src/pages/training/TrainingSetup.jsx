import { useState } from "react";
import { supabase } from "../../supabaseClient";
import {
  SPLIT_TEMPLATES, DAY_KEYS, DAY_SHORT,
  suggestTrainingDays, autoAssignExercises,
  MUSCLE_COLORS, MUSCLE_DISPLAY, formatLocalDate,
} from "./trainingUtils";

const STYLES = `
.ts-shell {
  max-width: 680px;
  margin: 0 auto;
  padding: 2rem 1rem 4rem;
  font-family: var(--font-body);
  color: var(--text-1);
}

.ts-progress {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 2.5rem;
}
.ts-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--line-2);
  transition: background var(--motion-med);
}
.ts-dot.active {
  background: var(--accent-3);
}

.ts-step {
  animation: ts-fadein var(--motion-med) ease;
}
@keyframes ts-fadein {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

.ts-title {
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-1);
  margin: 0 0 1.75rem;
}

/* ── Step 0: experience cards ─────────────────────────── */
.ts-exp-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 2rem;
}
.ts-exp-card {
  background: var(--surface-3);
  border: 1.5px solid var(--line-1);
  border-radius: var(--radius-md);
  padding: 1rem 1.25rem;
  cursor: pointer;
  transition: border-color var(--motion-fast), background var(--motion-fast);
}
.ts-exp-card:hover {
  border-color: var(--line-2);
}
.ts-exp-card.selected {
  border-color: var(--accent-2);
  background: rgba(181,21,60,0.1);
}
.ts-exp-label {
  font-family: var(--font-display);
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-1);
  margin-bottom: 3px;
}
.ts-exp-desc {
  font-size: 0.85rem;
  color: var(--text-3);
}

/* ── Step 1: split template cards ─────────────────────── */
.ts-template-grid {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 2rem;
}
.ts-template-card {
  position: relative;
  background: var(--surface-3);
  border: 1.5px solid var(--line-1);
  border-radius: var(--radius-md);
  padding: 1.1rem 1.25rem 1rem;
  cursor: pointer;
  transition: border-color var(--motion-fast), background var(--motion-fast);
}
.ts-template-card:hover {
  border-color: var(--line-2);
}
.ts-template-card.selected {
  border-color: var(--accent-2);
  background: rgba(181,21,60,0.08);
}
.ts-badge-rec {
  position: absolute;
  top: 10px;
  right: 12px;
  background: var(--accent-1);
  color: var(--text-1);
  font-family: var(--font-display);
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 2px 7px;
  border-radius: 4px;
}
.ts-template-name {
  font-family: var(--font-display);
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--text-1);
  margin-bottom: 4px;
  padding-right: 90px;
}
.ts-template-meta {
  font-size: 0.78rem;
  color: var(--text-3);
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.ts-template-desc {
  font-size: 0.85rem;
  color: var(--text-2);
  margin-bottom: 6px;
  line-height: 1.5;
}
.ts-template-who {
  font-size: 0.78rem;
  color: var(--text-3);
  font-style: italic;
  margin-bottom: 10px;
  line-height: 1.4;
}
.ts-day-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.ts-day-pill {
  font-size: 0.72rem;
  font-family: var(--font-display);
  padding: 2px 8px;
  border-radius: 20px;
  color: #fff;
  opacity: 0.9;
  white-space: nowrap;
}

/* ── Step 2: schedule ──────────────────────────────────── */
.ts-schedule-tabs {
  display: flex;
  gap: 0;
  border-bottom: 1.5px solid var(--line-1);
  margin-bottom: 1.5rem;
}
.ts-tab {
  padding: 0.55rem 1.1rem;
  font-size: 0.88rem;
  color: var(--text-3);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1.5px;
  cursor: pointer;
  font-family: var(--font-body);
  transition: color var(--motion-fast), border-color var(--motion-fast);
}
.ts-tab.active {
  color: var(--text-1);
  border-bottom-color: var(--accent-3);
}
.ts-tab:hover:not(.active) {
  color: var(--text-2);
}

.ts-days-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
  margin-bottom: 1rem;
}
.ts-day-btn {
  padding: 0.55rem 0.25rem;
  text-align: center;
  font-size: 0.8rem;
  font-family: var(--font-display);
  color: var(--text-3);
  background: var(--surface-3);
  border: 1.5px solid var(--line-1);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--motion-fast);
  user-select: none;
}
.ts-day-btn:hover {
  border-color: var(--line-2);
  color: var(--text-2);
}
.ts-day-btn.selected {
  background: rgba(222,41,82,0.15);
  border-color: var(--accent-2);
  color: var(--text-1);
}

.ts-choose-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.82rem;
  font-family: var(--font-body);
  color: var(--accent-3);
  background: transparent;
  border: 1px solid var(--accent-2);
  border-radius: var(--radius-sm);
  padding: 0.4rem 0.9rem;
  cursor: pointer;
  transition: background var(--motion-fast), color var(--motion-fast);
  margin-bottom: 1.5rem;
}
.ts-choose-btn:hover {
  background: rgba(222,41,82,0.1);
}

.ts-rolling-note {
  font-size: 0.85rem;
  color: var(--text-3);
  background: var(--surface-3);
  border: 1px solid var(--line-1);
  border-radius: var(--radius-sm);
  padding: 0.75rem 1rem;
  margin-bottom: 1.5rem;
  line-height: 1.5;
}

.ts-start-date {
  margin-bottom: 2rem;
}
.ts-label {
  display: block;
  font-size: 0.8rem;
  color: var(--text-3);
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.ts-date-input {
  background: var(--surface-3);
  border: 1.5px solid var(--line-1);
  border-radius: var(--radius-sm);
  color: var(--text-1);
  font-family: var(--font-body);
  font-size: 0.9rem;
  padding: 0.5rem 0.75rem;
  width: 180px;
  cursor: pointer;
  color-scheme: dark;
}
.ts-date-input:focus {
  outline: none;
  border-color: var(--accent-2);
}

/* ── nav / buttons ─────────────────────────────────────── */
.ts-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0.5rem;
}
.ts-btn {
  font-family: var(--font-body);
  font-size: 0.9rem;
  border-radius: var(--radius-sm);
  padding: 0.55rem 1.25rem;
  cursor: pointer;
  border: none;
  transition: opacity var(--motion-fast), background var(--motion-fast);
}
.ts-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.ts-btn-ghost {
  background: transparent;
  color: var(--text-3);
  border: 1.5px solid var(--line-2);
}
.ts-btn-ghost:hover:not(:disabled) {
  color: var(--text-2);
  border-color: var(--text-3);
}
.ts-btn-primary {
  background: var(--accent-2);
  color: var(--text-1);
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.ts-btn-primary:hover:not(:disabled) {
  background: var(--accent-3);
}

.ts-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(247,237,240,0.3);
  border-top-color: var(--text-1);
  border-radius: 50%;
  animation: ts-spin 0.7s linear infinite;
  flex-shrink: 0;
}
@keyframes ts-spin {
  to { transform: rotate(360deg); }
}

.ts-error {
  background: rgba(139,15,46,0.18);
  border: 1px solid var(--accent-1);
  border-radius: var(--radius-sm);
  color: var(--accent-3);
  font-size: 0.85rem;
  padding: 0.65rem 1rem;
  margin-top: 1rem;
  line-height: 1.5;
}
`;

export default function TrainingSetup({ profile, onComplete }) {
  const [step, setStep] = useState(0);

  // Step 0
  const [experience, setExperience] = useState(
    profile?.training_experience || "beginner"
  );

  // Step 1
  const templates = SPLIT_TEMPLATES[experience] || [];
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);

  // Step 2
  const [scheduleMode, setScheduleMode] = useState("fixed");
  const [selectedDays, setSelectedDays] = useState([]);
  const [startDate, setStartDate] = useState(formatLocalDate(new Date()));

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Resolve the actual selected template object
  const activeTemplates = SPLIT_TEMPLATES[experience] || [];
  const selectedTemplate =
    activeTemplates.find((t) => t.id === selectedTemplateId) || null;

  // ── navigation helpers ───────────────────────────────────────────────────

  function handleNextFromStep0() {
    // Reset template selection when experience changes
    setSelectedTemplateId(null);
    setStep(1);
  }

  function handleNextFromStep1() {
    if (!selectedTemplate) return;
    // Pre-populate suggested days
    if (selectedTemplate.days_per_week) {
      setSelectedDays(suggestTrainingDays(selectedTemplate.days_per_week));
    }
    setStep(2);
  }

  function toggleDay(key) {
    setSelectedDays((prev) =>
      prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key]
    );
  }

  function handleChooseForMe() {
    if (selectedTemplate?.days_per_week) {
      setSelectedDays(suggestTrainingDays(selectedTemplate.days_per_week));
    }
  }

  // ── create program ───────────────────────────────────────────────────────

  async function handleCreate() {
    if (!selectedTemplate) return;
    setSaving(true);
    setError(null);

    try {
      // 1. Get current user
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) throw new Error("Not authenticated");

      // 2. Update experience on profile
      await supabase
        .from("profiles")
        .update({ training_experience: experience })
        .eq("user_id", user.id);

      // 3. Deactivate existing programs
      await supabase
        .from("training_programs")
        .update({ is_active: false })
        .eq("user_id", user.id)
        .eq("is_active", true);

      // 4. Insert new program
      const { data: progRows, error: progErr } = await supabase
        .from("training_programs")
        .insert({
          user_id: user.id,
          name: selectedTemplate.name,
          split_type: selectedTemplate.type,
          is_active: true,
          start_date: startDate,
          training_days: scheduleMode === "fixed" ? selectedDays : [],
          experience_level: experience,
        })
        .select();
      if (progErr) throw new Error(progErr.message);
      const prog = progRows[0];

      // 5. Insert program days
      const dayInserts = selectedTemplate.days.map((d, i) => ({
        program_id: prog.id,
        day_name: d.name,
        day_order: i,
        is_rest: false,
        muscle_focus: d.muscle_focus,
        color: d.color,
      }));
      const { data: insertedDays, error: daysErr } = await supabase
        .from("training_program_days")
        .insert(dayInserts)
        .select();
      if (daysErr) throw new Error(daysErr.message);

      // 6. Fetch exercises
      const { data: rawExercises, error: exErr } = await supabase
        .from("exercises")
        .select("id, name, is_compound, difficulty, primary_group_id, exercise_muscle_groups(name)")
        .eq("is_global", true);
      if (exErr) throw new Error(exErr.message);
      const allExercises = rawExercises.map((e) => ({
        ...e,
        primary_group_name: e.exercise_muscle_groups?.name ?? "",
      }));

      // 7. Auto-assign exercises for each day
      const exerciseInserts = [];
      for (let i = 0; i < insertedDays.length; i++) {
        const templateDay = selectedTemplate.days[i];
        const programDayId = insertedDays[i].id;
        const assignments = autoAssignExercises(
          templateDay.muscle_focus,
          experience,
          allExercises
        );
        for (const a of assignments) {
          exerciseInserts.push({ ...a, program_day_id: programDayId });
        }
      }

      // 8. Batch insert exercises (only if any)
      if (exerciseInserts.length > 0) {
        const { error: exInsertErr } = await supabase
          .from("program_day_exercises")
          .insert(exerciseInserts);
        if (exInsertErr) throw new Error(exInsertErr.message);
      }

      // 9. Done
      onComplete();
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
      setSaving(false);
    }
  }

  // ── render helpers ───────────────────────────────────────────────────────

  function ProgressDots() {
    return (
      <div className="ts-progress">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`ts-dot${step === i ? " active" : ""}`} />
        ))}
      </div>
    );
  }

  // ── Step 0 ───────────────────────────────────────────────────────────────

  function renderStep0() {
    const levels = [
      {
        id: "beginner",
        label: "Beginner",
        desc: "New to structured weight training",
      },
      {
        id: "intermediate",
        label: "Intermediate",
        desc: "1–3 years of consistent training",
      },
      {
        id: "advanced",
        label: "Advanced",
        desc: "3+ years, solid technique & periodisation",
      },
    ];
    return (
      <div className="ts-step">
        <h2 className="ts-title">What's your training experience?</h2>
        <div className="ts-exp-grid">
          {levels.map((lv) => (
            <div
              key={lv.id}
              className={`ts-exp-card${experience === lv.id ? " selected" : ""}`}
              onClick={() => setExperience(lv.id)}
            >
              <div className="ts-exp-label">{lv.label}</div>
              <div className="ts-exp-desc">{lv.desc}</div>
            </div>
          ))}
        </div>
        <div className="ts-nav" style={{ justifyContent: "flex-end" }}>
          <button className="ts-btn ts-btn-primary" onClick={handleNextFromStep0}>
            Continue →
          </button>
        </div>
      </div>
    );
  }

  // ── Step 1 ───────────────────────────────────────────────────────────────

  function renderStep1() {
    const tmpl = SPLIT_TEMPLATES[experience] || [];
    return (
      <div className="ts-step">
        <h2 className="ts-title">Choose your training split</h2>
        <div className="ts-template-grid">
          {tmpl.map((t) => (
            <div
              key={t.id}
              className={`ts-template-card${selectedTemplateId === t.id ? " selected" : ""}`}
              onClick={() => setSelectedTemplateId(t.id)}
            >
              {t.recommended && (
                <span className="ts-badge-rec">RECOMMENDED</span>
              )}
              <div className="ts-template-name">{t.name}</div>
              <div className="ts-template-meta">
                {t.days_per_week != null ? `${t.days_per_week} days` : "Custom"}{" "}
                · {t.type.replace(/_/g, " ")}
              </div>
              <div className="ts-template-desc">{t.description}</div>
              <div className="ts-template-who">{t.who}</div>
              {t.days.length > 0 && (
                <div className="ts-day-pills">
                  {t.days.map((d, i) => (
                    <span
                      key={i}
                      className="ts-day-pill"
                      style={{ background: d.color }}
                    >
                      {d.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="ts-nav">
          <button
            className="ts-btn ts-btn-ghost"
            onClick={() => setStep(0)}
          >
            ← Back
          </button>
          <button
            className="ts-btn ts-btn-primary"
            disabled={!selectedTemplateId}
            onClick={handleNextFromStep1}
          >
            Continue →
          </button>
        </div>
      </div>
    );
  }

  // ── Step 2 ───────────────────────────────────────────────────────────────

  function renderStep2() {
    return (
      <div className="ts-step">
        <h2 className="ts-title">When do you train?</h2>

        {/* Tabs */}
        <div className="ts-schedule-tabs">
          <button
            className={`ts-tab${scheduleMode === "fixed" ? " active" : ""}`}
            onClick={() => setScheduleMode("fixed")}
          >
            Fixed days
          </button>
          <button
            className={`ts-tab${scheduleMode === "rolling" ? " active" : ""}`}
            onClick={() => setScheduleMode("rolling")}
          >
            Rolling split
          </button>
        </div>

        {scheduleMode === "fixed" ? (
          <>
            <div className="ts-days-grid">
              {DAY_KEYS.map((key, i) => (
                <button
                  key={key}
                  className={`ts-day-btn${selectedDays.includes(key) ? " selected" : ""}`}
                  onClick={() => toggleDay(key)}
                >
                  {DAY_SHORT[i]}
                </button>
              ))}
            </div>
            <button className="ts-choose-btn" onClick={handleChooseForMe}>
              <span>✦</span>
              Choose for me
            </button>
          </>
        ) : (
          <div className="ts-rolling-note">
            Your split cycles automatically regardless of which day you start.
            Each session follows the next in sequence — no fixed weekly pattern
            needed.
          </div>
        )}

        {/* Start date — shown in both modes */}
        <div className="ts-start-date">
          <label className="ts-label">Program start date</label>
          <input
            type="date"
            className="ts-date-input"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        {error && <div className="ts-error">{error}</div>}

        <div className="ts-nav">
          <button
            className="ts-btn ts-btn-ghost"
            onClick={() => setStep(1)}
            disabled={saving}
          >
            ← Back
          </button>
          <button
            className="ts-btn ts-btn-primary"
            disabled={
              saving ||
              !selectedTemplate ||
              (scheduleMode === "fixed" && selectedDays.length === 0)
            }
            onClick={handleCreate}
          >
            {saving && <span className="ts-spinner" />}
            {saving ? "Building…" : "Build My Program →"}
          </button>
        </div>
      </div>
    );
  }

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <>
      <style>{STYLES}</style>
      <div className="ts-shell">
        <ProgressDots />
        {step === 0 && renderStep0()}
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
      </div>
    </>
  );
}
