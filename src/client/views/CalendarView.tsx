import { useMemo, useState } from "react";
import type { Interview } from "../../shared/types";
import { PLATFORM_LABELS } from "../../shared/types";
import { WEEKDAYS, dateKey, formatTimeRange, todayKey, tzParts } from "../format";
import { InterviewCard } from "../components/InterviewCard";
import type { ViewProps } from "../viewProps";

type Granularity = "month" | "week" | "day";

const MS_DAY = 86_400_000;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function keyToUtc(key: string): Date {
  const y = Number(key.slice(0, 4));
  const m = Number(key.slice(5, 7));
  const d = Number(key.slice(8, 10));
  return new Date(Date.UTC(y, m - 1, d));
}

function utcToKey(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function CalendarView({ interviews, onEdit, onDelete, onStatusChange }: ViewProps) {
  const [granularity, setGranularity] = useState<Granularity>("month");
  const [anchorKey, setAnchorKey] = useState(() => todayKey());

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

  const today = todayKey();
  const anchorDate = keyToUtc(anchorKey);
  const ay = Number(anchorKey.slice(0, 4));
  const am = Number(anchorKey.slice(5, 7));

  function shift(delta: number) {
    if (granularity === "month") {
      const next = new Date(Date.UTC(anchorDate.getUTCFullYear(), anchorDate.getUTCMonth() + delta, 1));
      const last = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
      next.setUTCDate(Math.min(anchorDate.getUTCDate(), last));
      setAnchorKey(utcToKey(next));
      return;
    }
    const step = granularity === "week" ? 7 : 1;
    setAnchorKey(utcToKey(new Date(anchorDate.getTime() + delta * step * MS_DAY)));
  }

  function renderChip(i: Interview) {
    if (granularity === "week") {
      const sub = [i.position, i.round, PLATFORM_LABELS[i.platform]].filter(Boolean).join(" · ");
      return (
        <button
          key={i.id}
          className={`calendar-chip status-${i.status} week`}
          onClick={() => onEdit(i)}
          title={`${i.company} ${i.position} ${i.round}`}
        >
          <span className="chip-time">{formatTimeRange(i.startTime, i.endTime)}</span>
          <span className="chip-label">{i.company || i.position || "面试"}</span>
          <span className="chip-sub">{sub}</span>
        </button>
      );
    }
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
  }

  function renderCell(key: string, opts: { tall?: boolean; weekday?: boolean } = {}) {
    const items = byDay.get(key) ?? [];
    const dayNum = Number(key.slice(8, 10));
    const isToday = key === today;
    return (
      <div key={key} className={`calendar-cell${isToday ? " today" : ""}${opts.tall ? " tall" : ""}`}>
        <div className="calendar-date">
          {opts.weekday ? `周${WEEKDAYS[keyToUtc(key).getUTCDay()]} ` : ""}
          {dayNum} 日
        </div>
        <div className="calendar-items">
          {items.length === 0 && granularity === "day" ? (
            <p className="calendar-empty-day">当天没有面试安排</p>
          ) : (
            items.map((i) => renderChip(i))
          )}
        </div>
      </div>
    );
  }

  let title: string;
  let cells: React.ReactNode;
  if (granularity === "month") {
    title = `${ay} 年 ${am} 月`;
    const firstWeekday = keyToUtc(`${anchorKey.slice(0, 7)}-01`).getUTCDay();
    const daysInMonth = new Date(Date.UTC(ay, am, 0)).getUTCDate();
    const list: (string | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) list.push(null);
    for (let d = 1; d <= daysInMonth; d++) list.push(`${anchorKey.slice(0, 7)}-${pad(d)}`);
    cells = (
      <>
        {WEEKDAYS.map((w) => (
          <div key={w} className="calendar-weekday">
            周{w}
          </div>
        ))}
        {list.map((key, idx) =>
          key === null ? (
            <div key={`empty-${idx}`} className="calendar-cell empty" />
          ) : (
            renderCell(key)
          ),
        )}
      </>
    );
  } else if (granularity === "week") {
    const weekStart = new Date(anchorDate.getTime() - anchorDate.getUTCDay() * MS_DAY);
    const weekEnd = new Date(weekStart.getTime() + 6 * MS_DAY);
    const fmt = (d: Date) =>
      d.getUTCMonth() === weekStart.getUTCMonth()
        ? `${d.getUTCDate()} 日`
        : `${d.getUTCMonth() + 1} 月 ${d.getUTCDate()} 日`;
    title = `${weekStart.getUTCFullYear()} 年 ${weekStart.getUTCMonth() + 1} 月 ${fmt(weekStart)} – ${fmt(weekEnd)}`;
    cells = (
      <>
        {WEEKDAYS.map((w) => (
          <div key={w} className="calendar-weekday">
            周{w}
          </div>
        ))}
        {Array.from({ length: 7 }, (_, i) =>
          renderCell(utcToKey(new Date(weekStart.getTime() + i * MS_DAY)), {
            tall: true,
            weekday: true,
          }),
        )}
      </>
    );
  } else {
    title = `${ay} 年 ${am} 月 ${Number(anchorKey.slice(8, 10))} 日 周${WEEKDAYS[anchorDate.getUTCDay()]}`;
    const items = byDay.get(anchorKey) ?? [];
    cells = (
      <div className="calendar-day-list">
        {items.length === 0 ? (
          <div className="card">
            <p className="muted calendar-empty-day">当天没有面试安排</p>
          </div>
        ) : (
          items.map((i) => (
            <InterviewCard
              key={i.id}
              interview={i}
              onEdit={onEdit}
              onDelete={onDelete}
              onStatusChange={onStatusChange}
            />
          ))
        )}
      </div>
    );
  }

  const unit = granularity === "month" ? "月" : granularity === "week" ? "周" : "日";

  return (
    <div className="calendar-view">
      <div className="calendar-head">
        <div className="calendar-scale">
          {(["month", "week", "day"] as const).map((g) => (
            <button
              key={g}
              className={`btn small${granularity === g ? " active" : ""}`}
              onClick={() => setGranularity(g)}
            >
              {g === "month" ? "月" : g === "week" ? "周" : "日"}
            </button>
          ))}
        </div>
        <h2>{title}</h2>
        <div className="calendar-nav">
          <button className="btn small" onClick={() => shift(-1)}>
            ← 上一{unit}
          </button>
          <button className="btn small" onClick={() => setAnchorKey(today)}>
            今天
          </button>
          <button className="btn small" onClick={() => shift(1)}>
            下一{unit} →
          </button>
        </div>
      </div>

      {granularity === "day" ? (
        cells
      ) : (
        <div className="calendar-grid">{cells}</div>
      )}
    </div>
  );
}
