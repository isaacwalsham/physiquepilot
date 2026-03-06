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
  resize: "vertical",
  minHeight: "6rem",
});

const errorStyle = { color: "var(--bad)", fontSize: "0.8rem", marginTop: "0.4rem" };

export default function Step14_Allergies({ form, setField, error }) {
  const hasError = !!error;

  return (
    <div>
      <h1 style={titleStyle}>Any food allergies?</h1>
      <p style={subtitleStyle}>
        We'll flag allergen warnings on foods matching your allergies. Won't be
        hard-excluded.
      </p>

      <textarea
        id="foodAllergies"
        value={form.foodAllergies || ""}
        onChange={(e) => setField("foodAllergies", e.target.value)}
        placeholder="e.g. peanuts, shellfish, tree nuts"
        style={inputStyle(hasError)}
      />
      {hasError && (
        <p style={errorStyle}>{error.message}</p>
      )}
    </div>
  );
}
