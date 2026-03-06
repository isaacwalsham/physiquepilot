const titleStyle = {
  fontFamily: "var(--font-display)",
  fontSize: "clamp(1.6rem, 4vw, 2.4rem)",
  fontWeight: 700,
  color: "var(--text-1)",
  marginBottom: "2rem",
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

const optionalBadgeStyle = {
  fontFamily: "var(--font-body)",
  fontSize: "0.75rem",
  color: "var(--text-3)",
  textTransform: "none",
  letterSpacing: 0,
  marginLeft: "0.4rem",
};

const fieldWrapStyle = {
  marginBottom: "1.25rem",
};

export default function Step05_BodyMetrics({
  form,
  setField,
  error,
}) {
  const isImperial = form.unitSystem === "imperial";

  const fields = [
    {
      key: "heightInput",
      label: isImperial ? `Height (ft / in)` : `Height (cm)`,
      placeholder: isImperial ? "e.g. 5'11\"" : "e.g. 180",
      inputMode: isImperial ? "text" : "numeric",
      type: isImperial ? "text" : "number",
    },
    {
      key: "startingWeightInput",
      label: isImperial ? "Current weight (lb)" : "Current weight (kg)",
      placeholder: isImperial ? "e.g. 185" : "e.g. 84",
      inputMode: "decimal",
      type: "number",
    },
    {
      key: "goalWeightInput",
      label: isImperial ? "Goal weight (lb)" : "Goal weight (kg)",
      placeholder: isImperial ? "e.g. 165" : "e.g. 75",
      inputMode: "decimal",
      type: "number",
    },
    {
      key: "bodyFatPctInput",
      label: "Body fat %",
      optional: true,
      placeholder: "e.g. 18",
      inputMode: "decimal",
      type: "number",
    },
  ];

  return (
    <div>
      <h1 style={titleStyle}>Tell us about your body</h1>

      {fields.map((f) => {
        const fieldError =
          error && (error.field === f.key || error.field === f.key.replace("Input", ""))
            ? error
            : null;

        return (
          <div key={f.key} style={fieldWrapStyle}>
            <label style={labelStyle} htmlFor={f.key}>
              {f.label}
              {f.optional && (
                <span style={optionalBadgeStyle}>(optional)</span>
              )}
            </label>
            <input
              id={f.key}
              type={f.type}
              inputMode={f.inputMode}
              min={f.type === "number" ? "0" : undefined}
              step={f.type === "number" ? "any" : undefined}
              value={form[f.key] || ""}
              onChange={(e) => setField(f.key, e.target.value)}
              placeholder={f.placeholder}
              style={inputStyle(!!fieldError)}
            />
            {fieldError && (
              <p style={errorStyle}>{fieldError.message}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
