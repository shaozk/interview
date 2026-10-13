import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { InterviewForm } from "./components/InterviewForm";
import { ExportDialog } from "./components/ExportDialog";
import { buildMonthSchedule } from "./schedule";
import {
  STATUS_LABELS,
  type Interview,
  type InterviewInput,
  type InterviewStatus,
} from "../shared/types";
import { ListView } from "./views/ListView";
import { CalendarView } from "./views/CalendarView";
import { KanbanView } from "./views/KanbanView";
import { TimelineView } from "./views/TimelineView";
import { LoginPage } from "./components/LoginPage";
import type { Me } from "./api";
import type { ViewProps } from "./viewProps";
import { dateKey, todayKey } from "./format";

type Tab = "list" | "calendar" | "kanban" | "timeline";

const TABS: { key: Tab; label: string }[] = [
  { key: "list", label: "列表" },
  { key: "calendar", label: "日历" },
  { key: "kanban", label: "看板" },
  { key: "timeline", label: "轮次时间线" },
];

function toInput(i: Interview): InterviewInput {
  return {
    company: i.company,
    position: i.position,
    round: i.round,
    startTime: i.startTime,
    endTime: i.endTime,
    platform: i.platform,
    meetingUrl: i.meetingUrl,
    meetingId: i.meetingId,
    password: i.password,
    interviewers: i.interviewers,
    organizer: i.organizer,
    status: i.status,
    notes: i.notes,
    rawText: i.rawText,
  };
}

export function App() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("list");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Interview | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [exportText, setExportText] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  async function load() {
    try {
      setLoading(true);
      setInterviews(await api.list());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void api
      .me()
      .then((user) => {
        setMe(user);
        if (user) void load();
      })
      .catch(() => setMe(null))
      .finally(() => setAuthChecked(true));
  }, []);

  async function handleAuthed(user: Me) {
    setMe(user);
    await load();
  }

  async function handleLogout() {
    try {
      await api.logout();
    } finally {
      setMe(null);
      setInterviews([]);
      setError(null);
      setTab("list");
    }
  }

  function openCreate() {
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(interview: Interview) {
    setEditing(interview);
    setShowForm(true);
  }

  async function handleSubmit(input: InterviewInput) {
    try {
      setSubmitting(true);
      if (editing) {
        const updated = await api.update(editing.id, input);
        setInterviews((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      } else {
        const created = await api.create(input);
        setInterviews((prev) => [...prev, created]);
      }
      setShowForm(false);
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(interview: Interview) {
    if (!window.confirm(`确定删除「${interview.company || "该面试"}」？`)) return;
    try {
      await api.remove(interview.id);
      setInterviews((prev) => prev.filter((i) => i.id !== interview.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleStatusChange(interview: Interview, status: InterviewStatus) {
    const next = { ...toInput(interview), status };
    const updated = { ...interview, status };
    setInterviews((prev) => prev.map((i) => (i.id === interview.id ? updated : i)));
    try {
      await api.update(interview.id, next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      void load();
    }
  }

  const stats = useMemo(() => {
    const upcoming = interviews.filter((i) => {
      if (i.status !== "scheduled" || !i.startTime) return false;
      return dateKey(i.startTime) >= todayKey();
    });
    const byStatus: Record<string, number> = {};
    for (const i of interviews) byStatus[i.status] = (byStatus[i.status] ?? 0) + 1;
    return { total: interviews.length, upcoming: upcoming.length, byStatus };
  }, [interviews]);

  const viewProps: ViewProps = {
    interviews,
    onEdit: openEdit,
    onDelete: handleDelete,
    onStatusChange: handleStatusChange,
  };

  return (
    <div className="app">
      {!authChecked ? (
        <p className="empty">加载中…</p>
      ) : !me ? (
        <LoginPage onAuthed={(user) => void handleAuthed(user)} />
      ) : (
        <>
          <header className="app-header">
            <div>
              <h1>面试管理</h1>
              <p className="muted small-text">
                共 {stats.total} 场 · 待面试 {stats.upcoming} 场
                {Object.entries(stats.byStatus)
                  .filter(([s]) => s !== "scheduled")
                  .map(([s, n]) => ` · ${STATUS_LABELS[s as InterviewStatus]} ${n}`)
                  .join("")}
                {" · "}
                {me.email}
              </p>
            </div>
            <div className="header-actions">
              <button className="btn" onClick={() => void load()}>
                刷新
              </button>
              <button className="btn" onClick={() => setExportText(buildMonthSchedule(interviews))}>
                导出本月日程
              </button>
              <button className="btn" onClick={() => void handleLogout()}>
                退出
              </button>
              <button className="btn primary" onClick={openCreate}>
                + 新建面试
              </button>
            </div>
          </header>

          <nav className="tabs">
            {TABS.map((t) => (
              <button
                key={t.key}
                className={`tab${tab === t.key ? " active" : ""}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {error && (
            <div className="error-bar">
              <span>{error}</span>
              <button className="btn small" onClick={() => setError(null)}>
                关闭
              </button>
            </div>
          )}

          <main className="app-main">
            {loading ? (
              <p className="empty">加载中…</p>
            ) : (
              <>
                {tab === "list" && <ListView {...viewProps} />}
                {tab === "calendar" && <CalendarView {...viewProps} />}
                {tab === "kanban" && <KanbanView {...viewProps} />}
                {tab === "timeline" && <TimelineView {...viewProps} />}
              </>
            )}
          </main>
        </>
      )}

      {showForm && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowForm(false);
          }}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>{editing ? "编辑面试" : "新建面试"}</h2>
              <button className="btn small" onClick={() => setShowForm(false)}>
                关闭
              </button>
            </div>
            <InterviewForm
              key={editing?.id ?? "new"}
              initial={editing}
              submitting={submitting}
              onSubmit={handleSubmit}
              onCancel={() => setShowForm(false)}
            />
          </div>
        </div>
      )}

      {exportText !== null && (
        <ExportDialog text={exportText} onClose={() => setExportText(null)} />
      )}
    </div>
  );
}
