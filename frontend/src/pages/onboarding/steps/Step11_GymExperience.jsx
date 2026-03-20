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
  padding: "1rem",
  cursor: "pointer",
  transition: "border-color var(--motion-fast) ease, background var(--motion-fast) ease",
  color: "var(--text-1)",
});

const errorStyle = { color: "var(--bad)", fontSize: "0.8rem", marginTop: "0.4rem" };

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

export default function Step11_GymExperience({ form, setField, error }) {
  const expError = error && error.field === "experienceLevel";

  return (
    <div>
      <h1 style={titleStyle}>How experienced are you?</h1>

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
              style={cardStyle(selected)}
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
  );
}
