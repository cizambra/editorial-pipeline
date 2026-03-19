import { useState } from "react";
import { useAuth } from "../lib/auth-context";

export function LoginOverlay() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "var(--background)" }}>
      <div className="w-full max-w-sm p-8 rounded-2xl" style={{ background: "var(--card)", border: "1px solid rgba(var(--border-rgb),0.14)" }}>
        <div className="mb-6">
          <div style={{ color: "var(--muted-foreground)", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>Editorial system</div>
          <h1 style={{ fontFamily: "Montserrat, sans-serif", fontSize: 28, fontWeight: 800, letterSpacing: "-0.05em", textTransform: "lowercase" }}>
            self<span style={{ color: "var(--primary)" }}>disciplined</span>
          </h1>
          <p style={{ color: "var(--muted-foreground)", fontSize: 14, marginTop: 4 }}>Sign in to continue</p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)" }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full mt-1 px-3 py-2 rounded-xl outline-none"
              style={{ background: "var(--background)", border: "1px solid rgba(var(--border-rgb),0.2)", fontSize: 14, color: "var(--foreground)" }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)" }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full mt-1 px-3 py-2 rounded-xl outline-none"
              style={{ background: "var(--background)", border: "1px solid rgba(var(--border-rgb),0.2)", fontSize: 14, color: "var(--foreground)" }}
              onKeyDown={e => e.key === "Enter" && handleSubmit(e as any)}
            />
          </div>
          {error && <p style={{ color: "var(--destructive)", fontSize: 13 }}>{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-semibold text-white transition-opacity"
            style={{ background: "var(--primary)", opacity: loading ? 0.7 : 1, fontSize: 14 }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
