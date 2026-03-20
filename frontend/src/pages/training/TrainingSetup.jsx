import { useState } from "react";
import { supabase } from "../../supabaseClient";
import {
  ORDERED_SPLITS, DAY_KEYS, DAY_SHORT,
  suggestTrainingDays, autoAssignExercises,
  MUSCLE_COLORS, MUSCLE_DISPLAY, formatLocalDate,
  hasConsecutiveTriple,
} from "./trainingUtils";

// Experience level mapping for each split
const SPLIT_LEVEL_MAP = {
  fullbody_2x: 'beginner',
  fullbody_3: 'beginner',
  upper_lower_3: 'beginner',
  ppl_3: 'intermediate',
  chest_back_arms_legs: 'intermediate',
  upper_lower_4: 'intermediate',
  anterior_posterior: 'intermediate',
  upper_lower_rolling: 'intermediate',
  ppl_rolling: 'intermediate',
  ppl_rest_rolling: 'intermediate',
  anterior_posterior_rolling: 'intermediate',
  fullbody_abcd_rolling: 'intermediate',
  arnold_5: 'advanced',
  bro_5: 'advanced',
  custom: 'advanced',
};

const PAIRED_SPLITS = ['upper_lower_4', 'anterior_posterior'];

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

/* ── Step 0: split template cards ─────────────────────── */
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
  box-shadow: none;
  outline: 2px solid transparent;
  transition: border-color var(--motion-fast), background var(--motion-fast), box-shadow var(--motion-fast), outline-color var(--motion-fast);
}
.ts-template-card:hover:not(.selected) {
  border-color: var(--line-2);
}
.ts-template-card.selected {
  border-color: #dc143c;
  background: rgba(220,20,60,0.12);
  outline: 2px solid #dc143c;
  outline-offset: 0px;
  box-shadow: 0 0 28px rgba(220,20,60,0.6);
}
.ts-template-card.locked {
  pointer-events: none;
  opacity: 0.45;
  cursor: default;
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
.ts-badge-lock {
  position: absolute;
  top: 10px;
  right: 12px;
  background: var(--surface-2);
  color: var(--text-3);
  border: 1px solid var(--line-2);
  font-family: var(--font-display);
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  padding: 2px 7px;
  border-radius: 4px;
}
.ts-badge-rolling {
  display: inline-block;
  background: var(--surface-2);
  color: var(--text-3);
  border: 1px solid var(--line-1);
  font-size: 0.65rem;
  font-family: var(--font-display);
  letter-spacing: 0.06em;
  padding: 2px 7px;
  border-radius: 4px;
  margin-bottom: 6px;
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

/* ── Section headers ──────────────────────────────────── */
.ts-section-header {
  margin-top: 2rem;
  margin-bottom: 0.75rem;
}
.ts-section-header-label {
  font-family: var(--font-display);
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-3);
}
.ts-section-header-sub {
  font-size: 0.78rem;
  color: var(--text-3);
  margin-top: 2px;
  font-style: italic;
}

/* ── Filter pill row ──────────────────────────────────── */
.ts-filter-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
}
.ts-filter-pill {
  font-family: var(--font-display);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: var(--text-3);
  background: var(--surface-3);
  border: 1.5px solid var(--line-1);
  border-radius: 999px;
  padding: 4px 12px;
  cursor: pointer;
  transition: all var(--motion-fast);
}
.ts-filter-pill:hover {
  border-color: var(--line-2);
  color: var(--text-2);
}
.ts-filter-pill.active {
  background: rgba(204,32,32,0.15);
  border-color: var(--accent-2);
  color: var(--text-1);
}

/* ── Rest-day constraint note ─────────────────────────── */
.ts-rest-constraint-note {
  font-size: 0.82rem;
  color: var(--text-2);
  background: rgba(249,115,22,0.08);
  border: 1px solid rgba(249,115,22,0.3);
  border-radius: var(--radius-sm);
  padding: 0.65rem 1rem;
  margin-bottom: 1.25rem;
  line-height: 1.5;
}

