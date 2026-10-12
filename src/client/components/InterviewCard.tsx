import {
  PLATFORM_LABELS,
  STATUS_LABELS,
  STATUS_ORDER,
  type Interview,
  type InterviewStatus,
} from "../../shared/types";
import { formatDateTime } from "../format";

interface Props {
  interview: Interview;
  onEdit: (interview: Interview) => void;
  onDelete: (interview: Interview) => void;
  onStatusChange: (interview: Interview, status: InterviewStatus) => void;
}

export function InterviewCard({ interview, onEdit, onDelete, onStatusChange }: Props) {
  const title = interview.company || "未识别公司";
  const sub = [interview.position, interview.round].filter(Boolean).join(" · ");

  return (
    <div className="card" data-status={interview.status}>
      <div className="card-head">
        <div>
          <h3>{title}</h3>
          {sub && <p className="muted">{sub}</p>}
        </div>
        <span className={`badge status-${interview.status}`}>
          {STATUS_LABELS[interview.status]}
        </span>
      </div>

      <dl className="meta">
        <div>
          <dt>时间</dt>
          <dd>{formatDateTime(interview.startTime)}</dd>
        </div>
        <div>
          <dt>平台</dt>
          <dd>{PLATFORM_LABELS[interview.platform]}</dd>
        </div>
        {interview.meetingId && (
          <div>
            <dt>会议号</dt>
            <dd>{interview.meetingId}</dd>
          </div>
        )}
        {interview.password && (
          <div>
            <dt>密码</dt>
            <dd>{interview.password}</dd>
          </div>
        )}
        {interview.interviewers && (
          <div>
            <dt>面试官</dt>
            <dd>{interview.interviewers}</dd>
          </div>
        )}
      </dl>

      <div className="card-actions">
        {interview.meetingUrl && (
          <a className="btn small primary" href={interview.meetingUrl} target="_blank" rel="noreferrer">
            进入会议
          </a>
        )}
        <select
          className="btn small"
          value={interview.status}
          onChange={(e) => onStatusChange(interview, e.target.value as InterviewStatus)}
        >
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <button className="btn small" onClick={() => onEdit(interview)}>
          编辑
        </button>
        <button className="btn small danger" onClick={() => onDelete(interview)}>
          删除
        </button>
      </div>
    </div>
  );
}
