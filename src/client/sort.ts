export type TimeOrder = "asc" | "desc";

export function timeOrderComparator(order: TimeOrder) {
  const sign = order === "asc" ? 1 : -1;
  return (a: string | null, b: string | null) => {
    if (!a && !b) return 0;
    if (!a) return 1;
    if (!b) return -1;
    return sign * a.localeCompare(b);
  };
}
