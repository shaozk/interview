import { useMemo, useState } from "react";
import { STATUS_LABELS, STATUS_ORDER, type InterviewStatus } from "../../shared/types";
import { InterviewCard } from "../components/InterviewCard";
import type { ViewProps } from "../viewProps";

export function ListView({ interviews, onEdit, onDelete, onStatusChange }: ViewProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<InterviewStatus | "all">("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return interviews.filter((i) => {
      if (status !== "all" && i.status !== status) return false;
      if (!q) return true;
      return [i.company, i.position, i.round, i.interviewers, i.notes]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [interviews, query, status]);

  return (
    <div className="list-view">
      <div className="list-toolbar">
        <input
          className="search"
          placeholder="搜索公司 / 职位 / 面试官"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as InterviewStatus | "all")}
        >
          <option value="all">全部状态</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="empty">没有匹配的面试</p>
      ) : (
        <div className="cards">
          {filtered.map((i) => (
            <InterviewCard
              key={i.id}
              interview={i}
              onEdit={onEdit}
              onDelete={onDelete}
              onStatusChange={onStatusChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}
