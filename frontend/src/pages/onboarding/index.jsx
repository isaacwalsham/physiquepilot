import { useState, useEffect, useRef } from "react";
import { useOnboardingForm } from "./useOnboardingForm";
import { validateStep } from "./validation";
import { buildCaloriePreview } from "../../lib/tdee";

import Step01_Name from "./steps/Step01_Name";
import Step02_DateOfBirth from "./steps/Step02_DateOfBirth";
import Step03_Sex from "./steps/Step03_Sex";
import Step04_Units from "./steps/Step04_Units";
import Step05_BodyMetrics from "./steps/Step05_BodyMetrics";
import Step06_Goal from "./steps/Step06_Goal";
import Step07_WeeklyRate from "./steps/Step07_WeeklyRate";
import Step08_Calories from "./steps/Step08_Calories";
import Step09_ActivityLevel from "./steps/Step09_ActivityLevel";
import Step10_TrainingSchedule from "./steps/Step10_TrainingSchedule";
import Step11_GymExperience from "./steps/Step11_GymExperience";
import Step12_Baselines from "./steps/Step12_Baselines";
import Step13_NutritionPrefs from "./steps/Step13_NutritionPrefs";
import Step14_Allergies from "./steps/Step14_Allergies";
import Step15_Safety from "./steps/Step15_Safety";

// Steps that auto-advance on selection (no "Continue" button needed)
const AUTO_ADVANCE_STEPS = new Set([3, 4, 6, 9]);

// Step 7 is skipped when goal is maintain
const getSkippedSteps = (form) => (form.goalType === "maintain" ? new Set([7]) : new Set());

const TOTAL_STEPS = 15;

function getEffectiveStep(rawStep, skipped) {
  let s = rawStep;
  while (skipped.has(s) && s <= TOTAL_STEPS) s++;
  return Math.min(s, TOTAL_STEPS);
}

function getEffectivePrev(rawStep, skipped) {
  let s = rawStep;
  while (skipped.has(s) && s >= 1) s--;
  return Math.max(s, 1);
}

// Visible step index for the progress bar (skipped steps don't count toward label)
function getDisplayProgress(step, skipped) {
  let counted = 0;
  for (let i = 1; i <= step; i++) {
    if (!skipped.has(i)) counted++;
  }
  const total = TOTAL_STEPS - skipped.size;
  return { counted, total };
}

