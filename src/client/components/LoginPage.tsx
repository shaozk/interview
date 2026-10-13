import { useState, type FormEvent } from "react";
import { api, type Me } from "../api";

interface Props {
  onAuthed: (me: Me) => void;
}

export function LoginPage({ onAuthed }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      const me =
        mode === "login"
          ? await api.login(email.trim(), password)
          : await api.register(email.trim(), password);
      onAuthed(me);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>面试管理</h1>
        <p className="muted small-text">
          {mode === "login" ? "登录后查看你的面试日程" : "注册一个账号，数据只属于你"}
        </p>
        <label className="field">
          <span>邮箱</span>
          <input
            type="email"
            id="email"
            name="email"
            required
            autoComplete="username email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="field">
          <span>密码（{mode === "register" ? "至少 8 位" : ""}）</span>
          <input
            type="password"
            id="password"
            name="password"
            required
            minLength={mode === "register" ? 8 : undefined}
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="auth-error">{error}</p>}
        <div className="form-actions">
          <button type="submit" className="btn primary" disabled={submitting}>
            {submitting ? "提交中…" : mode === "login" ? "登录" : "注册"}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError(null);
            }}
          >
            {mode === "login" ? "没有账号？注册" : "已有账号？登录"}
          </button>
        </div>
      </form>
    </div>
  );
}
