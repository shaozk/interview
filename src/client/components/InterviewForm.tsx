import { useState } from "react";
import { parseMeeting } from "../../shared/parser";
import {
  PLATFORM_LABELS,
  ROUND_PRESETS,
  STATUS_LABELS,
  STATUS_ORDER,
  type Interview,
  type InterviewInput,
  type InterviewStatus,
  type Platform,
} from "../../shared/types";
import { inputValueToIso, isoToInputValue } from "../format";

interface Props {
  initial?: Interview | null;
  submitting?: boolean;
  onSubmit: (input: InterviewInput) => void;
  onCancel: () => void;
}

function toInput(interview?: Interview | null): InterviewInput {
  if (!interview) {
    return {
      company: "",
      position: "",
      round: "",
      startTime: null,
      endTime: null,
      platform: "other",
      meetingUrl: null,
      meetingId: null,
      password: null,
      interviewers: "",
      status: "scheduled",
      notes: "",
      rawText: "",
    };
  }
  return {
    company: interview.company,
    position: interview.position,
    round: interview.round,
    startTime: interview.startTime,
    endTime: interview.endTime,
    platform: interview.platform,
    meetingUrl: interview.meetingUrl,
    meetingId: interview.meetingId,
    password: interview.password,
    interviewers: interview.interviewers,
    status: interview.status,
    notes: interview.notes,
    rawText: interview.rawText,
  };
}

export function InterviewForm({ initial, submitting, onSubmit, onCancel }: Props) {
  const [form, setForm] = useState<InterviewInput>(() => toInput(initial));
  const [paste, setPaste] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [confidence, setConfidence] = useState<number | null>(null);

  function set<K extends keyof InterviewInput>(key: K, value: InterviewInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleParse() {
    if (!paste.trim()) return;
    const result = parseMeeting(paste);
    const m = result.meeting;
    setForm((prev) => ({
      ...prev,
      company: m.company || prev.company,
      position: m.position || prev.position,
      round: m.round || prev.round,
      startTime: m.startTime ?? prev.startTime,
      endTime: m.endTime ?? prev.endTime,
      platform: m.platform !== "other" ? m.platform : prev.platform,
      meetingUrl: m.meetingUrl ?? prev.meetingUrl,
      meetingId: m.meetingId ?? prev.meetingId,
      password: m.password ?? prev.password,
      interviewers: m.interviewers || prev.interviewers,
      rawText: paste,
    }));
    setWarnings(result.warnings);
    setConfidence(result.confidence);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({ ...form, rawText: form.rawText || paste });
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="paste-block">
        <label className="field">
          <span>粘贴会议内容（自动解析）</span>
          <textarea
            rows={5}
            placeholder="把飞书 / 腾讯会议 / Zoom / Teams 的会议邀请或邮件正文粘贴到这里，然后点解析"
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
          />
        </label>
        <div className="paste-actions">
          <button type="button" className="btn" onClick={handleParse}>
            解析
          </button>
          {confidence !== null && (
            <span className="confidence">
              识别度 {Math.round(confidence * 100)}%
            </span>
          )}
        </div>
        {warnings.length > 0 && (
          <ul className="warnings">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid">
        <label className="field">
          <span>公司</span>
          <input value={form.company} onChange={(e) => set("company", e.target.value)} />
        </label>
        <label className="field">
          <span>职位</span>
          <input value={form.position} onChange={(e) => set("position", e.target.value)} />
        </label>
        <label className="field">
          <span>轮次</span>
          <input
            list="round-presets"
            value={form.round}
            onChange={(e) => set("round", e.target.value)}
          />
          <datalist id="round-presets">
            {ROUND_PRESETS.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </label>
        <label className="field">
          <span>状态</span>
          <select
            value={form.status}
            onChange={(e) => set("status", e.target.value as InterviewStatus)}
          >
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>开始时间（北京时间）</span>
          <input
            type="datetime-local"
            value={isoToInputValue(form.startTime)}
            onChange={(e) => set("startTime", inputValueToIso(e.target.value))}
          />
        </label>
        <label className="field">
          <span>结束时间</span>
          <input
            type="datetime-local"
            value={isoToInputValue(form.endTime)}
            onChange={(e) => set("endTime", inputValueToIso(e.target.value))}
          />
        </label>
        <label className="field">
          <span>平台</span>
          <select
            value={form.platform}
            onChange={(e) => set("platform", e.target.value as Platform)}
          >
            {(Object.keys(PLATFORM_LABELS) as Platform[]).map((p) => (
              <option key={p} value={p}>
                {PLATFORM_LABELS[p]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>会议号</span>
          <input value={form.meetingId ?? ""} onChange={(e) => set("meetingId", e.target.value || null)} />
        </label>
        <label className="field">
          <span>密码</span>
          <input value={form.password ?? ""} onChange={(e) => set("password", e.target.value || null)} />
        </label>
        <label className="field">
          <span>会议链接</span>
          <input value={form.meetingUrl ?? ""} onChange={(e) => set("meetingUrl", e.target.value || null)} />
        </label>
        <label className="field full">
          <span>面试官</span>
          <input
            value={form.interviewers}
            onChange={(e) => set("interviewers", e.target.value)}
          />
        </label>
        <label className="field full">
          <span>备注</span>
          <textarea
            rows={3}
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </label>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn primary" disabled={submitting}>
          {submitting ? "保存中…" : "保存"}
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          取消
        </button>
      </div>
    </form>
  );
}
