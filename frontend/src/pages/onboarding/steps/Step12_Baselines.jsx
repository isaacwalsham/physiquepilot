const titleStyle = {
  fontFamily: "var(--font-display)",
  fontSize: "clamp(1.6rem, 4vw, 2.4rem)",
  fontWeight: 700,
  color: "var(--text-1)",
  marginBottom: "0.75rem",
  letterSpacing: "-0.02em",
  lineHeight: 1.2,
};

const subtitleStyle = {
  fontFamily: "var(--font-body)",
  fontSize: "0.95rem",
  color: "var(--text-2)",
  marginBottom: "2rem",
  lineHeight: 1.5,
};

const labelStyle = {
  display: "block",
  fontFamily: "var(--font-body)",
  fontSize: "0.85rem",
  color: "var(--text-2)",
  marginBottom: "0.4rem",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const inputStyle = (hasError) => ({
  width: "100%",
  background: "var(--surface-2)",
  border: `1.5px solid ${hasError ? "var(--bad)" : "var(--line-1)"}`,
  borderRadius: "var(--radius-sm)",
  color: "var(--text-1)",
  fontFamily: "var(--font-body)",
  fontSize: "1rem",
  padding: "0.75rem 1rem",
  outline: "none",
  boxSizing: "border-box",
});

const selectStyle = (hasError) => ({
  ...inputStyle(hasError),
  appearance: "none",
  WebkitAppearance: "none",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23888' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 1rem center",
  paddingRight: "2.5rem",
  cursor: "pointer",
});

const errorStyle = { color: "var(--bad)", fontSize: "0.8rem", marginTop: "0.4rem" };

const fieldWrapStyle = { marginBottom: "1.25rem" };

const notSureBtnStyle = (active) => ({
  marginTop: "0.5rem",
  padding: "0.5rem 1rem",
  fontFamily: "var(--font-body)",
  fontSize: "0.85rem",
  color: active ? "var(--accent-2)" : "var(--text-3)",
  background: "none",
  border: `1.5px solid ${active ? "var(--accent-2)" : "var(--line-1)"}`,
  borderRadius: "var(--radius-sm)",
  cursor: "pointer",
  transition: "color var(--motion-fast) ease, border-color var(--motion-fast) ease",
});

const CARDIO_TYPES = [
  { value: "",              label: "Select type (optional)" },
  { value: "running",      label: "Running / Jogging" },
  { value: "cycling",      label: "Cycling" },
  { value: "swimming",     label: "Swimming" },
  { value: "incline_walk", label: "Incline walk / Stairmaster" },
  { value: "rowing",       label: "Rowing" },
  { value: "hiit",         label: "HIIT / Classes" },
  { value: "other",        label: "Other" },
];

export default function Step12_Baselines({ form, setField, error }) {
  const stepsNotSure = !!form.baselineStepsNotSure;
  const stepsError = error && error.field === "baselineSteps";
  const cardioMinError = error && error.field === "baselineCardioMinutes";
  const cardioHrError = error && error.field === "baselineCardioHr";

  return (
    <div>
      <h1 style={titleStyle}>Your activity baselines</h1>
      <p style={subtitleStyle}>
        Helps us calibrate your targets from day one.
      </p>

      {/* Steps per day — required */}
      <div style={fieldWrapStyle}>
        <label style={labelStyle} htmlFor="baselineStepsInput">
          Average steps per day
        </label>
        <input
          id="baselineStepsInput"
          type="number"
          inputMode="numeric"
          min="0"
          value={stepsNotSure ? "" : (form.baselineStepsInput || "")}
          onChange={(e) => {
            setField("baselineStepsNotSure", false);
            setField("baselineStepsInput", e.target.value);
          }}
          placeholder="e.g. 8000"
          disabled={stepsNotSure}
          style={{
            ...inputStyle(stepsError),
            opacity: stepsNotSure ? 0.4 : 1,
          }}
        />
        <button
          type="button"
          style={notSureBtnStyle(stepsNotSure)}
          onClick={() => {
            setField("baselineStepsNotSure", !stepsNotSure);
            if (!stepsNotSure) setField("baselineStepsInput", "");
          }}
        >
          {stepsNotSure ? "✓ Not sure" : "Not sure"}
        </button>
        {stepsError && <p style={errorStyle}>{error.message}</p>}
      </div>

      {/* Cardio mins/week */}
      <div style={fieldWrapStyle}>
        <label style={labelStyle} htmlFor="baselineCardioMinutesInput">
          Cardio minutes per week <span style={{ color: "var(--text-3)", textTransform: "none", fontSize: "0.8rem" }}>(optional)</span>
        </label>
        <input
          id="baselineCardioMinutesInput"
          type="number"
          inputMode="numeric"
          min="0"
          value={form.baselineCardioMinutesInput || ""}
          onChange={(e) => setField("baselineCardioMinutesInput", e.target.value)}
          placeholder="e.g. 120"
          style={inputStyle(cardioMinError)}
        />
        {cardioMinError && <p style={errorStyle}>{error.message}</p>}
      </div>

      {/* Cardio type */}
      <div style={fieldWrapStyle}>
        <label style={labelStyle} htmlFor="baselineCardioType">
          Cardio type <span style={{ color: "var(--text-3)", textTransform: "none", fontSize: "0.8rem" }}>(optional)</span>
        </label>
        <select
          id="baselineCardioType"
          value={form.baselineCardioType || ""}
          onChange={(e) => setField("baselineCardioType", e.target.value)}
          style={selectStyle(false)}
        >
          {CARDIO_TYPES.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Average cardio HR */}
      <div style={fieldWrapStyle}>
        <label style={labelStyle} htmlFor="baselineCardioHrInput">
          Average cardio heart rate <span style={{ color: "var(--text-3)", textTransform: "none", fontSize: "0.8rem" }}>(optional)</span>
        </label>
        <input
          id="baselineCardioHrInput"
          type="number"
          inputMode="numeric"
          min="0"
          value={form.baselineCardioHrInput || ""}
          onChange={(e) => setField("baselineCardioHrInput", e.target.value)}
          placeholder="e.g. 145"
          style={inputStyle(cardioHrError)}
        />
        {cardioHrError && <p style={errorStyle}>{error.message}</p>}
      </div>
    </div>
  );
}
