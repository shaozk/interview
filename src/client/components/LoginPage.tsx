import { useState, type FormEvent } from "react";
import { api, type Me } from "../api";
import { GitHubLink } from "./GitHubLink";

interface Props {
  onAuthed: (me: Me) => void;
}

export function LoginPage({ onAuthed }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [succeeded, setSucceeded] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      const me =
        mode === "login"
          ? await api.login(email.trim(), password)
          : await api.register(email.trim(), password);
      setSucceeded(true);
      // 停留片刻再切换视图：立即卸载表单会让浏览器密码管理器丢弃保存提示
      await new Promise((resolve) => setTimeout(resolve, 500));
      onAuthed(me);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-brand">
        <img
          className="auth-logo"
          src={`${import.meta.env.BASE_URL}logo.svg`}
          alt="面面 logo"
        />
        <h1>面面</h1>
        <p className="auth-tagline">面试日程集中管理 —— 粘贴邀请即建档，数据只属于你。</p>
        <div className="auth-section">
          <h2>主要功能</h2>
          <ul>
            <li>
              粘贴飞书 / 腾讯会议 / Zoom / Teams / 邮件邀请，自动解析公司、职位、轮次、时间与会议号
            </li>
            <li>列表、日历（月 / 周 / 日）、看板、时间线四种视图</li>
            <li>一键导出给 HR 的占用时段；面试结束后自动标记「已面试」</li>
            <li>数据只存在你自己的 Cloudflare，按账号隔离</li>
          </ul>
        </div>
        <div className="auth-section">
          <h2>使用方法</h2>
          <ol>
            <li>注册并登录</li>
            <li>把面试邀请正文粘贴进「新建面试」，自动解析回填</li>
            <li>在日历 / 看板管理进度，面试前从卡片一键入会</li>
          </ol>
        </div>
      </div>
      <form className="auth-card" onSubmit={handleSubmit}>
        <p className="auth-lead">{mode === "login" ? "登录" : "注册"}</p>
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
            autoComplete="username"
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
        {succeeded && (
          <p className="auth-success">{mode === "login" ? "登录成功" : "注册成功"}，正在进入…</p>
        )}
        <div className="form-actions">
          <button type="submit" className="btn primary" disabled={submitting}>
            {succeeded
              ? "成功"
              : submitting
                ? "提交中…"
                : mode === "login"
                  ? "登录"
                  : "注册"}
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
        <div className="auth-footer">
          <GitHubLink />
        </div>
      </form>
    </div>
  );
}
