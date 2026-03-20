import { useState } from "react";

const titleStyle = {
  fontFamily: "var(--font-display)",
  fontSize: "clamp(1.6rem, 4vw, 2.4rem)",
  fontWeight: 700,
  color: "var(--text-1)",
  marginBottom: "1.25rem",
  letterSpacing: "-0.02em",
  lineHeight: 1.2,
};

const sectionStyle = {
  border: "1.5px solid var(--line-1)",
  borderRadius: "var(--radius-md)",
  background: "var(--surface-2)",
  marginBottom: "0.75rem",
  overflow: "hidden",
};

const sectionHeaderStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "1rem 1.25rem",
  cursor: "pointer",
  userSelect: "none",
  WebkitUserSelect: "none",
};

const sectionTitleStyle = {
  fontFamily: "var(--font-display)",
  fontSize: "0.9rem",
  fontWeight: 700,
  color: "var(--text-1)",
  letterSpacing: "-0.01em",
};

const sectionBodyStyle = {
  padding: "0 1.25rem 1rem",
  fontFamily: "var(--font-body)",
  fontSize: "0.875rem",
  color: "var(--text-2)",
  lineHeight: 1.65,
};

const chevronStyle = (open) => ({
  width: "1rem",
  height: "1rem",
  color: "var(--text-3)",
  transform: open ? "rotate(180deg)" : "rotate(0deg)",
  transition: "transform var(--motion-fast) ease",
  flexShrink: 0,
});

const errorStyle = { color: "var(--bad)", fontSize: "0.8rem", marginTop: "0.4rem" };

const SECTIONS = [
  {
    id: "health",
    title: "Health & medical disclaimer",
    body: `This app provides general fitness and nutrition guidance for informational purposes only. It is not a substitute for professional medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider before starting a new exercise program or making significant changes to your diet — particularly if you have any existing medical conditions, injuries, or take prescribed medication. If you experience pain, dizziness, or any adverse symptoms, stop immediately and seek medical attention. This app is not an emergency service.`,
  },
  {
    id: "ai",
    title: "AI-generated content",
    body: `Training plans, nutrition targets, and recommendations within this app are generated or adjusted by AI models. While these are designed to be helpful and evidence-informed, they are not personalised medical advice and may not account for every individual circumstance. AI-generated content can contain errors. You are responsible for evaluating whether any suggestion is appropriate for your situation.`,
  },
  {
    id: "data",
    title: "Data storage & privacy",
    body: `Your personal data — including name, date of birth, body metrics, training history, and nutrition logs — is stored securely in our database (Supabase). This data is used solely to power your personalised plans and is not sold to third parties. We use industry-standard encryption in transit and at rest. You can request deletion of your account and all associated data at any time by contacting support. By completing setup you agree to our collection and use of this data as described.`,
  },
  {
    id: "age",
    title: "Age requirement",
    body: `You must be at least 13 years old to use this app. By proceeding you confirm that you meet this age requirement. Users under 18 should have parental or guardian consent before following any training or nutrition programme.`,
  },
];

function AccordionSection({ section }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={sectionStyle}>
      <div
        style={sectionHeaderStyle}
        onClick={() => setOpen((v) => !v)}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
      >
        <span style={sectionTitleStyle}>{section.title}</span>
        <svg style={chevronStyle(open)} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      {open && <div style={sectionBodyStyle}>{section.body}</div>}
    </div>
  );
}

export default function Step15_Safety({ form, setField, error }) {
  const accepted = !!form.disclaimerAccepted;
  const hasError = !!error;

  return (
    <div>
      <h1 style={titleStyle}>Before you finish</h1>

      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "0.9rem",
          color: "var(--text-3)",
          marginBottom: "1.25rem",
          lineHeight: 1.5,
        }}
      >
        Please review the sections below, then confirm you understand and accept.
      </p>

      {SECTIONS.map((s) => (
        <AccordionSection key={s.id} section={s} />
      ))}

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
          padding: "1rem 0 0.25rem",
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
            transition: "border-color var(--motion-fast) ease, background var(--motion-fast) ease",
          }}
        >
          {accepted && (
            <svg width="12" height="9" viewBox="0 0 12 9" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M1 4L4.5 7.5L11 1" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>

        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.9rem",
            color: "var(--text-1)",
            lineHeight: 1.5,
            userSelect: "none",
          }}
        >
          I confirm I am healthy enough to exercise, understand this app is not medical advice or an emergency service, and agree to the data storage and AI usage described above.
        </span>
      </div>

      {hasError && <p style={errorStyle}>{error.message}</p>}
    </div>
  );
}
