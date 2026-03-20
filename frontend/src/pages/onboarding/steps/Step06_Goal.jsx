const titleStyle = {
  fontFamily: "var(--font-display)",
  fontSize: "clamp(1.6rem, 4vw, 2.4rem)",
  fontWeight: 700,
  color: "var(--text-1)",
  marginBottom: "0.75rem",
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
  textAlign: "center",
  userSelect: "none",
  WebkitUserSelect: "none",
  flex: 1,
  minWidth: 0,
});

const cardIconStyle = {
  fontSize: "2rem",
  display: "block",
  marginBottom: "0.4rem",
};

const cardLabelStyle = {
  fontFamily: "var(--font-display)",
  fontSize: "1rem",
  fontWeight: 700,
  letterSpacing: "-0.01em",
  display: "block",
};

const errorStyle = {
  color: "var(--bad)",
  fontSize: "0.8rem",
  marginTop: "0.4rem",
};

const noteStyle = {
  fontFamily: "var(--font-body)",
  fontSize: "0.8rem",
  color: "var(--text-3)",
  marginBottom: "1.5rem",
  fontStyle: "italic",
};

const rowStyle = {
  display: "flex",
  gap: "0.75rem",
  flexWrap: "wrap",
};

const OPTIONS = [
  { value: "lose", label: "Lose weight", icon: "↓" },
  { value: "maintain", label: "Maintain", icon: "=" },
  { value: "gain", label: "Build muscle", icon: "↑" },
];

export default function Step06_Goal({ form, setField, error, onAutoAdvance }) {
  const hasError = error && error.field === "goalType";

  function handleSelect(value) {
    setField("goalType", value);
    if (onAutoAdvance) {
      setTimeout(() => onAutoAdvance(), 180);
    }
  }

  return (
    <div>
      <h1 style={titleStyle}>What's your main goal?</h1>

      <p style={noteStyle}>
        We estimated this from your weights — adjust if needed.
      </p>

      <div style={rowStyle}>
        {OPTIONS.map((opt) => (
          <div
            key={opt.value}
            style={cardStyle(form.goalType === opt.value)}
            onClick={() => handleSelect(opt.value)}
            role="button"
            tabIndex={0}
            aria-pressed={form.goalType === opt.value}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleSelect(opt.value);
              }
            }}
          >
            <span style={cardIconStyle}>{opt.icon}</span>
            <span style={cardLabelStyle}>{opt.label}</span>
          </div>
        ))}
      </div>

      {hasError && (
        <p style={errorStyle}>{error.message}</p>
      )}
    </div>
  );
}
