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
  marginBottom: "0.75rem",
  width: "100%",
  boxSizing: "border-box",
  textAlign: "left",
});

const cardTitleStyle = {
  fontFamily: "var(--font-display)",
  fontSize: "1rem",
  fontWeight: 700,
  color: "var(--text-1)",
  marginBottom: "0.25rem",
  letterSpacing: "-0.01em",
};

const cardDescStyle = {
  fontFamily: "var(--font-body)",
  fontSize: "0.875rem",
  color: "var(--text-2)",
  lineHeight: 1.4,
};

const OPTIONS = [
  {
    value: "inactive",
    title: "Inactive",
    description: "Desk job, little to no exercise outside the gym",
  },
  {
    value: "light",
    title: "Light",
    description: "Light movement, short walks, mostly sedentary",
  },
  {
    value: "moderate",
    title: "Moderate",
    description: "Mix of sitting and movement throughout the day",
  },
  {
    value: "heavy",
    title: "Heavy",
    description: "On your feet most of the day, physically demanding job",
  },
  {
    value: "extreme",
    title: "Extreme",
    description: "Very physically demanding job or multiple daily training sessions",
  },
];

export default function Step09_ActivityLevel({ form, setField, error, onAutoAdvance }) {
  function handleSelect(value) {
    setField("activityLevel", value);
    if (onAutoAdvance) setTimeout(() => onAutoAdvance(), 180);
  }

  return (
    <div>
      <h1 style={titleStyle}>How active are you day-to-day?</h1>
      <div>
        {OPTIONS.map((opt) => {
          const selected = form.activityLevel === opt.value;
          return (
            <div
              key={opt.value}
              style={cardStyle(selected)}
              onClick={() => handleSelect(opt.value)}
              role="radio"
              aria-checked={selected}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleSelect(opt.value);
                }
              }}
            >
              <div style={cardTitleStyle}>{opt.title}</div>
              <div style={cardDescStyle}>{opt.description}</div>
            </div>
          );
        })}
      </div>
      {error && (
        <p style={{ color: "var(--bad)", fontSize: "0.8rem", marginTop: "0.4rem" }}>
          {error.message}
        </p>
      )}
    </div>
  );
}
