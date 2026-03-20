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
  background: selected ? "rgba(165,21,21,0.12)" : "var(--surface-2)",
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
});

const errorStyle = { color: "var(--bad)", fontSize: "0.8rem", marginTop: "0.4rem" };

const labelStyle = {
  display: "block",
  fontFamily: "var(--font-body)",
  fontSize: "0.85rem",
  color: "var(--text-2)",
  marginBottom: "0.75rem",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const cardTitleStyle = {
  fontFamily: "var(--font-display)",
  fontSize: "0.95rem",
  fontWeight: 700,
  color: "var(--text-1)",
  marginBottom: "0.2rem",
  letterSpacing: "-0.01em",
};

const cardDescStyle = {
  fontFamily: "var(--font-body)",
  fontSize: "0.8rem",
  color: "var(--text-2)",
  lineHeight: 1.4,
};

const EXPERIENCE_OPTIONS = [
  {
    value: "beginner",
    title: "Beginner",
    description: "New to structured training",
  },
  {
    value: "intermediate",
    title: "Intermediate",
    description: "1–3 years of consistent training",
  },
  {
    value: "advanced",
    title: "Advanced",
    description: "3+ years, strong foundation",
  },
];

const GYM_TYPE_OPTIONS = [
  { value: "home", title: "Home gym" },
  { value: "commercial", title: "Commercial gym" },
  { value: "independent", title: "Independent gym" },
  { value: "other", title: "Other" },
];

export default function Step11_GymExperience({ form, setField, error }) {
  const expError = error && error.field === "experienceLevel";
  const gymError = error && error.field === "gymType";
  const chainError = error && error.field === "gymChain";
  const showGymChain = form.gymType === "commercial" || form.gymType === "independent";

  return (
    <div>
      <h1 style={titleStyle}>Tell us about your gym setup</h1>

      {/* Experience level */}
      <div style={{ marginBottom: "2rem" }}>
        <label style={labelStyle}>Your experience level</label>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "0.75rem",
          }}
        >
          {EXPERIENCE_OPTIONS.map((opt) => {
            const selected = form.experienceLevel === opt.value;
            return (
              <div
                key={opt.value}
                role="radio"
                aria-checked={selected}
                tabIndex={0}
                style={{ ...cardStyle(selected), padding: "1rem" }}
                onClick={() => setField("experienceLevel", opt.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setField("experienceLevel", opt.value);
                  }
                }}
              >
                <div style={cardTitleStyle}>{opt.title}</div>
                <div style={cardDescStyle}>{opt.description}</div>
              </div>
            );
          })}
        </div>
        {expError && <p style={errorStyle}>{error.message}</p>}
      </div>

      {/* Gym type */}
      <div style={{ marginBottom: showGymChain ? "1.25rem" : "0" }}>
        <label style={labelStyle}>Gym type</label>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "0.75rem",
          }}
        >
          {GYM_TYPE_OPTIONS.map((opt) => {
            const selected = form.gymType === opt.value;
            return (
              <div
                key={opt.value}
                role="radio"
                aria-checked={selected}
                tabIndex={0}
                style={{
                  ...cardStyle(selected),
                  padding: "1rem 1.25rem",
                  fontFamily: "var(--font-body)",
                  fontSize: "0.95rem",
                }}
                onClick={() => setField("gymType", opt.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setField("gymType", opt.value);
                  }
                }}
              >
                {opt.title}
              </div>
            );
          })}
        </div>
        {gymError && <p style={errorStyle}>{error.message}</p>}
      </div>

      {/* Gym chain input */}
      {showGymChain && (
        <div style={{ marginTop: "1.25rem" }}>
          <label
            style={{ ...labelStyle, marginBottom: "0.4rem" }}
            htmlFor="gymChain"
          >
            Gym name (optional)
          </label>
          <input
            id="gymChain"
            type="text"
            value={form.gymChain || ""}
            onChange={(e) => setField("gymChain", e.target.value)}
            placeholder="e.g. PureGym, Anytime Fitness"
            style={inputStyle(chainError)}
          />
          {chainError && <p style={errorStyle}>{error.message}</p>}
        </div>
      )}
    </div>
  );
}
