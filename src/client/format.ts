export const TZ = "Asia/Shanghai";
const OFFSET_MIN = 8 * 60;

interface TzParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
}

export function tzParts(iso: string): TzParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  const weekdayName = get("weekday");
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  let hour = Number(get("hour"));
  if (hour === 24) hour = 0;
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour,
    minute: Number(get("minute")),
    weekday: weekdayMap[weekdayName] ?? 0,
  };
}

export function dateKey(iso: string): string {
  const p = tzParts(iso);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function todayKey(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parts;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

export function formatDateTime(iso: string | null): string {
  if (!iso) return "时间待定";
  const p = tzParts(iso);
  return `${p.year}-${pad(p.month)}-${pad(p.day)} 周${WEEKDAYS[p.weekday]} ${pad(p.hour)}:${pad(p.minute)}`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return "时间待定";
  const p = tzParts(iso);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function formatTimeRange(start: string | null, end: string | null): string {
  if (!start) return "时间待定";
  const s = tzParts(start);
  let out = `${pad(s.hour)}:${pad(s.minute)}`;
  if (end) {
    const e = tzParts(end);
    out += ` - ${pad(e.hour)}:${pad(e.minute)}`;
  }
  return out;
}

export function isoToInputValue(iso: string | null): string {
  if (!iso) return "";
  const p = tzParts(iso);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

export function inputValueToIso(value: string): string | null {
  if (!value) return null;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const ms = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - OFFSET_MIN * 60000;
  return new Date(ms).toISOString();
}

export { WEEKDAYS };
