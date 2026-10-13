import { useMemo, useState } from "react";
import { STATUS_LABELS, type Interview } from "../../shared/types";
import { TimeOrderToggle } from "../components/TimeOrderToggle";
import { formatDate, formatTimeRange } from "../format";
import { timeOrderComparator, type TimeOrder } from "../sort";
import type { ViewProps } from "../viewProps";

export function TimelineView({ interviews, onEdit }: ViewProps) {
  const [order, setOrder] = useState<TimeOrder>("desc");

  const groups = useMemo(() => {
    const byTime = timeOrderComparator(order);
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
        items: [...items].sort((a, b) => byTime(a.startTime, b.startTime)),
      }))
      .sort((a, b) =>
        byTime(a.items[0]?.startTime ?? null, b.items[0]?.startTime ?? null),
      );
  }, [interviews, order]);

  if (groups.length === 0) return <p className="empty">还没有面试记录</p>;

  return (
    <div className="timeline">
      <div className="timeline-toolbar">
        <TimeOrderToggle order={order} onChange={setOrder} />
      </div>
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
