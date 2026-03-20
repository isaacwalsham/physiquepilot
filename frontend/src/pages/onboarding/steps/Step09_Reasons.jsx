const titleStyle = {
  fontFamily: "var(--font-display)",
  fontSize: "clamp(1.6rem, 4vw, 2.4rem)",
  fontWeight: 700,
  color: "var(--text-1)",
  marginBottom: "0.5rem",
  letterSpacing: "-0.02em",
  lineHeight: 1.2,
};

const subtitleStyle = {
  fontFamily: "var(--font-body)",
  fontSize: "0.95rem",
  color: "var(--text-3)",
  marginBottom: "1.75rem",
  lineHeight: 1.5,
};

const optionStyle = (selected) => ({
  border: `2px solid ${selected ? "var(--accent-2)" : "var(--line-1)"}`,
  borderRadius: "var(--radius-md)",
  background: selected ? "rgba(165,21,21,0.12)" : "var(--surface-2)",
  padding: "0.9rem 1.25rem",
  cursor: "pointer",
  transition: "border-color var(--motion-fast) ease, background var(--motion-fast) ease",
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
  userSelect: "none",
  WebkitUserSelect: "none",
  marginBottom: "0.6rem",
});

const optionLabelStyle = {
  fontFamily: "var(--font-body)",
  fontSize: "0.95rem",
  color: "var(--text-1)",
  lineHeight: 1.4,
};

const checkStyle = (selected) => ({
  width: "1.1rem",
  height: "1.1rem",
  borderRadius: "4px",
  border: `2px solid ${selected ? "var(--accent-2)" : "var(--line-2)"}`,
  background: selected ? "var(--accent-2)" : "transparent",
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "border-color var(--motion-fast) ease, background var(--motion-fast) ease",
});

const errorStyle = { color: "var(--bad)", fontSize: "0.8rem", marginTop: "0.75rem" };

const REASONS = [
  { value: "nutrition_focus",  label: "My training is good, but my nutrition could be better" },
  { value: "training_focus",   label: "My nutrition is good, but my training could be better" },
  { value: "lose_weight",      label: "I want to lose weight and get leaner" },
  { value: "build_muscle",     label: "I want to build muscle and gain size" },
  { value: "start_fresh",      label: "I'm starting from scratch and need a full plan" },
  { value: "get_healthier",    label: "I want to get healthier and more consistent" },
  { value: "comeback",         label: "I'm returning after a break and need to get back on track" },
  { value: "specific_goal",    label: "I'm preparing for a specific event or goal" },
];

const MAX_SELECTIONS = 3;

export default function Step09_Reasons({ form, setField, error }) {
  const selected = form.signingUpReasons || [];
  const hasError = error && error.field === "signingUpReasons";

  function toggle(value) {
    if (selected.includes(value)) {
      setField("signingUpReasons", selected.filter((v) => v !== value));
    } else if (selected.length < MAX_SELECTIONS) {
      setField("signingUpReasons", [...selected, value]);
    }
  }

  return (
    <div>
      <h1 style={titleStyle}>Why are you signing up?</h1>
      <p style={subtitleStyle}>Select up to {MAX_SELECTIONS}. At least one required.</p>

      {REASONS.map((opt) => {
        const isSelected = selected.includes(opt.value);
        const isDisabled = !isSelected && selected.length >= MAX_SELECTIONS;

        return (
          <div
            key={opt.value}
            role="checkbox"
            aria-checked={isSelected}
            tabIndex={0}
            style={{
              ...optionStyle(isSelected),
              opacity: isDisabled ? 0.45 : 1,
              cursor: isDisabled ? "not-allowed" : "pointer",
            }}
            onClick={() => !isDisabled && toggle(opt.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                if (!isDisabled) toggle(opt.value);
              }
            }}
          >
            <div style={checkStyle(isSelected)}>
              {isSelected && (
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true">
                  <path d="M1 3.5L3.5 6.5L9 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <span style={optionLabelStyle}>{opt.label}</span>
          </div>
        );
      })}

      {hasError && <p style={errorStyle}>{error.message}</p>}
    </div>
  );
}
