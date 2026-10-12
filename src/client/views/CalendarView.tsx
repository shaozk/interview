import { useMemo, useState } from "react";
import type { Interview } from "../../shared/types";
import { WEEKDAYS, dateKey, tzParts } from "../format";
import type { ViewProps } from "../viewProps";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function CalendarView({ interviews, onEdit }: ViewProps) {
  const [anchor, setAnchor] = useState(() => {
    const k = dateKey(new Date().toISOString());
    const [y, m] = k.split("-").map(Number);
    return { year: y, month: m };
  });

  const byDay = useMemo(() => {
    const map = new Map<string, Interview[]>();
    for (const i of interviews) {
      if (!i.startTime) continue;
      const key = dateKey(i.startTime);
      const arr = map.get(key) ?? [];
      arr.push(i);
      map.set(key, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));
    }
    return map;
  }, [interviews]);

  const firstWeekday = new Date(Date.UTC(anchor.year, anchor.month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(anchor.year, anchor.month, 0)).getUTCDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function shift(delta: number) {
    setAnchor((prev) => {
      const m = prev.month + delta;
      const year = prev.year + Math.floor((m - 1) / 12);
      const month = ((((m - 1) % 12) + 12) % 12) + 1;
      return { year, month };
    });
  }

  const todayKeyStr = dateKey(new Date().toISOString());

  return (
    <div className="calendar-view">
      <div className="calendar-head">
        <button className="btn small" onClick={() => shift(-1)}>
          ← 上月
        </button>
        <h2>
          {anchor.year} 年 {anchor.month} 月
        </h2>
        <button className="btn small" onClick={() => shift(1)}>
          下月 →
        </button>
      </div>

      <div className="calendar-grid">
        {WEEKDAYS.map((w) => (
          <div key={w} className="calendar-weekday">
            周{w}
          </div>
        ))}
        {cells.map((day, idx) => {
          if (day === null) return <div key={`empty-${idx}`} className="calendar-cell empty" />;
          const key = `${anchor.year}-${pad(anchor.month)}-${pad(day)}`;
          const items = byDay.get(key) ?? [];
          const isToday = key === todayKeyStr;
          return (
            <div key={key} className={`calendar-cell${isToday ? " today" : ""}`}>
              <div className="calendar-date">{day}</div>
              <div className="calendar-items">
                {items.map((i) => {
                  const t = tzParts(i.startTime as string);
                  return (
                    <button
                      key={i.id}
                      className={`calendar-chip status-${i.status}`}
                      onClick={() => onEdit(i)}
                      title={`${i.company} ${i.position} ${i.round}`}
                    >
                      <span className="chip-time">
                        {pad(t.hour)}:{pad(t.minute)}
                      </span>
                      <span className="chip-label">
                        {i.company || i.position || "面试"}
                        {i.round ? ` · ${i.round}` : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
