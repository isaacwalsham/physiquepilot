const titleStyle = {
  fontFamily: "var(--font-display)",
  fontSize: "clamp(1.6rem, 4vw, 2.4rem)",
  fontWeight: 700,
  color: "var(--text-1)",
  marginBottom: "0.5rem",
  letterSpacing: "-0.02em",
  lineHeight: 1.2,
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

const errorStyle = {
  color: "var(--bad)",
  fontSize: "0.8rem",
  marginTop: "0.4rem",
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

const subtitleStyle = {
  fontFamily: "var(--font-body)",
  fontSize: "0.9rem",
  color: "var(--text-3)",
  marginBottom: "1.5rem",
};

const presetRowStyle = {
  display: "flex",
  gap: "0.5rem",
  flexWrap: "wrap",
  marginBottom: "1.25rem",
};

const presetBtnStyle = (selected) => ({
  fontFamily: "var(--font-body)",
  fontSize: "0.9rem",
  fontWeight: selected ? 700 : 400,
  padding: "0.5rem 0.9rem",
  borderRadius: "var(--radius-sm)",
  border: `1.5px solid ${selected ? "var(--accent-2)" : "var(--line-1)"}`,
  background: selected ? "rgba(165,21,21,0.15)" : "var(--surface-2)",
  color: selected ? "var(--accent-2)" : "var(--text-2)",
  cursor: "pointer",
  transition: "border-color var(--motion-fast) ease, background var(--motion-fast) ease",
  whiteSpace: "nowrap",
});

const KG_TO_LB = 2.20462;

function toDisplay(kg, isImperial) {
  return isImperial ? +(kg * KG_TO_LB).toFixed(2) : kg;
}

function formatPreset(kg, isImperial) {
  const val = toDisplay(kg, isImperial);
  const unit = isImperial ? "lb" : "kg";
  return `${val} ${unit}`;
}

const LOSE_PRESETS_KG = [0.25, 0.5, 0.75, 1.0];
const GAIN_PRESETS_KG = [0.1, 0.15, 0.2, 0.25];

export default function Step07_WeeklyRate({
  form,
  setField,
  error,
}) {
  const isImperial = form.unitSystem === "imperial";
  const goalType = form.goalType;

  const presetKgs = goalType === "gain" ? GAIN_PRESETS_KG : LOSE_PRESETS_KG;

  function getSafeRange() {
    if (goalType === "gain") {
      return isImperial
        ? "Safe range: 0.22–0.66 lb / week"
        : "Safe range: 0.1–0.3 kg / week";
    }
    return isImperial
      ? "Safe range: 0.22–2.2 lb / week"
      : "Safe range: 0.1–1.0 kg / week";
  }

  function handlePreset(kg) {
    const val = isImperial ? +(kg * KG_TO_LB).toFixed(2) : kg;
    setField("weeklyRateInput", String(val));
  }

  function isPresetSelected(kg) {
    const val = isImperial ? +(kg * KG_TO_LB).toFixed(2) : kg;
    return String(form.weeklyRateInput) === String(val);
  }

  const hasError = error && error.field === "weeklyRateInput";

  return (
    <div>
      <h1 style={titleStyle}>How fast do you want to progress?</h1>

      <p style={subtitleStyle}>{getSafeRange()}</p>

      <div style={presetRowStyle}>
        {presetKgs.map((kg) => (
          <button
            key={kg}
            type="button"
            style={presetBtnStyle(isPresetSelected(kg))}
            onClick={() => handlePreset(kg)}
          >
            {formatPreset(kg, isImperial)}
          </button>
        ))}
      </div>

      <div>
        <label style={labelStyle} htmlFor="weeklyRateInput">
          Custom ({isImperial ? "lb" : "kg"} / week)
        </label>
        <input
          id="weeklyRateInput"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={form.weeklyRateInput || ""}
          onChange={(e) => setField("weeklyRateInput", e.target.value)}
          placeholder={isImperial ? "e.g. 1.1" : "e.g. 0.5"}
          style={inputStyle(hasError)}
        />
        {hasError && (
          <p style={errorStyle}>{error.message}</p>
        )}
      </div>
    </div>
  );
}
