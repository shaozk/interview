import { useMemo } from "react";
import { STATUS_LABELS, type Interview } from "../../shared/types";
import { formatDate, formatTimeRange } from "../format";
import type { ViewProps } from "../viewProps";

export function TimelineView({ interviews, onEdit }: ViewProps) {
  const groups = useMemo(() => {
    const map = new Map<string, Interview[]>();
    for (const i of interviews) {
      const key = i.company || "未识别公司";
      const arr = map.get(key) ?? [];
      arr.push(i);
      map.set(key, arr);
    }
    return [...map.entries()]
      .map(([company, items]) => ({
        company,
        items: [...items].sort((a, b) =>
          (a.startTime ?? "~").localeCompare(b.startTime ?? "~"),
        ),
      }))
      .sort((a, b) =>
        (a.items[0]?.startTime ?? "~").localeCompare(b.items[0]?.startTime ?? "~"),
      );
  }, [interviews]);

  if (groups.length === 0) return <p className="empty">还没有面试记录</p>;

  return (
    <div className="timeline">
      {groups.map((group) => (
        <section key={group.company} className="timeline-group">
          <h2>{group.company}</h2>
          <div className="timeline-track">
            {group.items.map((i) => (
              <div key={i.id} className="timeline-node">
                <div className={`timeline-dot status-${i.status}`} />
                <div className="timeline-content" onClick={() => onEdit(i)}>
                  <div className="timeline-title">
                    {i.round || "面试"}
                    <span className={`badge status-${i.status}`}>{STATUS_LABELS[i.status]}</span>
                  </div>
                  <div className="small-text muted">
                    {formatDate(i.startTime)} {formatTimeRange(i.startTime, i.endTime)}
                    {i.position ? ` · ${i.position}` : ""}
                  </div>
                  {i.interviewers && (
                    <div className="small-text muted">面试官：{i.interviewers}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
