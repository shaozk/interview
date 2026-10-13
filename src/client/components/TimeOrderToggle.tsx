import type { TimeOrder } from "../sort";

export function TimeOrderToggle({
  order,
  onChange,
}: {
  order: TimeOrder;
  onChange: (order: TimeOrder) => void;
}) {
  return (
    <button
      className="btn small"
      onClick={() => onChange(order === "asc" ? "desc" : "asc")}
    >
      {order === "asc" ? "时间正序 ↓" : "时间倒序 ↑"}
    </button>
  );
}
