import type { Interview } from "../shared/types";
import { WEEKDAYS, dateKey, todayKey, tzParts } from "./format";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function rangeLabel(start: string, end: string | null): string {
  const s = tzParts(start);
  let label = `${pad(s.hour)}:${pad(s.minute)}`;
  if (end) {
    const e = tzParts(end);
    label += `-${pad(e.hour)}:${pad(e.minute)}`;
  }
  return label;
}

export function buildMonthSchedule(
  interviews: Interview[],
  now: Date = new Date(),
): string {
  const [year, month] = todayKey(now).split("-").map(Number);
  const today = todayKey(now);
  const items = interviews
    .filter((i) => {
      if (!i.startTime) return false;
      if (i.status === "cancelled") return false;
      const p = tzParts(i.startTime);
      if (p.year !== year || p.month !== month) return false;
      return dateKey(i.startTime) >= today;
    })
    .sort((a, b) => (a.startTime as string).localeCompare(b.startTime as string));

  const header = `${year}年${month}月 日程（今天起的已占用时段，共 ${items.length} 项）`;
  if (items.length === 0) {
    return `${header}\n\n今天起本月暂无安排`;
  }

  const lines = items.map((i) => {
    const s = tzParts(i.startTime as string);
    return `${month}月${s.day}日（周${WEEKDAYS[s.weekday]}）  ${rangeLabel(
      i.startTime as string,
      i.endTime,
    )}  已占用`;
  });

  return [`${header}`, "", ...lines].join("\n");
}
