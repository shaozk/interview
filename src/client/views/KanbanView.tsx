import {
  STATUS_LABELS,
  STATUS_ORDER,
  type InterviewStatus,
} from "../../shared/types";
import { formatDateTime } from "../format";
import type { ViewProps } from "../viewProps";

export function KanbanView({ interviews, onEdit, onStatusChange }: ViewProps) {
  return (
    <div className="kanban">
      {STATUS_ORDER.map((status) => {
        const items = interviews
          .filter((i) => i.status === status)
          .sort((a, b) => (a.startTime ?? "~").localeCompare(b.startTime ?? "~"));
        return (
          <div key={status} className="kanban-column">
            <header className={`kanban-head status-${status}`}>
              <span>{STATUS_LABELS[status]}</span>
              <span className="count">{items.length}</span>
            </header>
            <div className="kanban-body">
              {items.map((i) => (
                <div key={i.id} className="kanban-card">
                  <button className="kanban-title" onClick={() => onEdit(i)}>
                    {i.company || "未识别公司"}
                  </button>
                  <div className="muted small-text">
                    {[i.position, i.round].filter(Boolean).join(" · ") || "—"}
                  </div>
                  <div className="small-text">{formatDateTime(i.startTime)}</div>
                  <select
                    className="btn small"
                    value={i.status}
                    onChange={(e) => onStatusChange(i, e.target.value as InterviewStatus)}
                  >
                    {STATUS_ORDER.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              {items.length === 0 && <p className="empty small-text">空</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
