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

const fieldWrapStyle = {
  marginBottom: "1.25rem",
};

export default function Step01_Name({ form, setField, error }) {
  const firstError = error && (error.field === "firstName" || error.field === "name");
  const lastError = error && error.field === "lastName";

  return (
    <div>
      <h1 style={titleStyle}>What's your name?</h1>

      <div style={fieldWrapStyle}>
        <label style={labelStyle} htmlFor="firstName">
          First name
        </label>
        <input
          id="firstName"
          type="text"
          autoComplete="given-name"
          autoFocus
          value={form.firstName || ""}
          onChange={(e) => setField("firstName", e.target.value)}
          placeholder="First name"
          style={inputStyle(firstError)}
        />
        {firstError && (
          <p style={errorStyle}>{error.message}</p>
        )}
      </div>

      <div style={fieldWrapStyle}>
        <label style={labelStyle} htmlFor="lastName">
          Last name
        </label>
        <input
          id="lastName"
          type="text"
          autoComplete="family-name"
          value={form.lastName || ""}
          onChange={(e) => setField("lastName", e.target.value)}
          placeholder="Last name"
          style={inputStyle(lastError)}
        />
        {lastError && (
          <p style={errorStyle}>{error.message}</p>
        )}
      </div>
    </div>
  );
}
