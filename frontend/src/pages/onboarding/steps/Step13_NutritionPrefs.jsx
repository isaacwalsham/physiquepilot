const titleStyle = {
  fontFamily: "var(--font-display)",
  fontSize: "clamp(1.6rem, 4vw, 2.4rem)",
  fontWeight: 700,
  color: "var(--text-1)",
  marginBottom: "2rem",
  letterSpacing: "-0.02em",
  lineHeight: 1.2,
};

const cardStyle = (selected) => ({
  border: `2px solid ${selected ? "var(--accent-2)" : "var(--line-1)"}`,
  borderRadius: "var(--radius-md)",
  background: selected ? "rgba(181,21,60,0.12)" : "var(--surface-2)",
  padding: "1.25rem 1.5rem",
  cursor: "pointer",
  transition: "border-color var(--motion-fast) ease, background var(--motion-fast) ease",
  color: "var(--text-1)",
});

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
  minHeight: "5rem",
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

const DIET_OPTIONS = [
  { value: "omnivore",      label: "Omnivore" },
  { value: "vegetarian",   label: "Vegetarian" },
  { value: "vegan",        label: "Vegan" },
  { value: "pescatarian",  label: "Pescatarian" },
  { value: "halal",        label: "Halal" },
  { value: "gluten-free",  label: "Gluten-free" },
  { value: "lactose-free", label: "Lactose-free" },
];

export default function Step13_NutritionPrefs({ form, setField, error }) {
  const dietError   = error && error.field === "dietaryPreference";
  const notesError  = error && error.field === "dietaryAdditional";
  const dislikesError = error && error.field === "dislikes";

  return (
    <div>
      <h1 style={titleStyle}>Any dietary requirements?</h1>

      {/* Dietary preference grid */}
      <div style={{ marginBottom: "1.75rem" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "0.6rem",
          }}
        >
          {DIET_OPTIONS.map((opt) => {
            const selected = form.dietaryPreference === opt.value;
            return (
              <div
                key={opt.value}
                role="radio"
                aria-checked={selected}
                tabIndex={0}
                style={{
                  ...cardStyle(selected),
                  padding: "0.75rem 0.5rem",
                  textAlign: "center",
                  fontFamily: "var(--font-body)",
                  fontSize: "0.875rem",
                }}
                onClick={() => setField("dietaryPreference", opt.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setField("dietaryPreference", opt.value);
                  }
                }}
              >
                {opt.label}
              </div>
            );
          })}
        </div>
        {dietError && <p style={errorStyle}>{error.message}</p>}
      </div>

      {/* Additional dietary notes */}
      <div style={{ marginBottom: "1.25rem" }}>
        <label style={labelStyle} htmlFor="dietaryAdditional">
          Additional dietary notes
        </label>
        <textarea
          id="dietaryAdditional"
          value={form.dietaryAdditional || ""}
          onChange={(e) => setField("dietaryAdditional", e.target.value)}
          placeholder="e.g. low sodium, no pork"
          style={inputStyle(notesError)}
        />
        {notesError && <p style={errorStyle}>{error.message}</p>}
      </div>

      {/* Dislikes */}
      <div>
        <label style={labelStyle} htmlFor="dislikes">
          Foods you dislike
        </label>
        <textarea
          id="dislikes"
          value={form.dislikes || ""}
          onChange={(e) => setField("dislikes", e.target.value)}
          placeholder="e.g. mushrooms, olives"
          style={inputStyle(dislikesError)}
        />
        {dislikesError && <p style={errorStyle}>{error.message}</p>}
      </div>
    </div>
  );
}
