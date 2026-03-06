const titleStyle = {
  fontFamily: "var(--font-display)",
  fontSize: "clamp(1.6rem, 4vw, 2.4rem)",
  fontWeight: 700,
  color: "var(--text-1)",
  marginBottom: "2rem",
  letterSpacing: "-0.02em",
  lineHeight: 1.2,
};

const errorStyle = { color: "var(--bad)", fontSize: "0.8rem", marginTop: "0.4rem" };

export default function Step15_Safety({ form, setField, error }) {
  const accepted = !!form.disclaimerAccepted;
  const hasError = !!error;

  return (
    <div>
      <h1 style={titleStyle}>One important note</h1>

      {/* Disclaimer box */}
      <div
        style={{
          border: "1.5px solid var(--line-1)",
          borderRadius: "var(--radius-md)",
          padding: "1.25rem 1.5rem",
          background: "var(--surface-2)",
          marginBottom: "1.75rem",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.95rem",
            color: "var(--text-2)",
            lineHeight: 1.65,
            margin: 0,
          }}
        >
          This app provides general fitness and nutrition guidance. It is not
          medical advice. Consult a qualified healthcare professional before
          making significant changes to your diet or exercise programme,
          particularly if you have any medical conditions.
        </p>
      </div>

      {/* Checkbox row */}
      <div
        role="checkbox"
        aria-checked={accepted}
        tabIndex={0}
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "0.75rem",
          cursor: "pointer",
          padding: "0.25rem 0",
        }}
        onClick={() => setField("disclaimerAccepted", !accepted)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setField("disclaimerAccepted", !accepted);
          }
        }}
      >
        {/* Custom checkbox */}
        <div
          style={{
            width: "1.25rem",
            height: "1.25rem",
            borderRadius: "var(--radius-xs, 4px)",
            border: `2px solid ${accepted ? "var(--accent-2)" : hasError ? "var(--bad)" : "var(--line-1)"}`,
            background: accepted ? "var(--accent-2)" : "transparent",
            flexShrink: 0,
            marginTop: "0.1rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition:
              "border-color var(--motion-fast) ease, background var(--motion-fast) ease",
          }}
        >
          {accepted && (
            <svg
              width="12"
              height="9"
              viewBox="0 0 12 9"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M1 4L4.5 7.5L11 1"
                stroke="#fff"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>

        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.95rem",
            color: "var(--text-1)",
            lineHeight: 1.5,
            userSelect: "none",
          }}
        >
          I understand and accept this disclaimer
        </span>
      </div>

      {hasError && <p style={errorStyle}>{error.message}</p>}
    </div>
  );
}
