/**
 * PhysiquePilotLoader
 * Branded loading screen used across every page.
 *
 * Props:
 *   fullscreen  {bool}   – true  → fixed overlay covering 100vw/100vh (used before
 *                                   the app shell renders, e.g. auth guards)
 *                          false → fills the in-page content column (default)
 *   message     {string} – sub-label text (default "LOADING…")
 */
export default function PhysiquePilotLoader({
  fullscreen = false,
  message = "LOADING…",
}) {
  const wrapStyle = fullscreen
    ? {
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "var(--bg-0)",
      }
    : {
        width: "100%",
        minHeight: "60vh",
        flex: 1,
      };

  return (
    <div
      role="status"
      aria-label="Loading"
      style={{
        ...wrapStyle,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: fullscreen ? "fixed" : "relative",
        overflow: "hidden",
      }}
    >
      {/* Radial glow */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(600px 320px at 50% 50%, rgba(165,21,21,0.13), transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Brand wordmark */}
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(1.6rem, 4vw, 2.8rem)",
          fontWeight: 700,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "var(--text-1)",
          display: "flex",
          alignItems: "center",
          gap: "0.7rem",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Blinking status dot */}
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            width: "9px",
            height: "9px",
            borderRadius: "50%",
            background: "var(--accent-3)",
            boxShadow: "0 0 8px var(--accent-2)",
            flexShrink: 0,
            animation: "pp-loader-blink 1.4s step-start infinite",
          }}
        />
        PHYSIQUE PILOT
      </div>

      {/* Sub-label */}
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "0.7rem",
          letterSpacing: "0.22em",
          color: "var(--text-3)",
          marginTop: "0.9rem",
          textTransform: "uppercase",
          position: "relative",
          zIndex: 1,
          animation: "pp-loader-fade 0.6s ease forwards",
        }}
      >
        {message}
      </div>

      {/* Sweeping progress bar at the bottom */}
      <div
        aria-hidden="true"
        style={{
          position: fullscreen ? "fixed" : "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "2px",
          background: "var(--bg-1, #111)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            background:
              "linear-gradient(90deg, var(--accent-1), var(--accent-3) 60%, var(--accent-2))",
            boxShadow: "0 0 10px var(--accent-2)",
            animation: "pp-loader-bar 1.8s cubic-bezier(0.4,0,0.2,1) infinite",
            transformOrigin: "left",
          }}
        />
      </div>

      <style>{`
        @keyframes pp-loader-blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.1; }
        }
        @keyframes pp-loader-fade {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pp-loader-bar {
          0%   { transform: scaleX(0);   opacity: 1; }
          60%  { transform: scaleX(0.7); opacity: 1; }
          100% { transform: scaleX(1);   opacity: 0; }
        }
      `}</style>
    </div>
  );
}
