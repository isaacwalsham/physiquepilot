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
  flex: 1,
  textAlign: "center",
  userSelect: "none",
  WebkitUserSelect: "none",
});

const cardLabelStyle = {
  fontFamily: "var(--font-display)",
  fontSize: "1.15rem",
  fontWeight: 700,
  letterSpacing: "-0.01em",
};

const cardIconStyle = {
  fontSize: "2.25rem",
  marginBottom: "0.5rem",
  display: "block",
};

const errorStyle = {
  color: "var(--bad)",
  fontSize: "0.8rem",
  marginTop: "0.4rem",
};

const rowStyle = {
  display: "flex",
  gap: "1rem",
};

const OPTIONS = [
  { value: "male", label: "Male", icon: "♂" },
  { value: "female", label: "Female", icon: "♀" },
];

export default function Step03_Sex({ form, setField, error, onAutoAdvance }) {
  const hasError = error && error.field === "sex";

  function handleSelect(value) {
    setField("sex", value);
    if (onAutoAdvance) {
      setTimeout(() => onAutoAdvance(), 180);
    }
  }

  return (
    <div>
      <h1 style={titleStyle}>Which best describes you?</h1>

      <div style={rowStyle}>
        {OPTIONS.map((opt) => (
          <div
            key={opt.value}
            style={cardStyle(form.sex === opt.value)}
            onClick={() => handleSelect(opt.value)}
            role="button"
            tabIndex={0}
            aria-pressed={form.sex === opt.value}
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
