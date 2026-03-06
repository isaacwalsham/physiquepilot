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

const errorStyle = { color: "var(--bad)", fontSize: "0.8rem", marginTop: "0.4rem" };

const labelStyle = {
  display: "block",
  fontFamily: "var(--font-body)",
  fontSize: "0.85rem",
  color: "var(--text-2)",
  marginBottom: "0.4rem",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const fieldWrapStyle = {
  marginBottom: "1.25rem",
};

const FIELDS = [
  {
    key: "baselineStepsInput",
    label: "Average steps per day",
    placeholder: "e.g. 8000",
  },
  {
    key: "baselineCardioMinutesInput",
    label: "Cardio minutes per week",
    placeholder: "e.g. 120",
  },
  {
    key: "baselineCardioHrInput",
    label: "Average cardio heart rate",
    placeholder: "e.g. 145",
  },
];

export default function Step12_Baselines({ form, setField, error }) {
  const lissOn = !!form.defaultLissOptIn;

  function getFieldError(key) {
    return error && error.field === key;
  }

  return (
    <div>
      <h1 style={titleStyle}>Set your starting baselines</h1>
      <p style={subtitleStyle}>
        These are used to set your initial targets. All optional — skip anything
        you're unsure about.
      </p>

      {FIELDS.map(({ key, label, placeholder }) => {
        const hasError = getFieldError(key);
        return (
          <div key={key} style={fieldWrapStyle}>
            <label style={labelStyle} htmlFor={key}>
              {label}
            </label>
            <input
              id={key}
              type="number"
              inputMode="numeric"
              min="0"
              value={form[key] || ""}
              onChange={(e) => setField(key, e.target.value)}
              placeholder={placeholder}
              style={inputStyle(hasError)}
            />
            {hasError && <p style={errorStyle}>{error.message}</p>}
          </div>
        );
      })}

      {/* LISS toggle row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          padding: "1rem 1.25rem",
          border: "1.5px solid var(--line-1)",
          borderRadius: "var(--radius-sm)",
          cursor: "pointer",
          background: "var(--surface-2)",
          marginTop: "0.5rem",
        }}
        onClick={() => setField("defaultLissOptIn", !lissOn)}
        role="checkbox"
        aria-checked={lissOn}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setField("defaultLissOptIn", !lissOn);
          }
        }}
      >
        {/* Toggle pill */}
        <div
          style={{
            width: "2.5rem",
            height: "1.4rem",
            borderRadius: "999px",
            background: lissOn ? "var(--accent-2)" : "var(--line-1)",
            position: "relative",
            flexShrink: 0,
            transition: "background var(--motion-fast) ease",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "0.2rem",
              left: lissOn ? "1.2rem" : "0.2rem",
              width: "1rem",
              height: "1rem",
              borderRadius: "50%",
              background: "#fff",
              transition: "left var(--motion-fast) ease",
            }}
          />
        </div>
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.9rem",
            color: "var(--text-1)",
            lineHeight: 1.4,
            userSelect: "none",
          }}
        >
          Add 15 min LISS cardio to training days by default
        </span>
      </div>

      {error && !FIELDS.some((f) => f.key === error.field) && (
        <p style={{ ...errorStyle, marginTop: "0.75rem" }}>{error.message}</p>
      )}
    </div>
  );
}
