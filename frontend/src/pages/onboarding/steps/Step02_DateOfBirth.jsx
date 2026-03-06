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
  colorScheme: "dark",
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

const hintStyle = {
  fontFamily: "var(--font-body)",
  fontSize: "0.875rem",
  color: "var(--text-3)",
  marginTop: "0.75rem",
};

export default function Step02_DateOfBirth({ form, setField, error }) {
  const hasError = error && error.field === "dateOfBirth";

  return (
    <div>
      <h1 style={titleStyle}>When were you born?</h1>

      <div>
        <label style={labelStyle} htmlFor="dateOfBirth">
          Date of birth
        </label>
        <input
          id="dateOfBirth"
          type="date"
          autoFocus
          value={form.dateOfBirth || ""}
          onChange={(e) => setField("dateOfBirth", e.target.value)}
          max={new Date().toISOString().split("T")[0]}
          min="1900-01-01"
          style={inputStyle(hasError)}
        />
        {hasError && (
          <p style={errorStyle}>{error.message}</p>
        )}
        <p style={hintStyle}>We use this to calculate your metabolic rate accurately.</p>
      </div>
    </div>
  );
}
