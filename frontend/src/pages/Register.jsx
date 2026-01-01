import { useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";

function Register() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password
    });

    if (error) {
      setLoading(false);
      setErrorMsg(error.message);
      return;
    }

    const user = data?.user;

    if (user) {
      try {
        const backendUrl = import.meta.env.VITE_BACKEND_URL;

        await fetch(`${backendUrl}/api/profile/init`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            userId: user.id,
            email: user.email
          })
        });
      } catch (err) {}
    }

    setLoading(false);
    setSuccessMsg("Account created. Redirecting to login...");
    setTimeout(() => navigate("/login"), 1500);
  };

  return (
    <div
      style={{
        height: "100vh",
        width: "100vw",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0f0f0f",
        overflow: "hidden"
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          padding: "2.5rem",
          background: "#151515",
          border: "1px solid #222",
          borderRadius: "10px",
          boxSizing: "border-box"
        }}
      >
        <h1 style={{ marginBottom: "1.5rem", textAlign: "center" }}>
          Sign Up
        </h1>

        <form onSubmit={handleRegister}>
          <label style={{ display: "block", marginBottom: "0.4rem" }}>
            Email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: "100%",
              padding: "0.6rem",
              marginBottom: "1.2rem",
              background: "#0f0f0f",
              border: "1px solid #333",
              color: "#fff"
            }}
          />

          <label style={{ display: "block", marginBottom: "0.4rem" }}>
            Password
          </label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: "100%",
              padding: "0.6rem",
              marginBottom: "1.5rem",
              background: "#0f0f0f",
              border: "1px solid #333",
              color: "#fff"
            }}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "0.7rem",
              background: "#2a2a2a",
              border: "1px solid #333",
              color: "#fff",
              cursor: loading ? "default" : "pointer"
            }}
          >
            {loading ? "Creating account..." : "Register"}
          </button>
        </form>

        {errorMsg && (
          <p style={{ color: "#ff6b6b", marginTop: "1rem" }}>{errorMsg}</p>
        )}
        {successMsg && (
          <p style={{ color: "#6bff95", marginTop: "1rem" }}>{successMsg}</p>
        )}
      </div>
    </div>
  );
}

export default Register;