export default function Onboarding() {
  const {
    form,
    setField,
    setFields,
    loading,
    saving,
    error,
    setError,
    profile,
    savedStep,
    saveProgress,
    handleSubmit,
  } = useOnboardingForm();

  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState("forward"); // "forward" | "back"
  const [animating, setAnimating] = useState(false);
  const [validationError, setValidationError] = useState(null);
  const contentRef = useRef(null);

  // Resume at saved step once profile loads
  useEffect(() => {
    if (!loading && savedStep > 1) {
      setStep(savedStep);
    }
  }, [loading, savedStep]);

  const skipped = getSkippedSteps(form);
  const { counted, total } = getDisplayProgress(step, skipped);
  const progressPct = total > 0 ? (counted / total) * 100 : 0;

  // ─── Navigation ────────────────────────────────────────────────────────────

  const advance = async () => {
    const result = validateStep(step, form);
    if (!result.valid) {
      setValidationError(result);
      return;
    }
    setValidationError(null);

    let nextStep = step + 1;
    while (skipped.has(nextStep) && nextStep <= TOTAL_STEPS) nextStep++;

    if (nextStep > TOTAL_STEPS) {
      // Final step — submit
      await handleSubmit();
      return;
    }

    setDirection("forward");
    await saveProgress(nextStep);
    animateTo(nextStep);
  };

  const goBack = async () => {
    setValidationError(null);
    let prevStep = step - 1;
    while (skipped.has(prevStep) && prevStep >= 1) prevStep--;
    if (prevStep < 1) return;

    setDirection("back");
    await saveProgress(prevStep);
    animateTo(prevStep);
  };

  const animateTo = (target) => {
    setAnimating(true);
    // Let the exit animation play, then swap step
    setTimeout(() => {
      setStep(target);
      setAnimating(false);
    }, 220);
  };

  const onAutoAdvance = () => advance();

  // ─── Loading state ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={styles.pageWrap}>
        <div style={styles.loadingText}>Loading…</div>
      </div>
    );
  }

  // ─── Step component map ───────────────────────────────────────────────────

  const stepProps = {
    form,
    setField,
    setFields,
    error: validationError,
    onAutoAdvance: AUTO_ADVANCE_STEPS.has(step) ? onAutoAdvance : undefined,
  };

  const stepComponents = {
    1: <Step01_Name {...stepProps} />,
    2: <Step02_DateOfBirth {...stepProps} />,
    3: <Step03_Sex {...stepProps} />,
    4: <Step04_Units {...stepProps} />,
    5: <Step05_BodyMetrics {...stepProps} />,
    6: <Step06_Goal {...stepProps} />,
    7: <Step07_WeeklyRate {...stepProps} />,
    8: <Step08_Calories {...stepProps} preview={buildCaloriePreview(form)} />,
    9: <Step09_ActivityLevel {...stepProps} />,
    10: <Step10_TrainingSchedule {...stepProps} />,
    11: <Step11_GymExperience {...stepProps} />,
    12: <Step12_Baselines {...stepProps} />,
    13: <Step13_NutritionPrefs {...stepProps} />,
    14: <Step14_Allergies {...stepProps} />,
    15: <Step15_Safety {...stepProps} />,
  };

  const isLastStep = step === TOTAL_STEPS;
  const isAutoAdvance = AUTO_ADVANCE_STEPS.has(step);

  const slideStyle = {
    transform: animating
      ? `translateX(${direction === "forward" ? "-60px" : "60px"})`
      : "translateX(0)",
    opacity: animating ? 0 : 1,
    transition: "transform var(--motion-med) ease, opacity var(--motion-med) ease",
  };

  return (
    <div style={styles.pageWrap}>
      {/* ── Progress bar ─────────────────────────────────────────── */}
      <div style={styles.progressTrack}>
        <div
          style={{
            ...styles.progressFill,
            width: `${progressPct}%`,
            transition: "width var(--motion-slow) ease",
          }}
        />
      </div>

      {/* ── Step counter ─────────────────────────────────────────── */}
      <div style={styles.stepMeta}>
        <button
          onClick={goBack}
          disabled={step === 1}
          style={styles.backBtn}
          aria-label="Go back"
        >
          ← Back
        </button>
        <span style={styles.stepLabel}>
          {counted} / {total}
        </span>
      </div>

      {/* ── Step content ─────────────────────────────────────────── */}
      <div style={styles.contentWrap}>
        <div ref={contentRef} style={{ ...styles.stepContent, ...slideStyle }}>
          {stepComponents[step]}

          {/* Global error (non-field) */}
          {(error || (validationError && !validationError.field)) && (
            <p style={styles.globalError}>{error || validationError?.message}</p>
          )}
        </div>
      </div>

      {/* ── Continue button (hidden on auto-advance steps) ──────── */}
      {!isAutoAdvance && (
        <div style={styles.footer}>
          <button
            onClick={advance}
            disabled={saving}
            style={saving ? { ...styles.continueBtn, ...styles.continueBtnDisabled } : styles.continueBtn}
          >
            {saving ? "Saving…" : isLastStep ? "Complete setup" : "Continue"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  pageWrap: {
    minHeight: "100vh",
    width: "100%",
    display: "flex",
    flexDirection: "column",
    background:
      "radial-gradient(1200px 520px at 8% -20%, rgba(181,21,60,0.14), transparent 70%), radial-gradient(1100px 460px at 95% -15%, rgba(138,15,46,0.18), transparent 68%), linear-gradient(180deg, var(--bg-1), var(--bg-0))",
    position: "relative",
  },

  loadingText: {
    color: "var(--text-3)",
    fontFamily: "var(--font-body)",
    padding: "4rem",
    textAlign: "center",
    margin: "auto",
  },

  progressTrack: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    height: "3px",
    background: "var(--line-1)",
    zIndex: 100,
  },

  progressFill: {
    height: "100%",
    background: "var(--accent-2)",
    borderRadius: "0 2px 2px 0",
  },

  stepMeta: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "1.5rem 2rem 0",
    maxWidth: "640px",
    width: "100%",
    margin: "0 auto",
  },

  backBtn: {
    background: "none",
    border: "none",
    color: "var(--text-3)",
    fontFamily: "var(--font-body)",
    fontSize: "0.875rem",
    cursor: "pointer",
    padding: "0.25rem 0",
    letterSpacing: "0.02em",
    transition: "color var(--motion-fast) ease",
  },

  stepLabel: {
    fontFamily: "var(--font-display)",
    fontSize: "0.75rem",
    color: "var(--text-3)",
    letterSpacing: "0.08em",
  },

  contentWrap: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "2rem",
    overflowX: "hidden",
  },

  stepContent: {
    width: "100%",
    maxWidth: "560px",
  },

  globalError: {
    color: "var(--bad)",
    fontFamily: "var(--font-body)",
    fontSize: "0.875rem",
    marginTop: "1rem",
    padding: "0.75rem 1rem",
    background: "rgba(255,79,115,0.08)",
    borderRadius: "var(--radius-sm)",
    border: "1px solid rgba(255,79,115,0.2)",
  },

  footer: {
    padding: "1.5rem 2rem 2.5rem",
    maxWidth: "640px",
    width: "100%",
    margin: "0 auto",
  },

  continueBtn: {
    width: "100%",
    padding: "0.9rem 1.5rem",
    background: "var(--accent-2)",
    color: "#fff",
    border: "none",
    borderRadius: "var(--radius-md)",
    fontFamily: "var(--font-display)",
    fontSize: "1rem",
    fontWeight: 600,
    letterSpacing: "0.04em",
    cursor: "pointer",
    transition: "background var(--motion-fast) ease, opacity var(--motion-fast) ease",
  },

  continueBtnDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
};