/* ── Step 1: schedule ──────────────────────────────────── */
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
  background: rgba(204,32,32,0.15);
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
  background: rgba(204,32,32,0.1);
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

  // Experience comes from profile — not a local editable state
  const experience = profile?.experience_level || profile?.training_experience || 'beginner';

  // Step 0: template picker
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);

  // Step 1: schedule
  const [scheduleMode, setScheduleMode] = useState("fixed");
  const [selectedDays, setSelectedDays] = useState([]);
  const [startDate, setStartDate] = useState(formatLocalDate(new Date()));

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Step 0: filter pills
  const [activeFilter, setActiveFilter] = useState(3); // default to 3 Day

  // Resolve the actual selected template object
  const selectedTemplate = selectedTemplateId === 'custom'
    ? { id: 'custom', name: 'Build My Own', type: 'custom', days_per_week: null, days: [], is_rolling: false }
    : ORDERED_SPLITS.find((t) => t.id === selectedTemplateId) || null;

  // ── navigation helpers ───────────────────────────────────────────────────

  async function handleNextFromStep0() {
    if (!selectedTemplate) return;
    if (selectedTemplateId === 'custom') {
      // Custom path: advance to step 1 so user picks Fixed or Rolling schedule
      setScheduleMode('fixed');
      setSelectedDays([]);
      setStep(1);
      return;
    }
    // Rolling splits → auto-set rolling mode
    if (selectedTemplate.is_rolling) {
      setScheduleMode('rolling');
    } else {
      setScheduleMode('fixed');
      // For splits that enforce rest between pairs, suggest Mon/Tue/Thu/Fri
      if (PAIRED_SPLITS.includes(selectedTemplateId)) {
        setSelectedDays(['mon', 'tue', 'thu', 'fri']);
      } else if (selectedTemplate.days_per_week) {
        setSelectedDays(suggestTrainingDays(selectedTemplate.days_per_week));
      }
    }
    setStep(1);
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

    // Validate rest-day constraint for paired splits
    if (PAIRED_SPLITS.includes(selectedTemplateId) && scheduleMode === 'fixed') {
      if (hasConsecutiveTriple(selectedDays)) {
        setError('This split needs at least one rest day between your sessions — try Mon, Tue, Thu, Fri.');
        setSaving(false);
        return;
      }
    }

    try {
      // 1. Get current user
      const { data: sessionR } = await supabase.auth.getSession(); const user = sessionR?.session?.user; const authErr = null;
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

      // Custom program path — blank days, no auto-assign
      if (selectedTemplateId === 'custom') {
        const { data: progRows, error: progErr } = await supabase.from('training_programs').insert({
          user_id: user.id,
          name: 'My Custom Program',
          split_type: 'custom',
          is_active: true,
          start_date: startDate,
          training_days: scheduleMode === 'fixed' ? selectedDays : [],
          experience_level: experience,
        }).select();
        if (progErr) throw new Error(progErr.message);
        const prog = progRows?.[0];
        if (prog) {
          const blankDays = scheduleMode === 'rolling'
            ? Array.from({ length: 4 }, (_, i) => ({
                program_id: prog.id, day_name: 'Assign Day', day_order: i,
                is_rest: false, muscle_focus: [], color: '#b5153c',
              }))
            : selectedDays.map((_, i) => ({
                program_id: prog.id, day_name: 'Training Day', day_order: i,
                is_rest: false, muscle_focus: [], color: '#b5153c',
              }));
          await supabase.from('training_program_days').insert(blankDays);
        }
        onComplete();
        return;
      }

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

      // 5. Insert program days (exclude rest slots from DB inserts for exercises,
      //    but include them as day rows with is_rest: true)
      const dayInserts = selectedTemplate.days.map((d, i) => ({
        program_id: prog.id,
        day_name: d.name,
        day_order: i,
        is_rest: d.is_rest || false,
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

      // 7. Auto-assign exercises for each non-rest day
      const exerciseInserts = [];
      for (let i = 0; i < insertedDays.length; i++) {
        const templateDay = selectedTemplate.days[i];
        if (templateDay.is_rest) continue;
        const programDayId = insertedDays[i].id;
        const assignments = autoAssignExercises(
          templateDay.muscle_focus,
          experience,
          allExercises,
          templateDay.name,
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
        {[0, 1].map((i) => (
          <div key={i} className={`ts-dot${step === i ? " active" : ""}`} />
        ))}
      </div>
    );
  }

  // ── Step 0: template picker ───────────────────────────────────────────────

  function renderStep0() {
    const filterOptions = [2, 3, 4, 5, 'rolling'];
    const filterLabels  = ['2 Day', '3 Day', '4 Day', '5 Day', 'Rolling'];

    // Build My Own card
    const buildMyOwnCard = {
      id: 'custom',
      name: 'Build My Own',
      type: 'custom',
      days_per_week: null,
      recommended: false,
      description: 'Build your program entirely from scratch. Full control over every training day and exercise selection.',
      who: 'For experienced lifters who know exactly what works for their body and want complete customisation.',
      days: [],
      isCustomCard: true,
    };

    // Filtered splits (excluding custom)
    const visibleSplits = ORDERED_SPLITS.filter(t => {
      if (t.id === 'custom') return false;
      if (activeFilter === null) return true;
      if (activeFilter === 'rolling') return t.is_rolling === true;
      return t.days_per_week === activeFilter && !t.is_rolling;
    });

    function isLocked(splitId) {
      // Only beginners are locked out of non-beginner splits
      if (experience !== 'beginner') return false;
      return SPLIT_LEVEL_MAP[splitId] !== 'beginner';
    }

    function renderCard(t) {
      const locked = isLocked(t.id);
      // Training day pills — filter out rest slots
      const trainingDays = t.days.filter(d => !d.is_rest);

      return (
        <div
          key={t.id}
          className={`ts-template-card${selectedTemplateId === t.id ? " selected" : ""}${locked ? " locked" : ""}`}
          onClick={locked ? undefined : () => setSelectedTemplateId(t.id)}
        >
          {locked ? (
            <span className="ts-badge-lock">🔒 Unlock as you progress</span>
          ) : t.recommended ? (
            <span className="ts-badge-rec">RECOMMENDED</span>
          ) : null}

          {t.is_rolling && (
            <span className="ts-badge-rolling">Rolling cycle</span>
          )}

          <div className="ts-template-name">{t.name}</div>
          <div className="ts-template-meta">
            {t.is_rolling
              ? t.days.filter(d => !d.is_rest).length + '-session cycle'
              : t.days_per_week != null
                ? `${t.days_per_week} days`
                : 'Custom'
            }{' '}
            · {t.type.replace(/_/g, ' ')}
          </div>
          <div className="ts-template-desc">{t.description}</div>
          <div className="ts-template-who">{t.who}</div>
          {trainingDays.length > 0 && (
            <div className="ts-day-pills">
              {trainingDays.map((d, i) => (
                <span key={i} className="ts-day-pill" style={{ background: d.color }}>
                  {d.name}
                </span>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="ts-step">
        <h2 className="ts-title">Choose your training split</h2>

        {/* Filter pill row */}
        <div className="ts-filter-row">
          {filterOptions.map((opt, i) => (
            <button
              key={i}
              className={`ts-filter-pill${activeFilter === opt ? ' active' : ''}`}
              onClick={() => setActiveFilter(opt)}
            >
              {filterLabels[i]}
            </button>
          ))}
        </div>

        <div className="ts-template-grid">
          {visibleSplits.map(renderCard)}

          {/* Build My Own — always shown */}
          {renderCard(buildMyOwnCard)}
        </div>

        <div className="ts-nav" style={{ justifyContent: 'flex-end' }}>
          <button
            className="ts-btn ts-btn-primary"
            disabled={!selectedTemplateId || saving}
            onClick={handleNextFromStep0}
          >
            {saving && <span className="ts-spinner" />}
            {saving ? 'Creating…' : 'Continue →'}
          </button>
        </div>
        {error && <div className="ts-error">{error}</div>}
      </div>
    );
  }

  // ── Step 1: schedule ──────────────────────────────────────────────────────

  function renderStep1() {
    const isRollingTemplate = selectedTemplate?.is_rolling === true;

    return (
      <div className="ts-step">
        <h2 className="ts-title">When do you train?</h2>

        {/* Tabs — only shown for non-rolling templates */}
        {!isRollingTemplate && (
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
        )}

        {(isRollingTemplate || scheduleMode === "rolling") ? (
          <div className="ts-rolling-note">
            Your split cycles automatically regardless of which day you start.
            Each session follows the next in sequence — no fixed weekly pattern
            needed.
          </div>
        ) : (
          <>
            {PAIRED_SPLITS.includes(selectedTemplateId) && (
              <div className="ts-rest-constraint-note">
                This split requires a rest day between each pair of sessions. We've pre-selected the optimal days — adjust if needed.
              </div>
            )}
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
            onClick={() => setStep(0)}
            disabled={saving}
          >
            ← Back
          </button>
          <button
            className="ts-btn ts-btn-primary"
            disabled={
              saving ||
              !selectedTemplate ||
              (!isRollingTemplate && scheduleMode === "fixed" && selectedDays.length === 0)
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
      </div>
    </>
  );
}
