import { useState } from "react";
import { useAuth } from "../context/AuthContext";

function errorMsg(code) {
  switch (code) {
    case "no-account":    return "No account found with this email. Create one below.";
    case "wrong-password":return "Wrong password. Please try again.";
    case "email-in-use":  return "An account with this email already exists. Sign in instead.";
    case "reserved-email":return "That email is reserved for admin.";
    default:              return "Something went wrong. Please try again.";
  }
}

export default function Login() {
  const { login, register } = useAuth();

  const [mode, setMode]       = useState("login");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [showGuide, setShowGuide] = useState(false);

  const [form, setForm] = useState({ name: "", email: "", password: "" });

  const handleChange = (e) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const switchMode = (m) => {
    setMode(m); setError("");
    setForm({ name: "", email: "", password: "" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.email.trim() || !form.password) { setError("fill"); return; }
    if (mode === "register" && !form.name.trim()) { setError("name"); return; }

    setLoading(true);
    try {
      if (mode === "login") {
        await login(form.email, form.password);
      } else {
        await register(form.name.trim(), form.email, form.password);
      }
    } catch (err) {
      console.error("[SolarHub]", err.code, err.message);
      setError(err.code || "unknown");
    } finally {
      setLoading(false);
    }
  };

  const inlineError =
    error === "fill"  ? "Please fill in all fields."  :
    error === "name"  ? "Please enter your name."     :
    error             ? errorMsg(error)               : "";

  return (
    <div className="auth-page">
      <div className="auth-glow auth-glow-1" />
      <div className="auth-glow auth-glow-2" />
      <div className="auth-glow auth-glow-3" />

      <div className="auth-card">

        {/* Brand */}
        <div className="auth-brand">
          <div className="auth-brand-icon">☀️</div>
          <div>
            <h1 className="auth-title">SolarHub</h1>
            <p className="auth-subtitle">Smart Charging Station</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="auth-tabs">
          <button type="button" className={`auth-tab ${mode === "login" ? "active" : ""}`}
            onClick={() => switchMode("login")}>Sign In</button>
          <button type="button" className={`auth-tab ${mode === "register" ? "active" : ""}`}
            onClick={() => switchMode("register")}>Create Account</button>
        </div>

        {/* Form */}
        <form className="auth-form" onSubmit={handleSubmit} noValidate>

          {mode === "register" && (
            <div className="auth-field">
              <label>Full Name</label>
              <input name="name" placeholder="Enter your full name"
                value={form.name} onChange={handleChange} autoComplete="name" />
            </div>
          )}

          <div className="auth-field">
            <label>Email Address</label>
            <input name="email" type="email" placeholder="Enter your email"
              value={form.email} onChange={handleChange} autoComplete="email" />
          </div>

          <div className="auth-field">
            <label>Password</label>
            <input name="password" type="password"
              placeholder={mode === "register" ? "Min. 6 characters" : "Enter your password"}
              value={form.password} onChange={handleChange}
              autoComplete={mode === "login" ? "current-password" : "new-password"} />
          </div>

          {inlineError && (
            <div className="auth-error"><span>⚠</span> {inlineError}</div>
          )}

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading
              ? (mode === "login" ? "Signing in…" : "Creating account…")
              : (mode === "login" ? "Sign In →"   : "Create Account →")}
          </button>
        </form>

        {/* Switch */}
        <p className="auth-switch">
          {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
          <button type="button" className="auth-switch-btn"
            onClick={() => switchMode(mode === "login" ? "register" : "login")}>
            {mode === "login" ? "Create one" : "Sign in"}
          </button>
        </p>

        {/* Admin hint */}
        {mode === "login" && (
          <div className="auth-admin-hint">
            <span className="hint-icon">🔐</span>
            <div>
              <strong>Admin Access</strong>
            </div>
          </div>
        )}

        {/* DB path info */}
        <div className="auth-firebase-guide">
          <button type="button" className="guide-toggle"
            onClick={() => setShowGuide(!showGuide)}>
            <span>📦</span>
            <span>Where credentials are stored</span>
            <span className="guide-arrow">{showGuide ? "▲" : "▼"}</span>
          </button>
          {showGuide && (
            <div className="guide-steps">
              <p className="guide-step">
                <span className="step-num">✓</span>
                All user accounts are saved in your Firebase Realtime Database
              </p>
              <div className="guide-db-note">
                <strong>📍 Path:</strong>
                <code>Solar / Users / &lt;uid&gt;</code>
              </div>
              <div className="guide-db-note" style={{marginTop:"8px"}}>
                <strong>🔑 Fields:</strong>
                <code>name, email, password, role, createdAt</code>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
