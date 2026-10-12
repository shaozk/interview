import type { Interview, InterviewInput, InterviewStatus, Platform } from "../shared/types";

interface Env {
  DB: D1Database;
}

interface Row {
  id: string;
  company: string;
  position: string;
  round: string;
  start_time: string | null;
  end_time: string | null;
  platform: string;
  meeting_url: string | null;
  meeting_id: string | null;
  password: string | null;
  interviewers: string;
  organizer: string;
  status: string;
  notes: string;
  raw_text: string;
  created_at: string;
  updated_at: string;
}

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS interviews (
  id TEXT PRIMARY KEY,
  company TEXT NOT NULL DEFAULT '',
  position TEXT NOT NULL DEFAULT '',
  round TEXT NOT NULL DEFAULT '',
  start_time TEXT,
  end_time TEXT,
  platform TEXT NOT NULL DEFAULT 'other',
  meeting_url TEXT,
  meeting_id TEXT,
  password TEXT,
  interviewers TEXT NOT NULL DEFAULT '',
  organizer TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'scheduled',
  notes TEXT NOT NULL DEFAULT '',
  raw_text TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`,
  `CREATE INDEX IF NOT EXISTS idx_interviews_start ON interviews(start_time)`,
];

const MIGRATIONS = [
  `ALTER TABLE interviews ADD COLUMN organizer TEXT NOT NULL DEFAULT ''`,
];

let schemaReady = false;

async function ensureSchema(db: D1Database): Promise<void> {
  if (schemaReady) return;
  for (const sql of SCHEMA_STATEMENTS) {
    await db.prepare(sql).run();
  }
  const { results } = await db
    .prepare(`SELECT name FROM pragma_table_info('interviews')`)
    .all<{ name: string }>();
  const columns = new Set(results.map((r) => r.name));
  for (const sql of MIGRATIONS) {
    const target = sql.match(/ADD COLUMN\s+(\w+)/i)?.[1];
    if (target && columns.has(target)) continue;
    await db.prepare(sql).run();
  }
  schemaReady = true;
}

function rowToInterview(row: Row): Interview {
  return {
    id: row.id,
    company: row.company ?? "",
    position: row.position ?? "",
    round: row.round ?? "",
    startTime: row.start_time,
    endTime: row.end_time,
    platform: (row.platform as Platform) ?? "other",
    meetingUrl: row.meeting_url,
    meetingId: row.meeting_id,
    password: row.password,
    interviewers: row.interviewers ?? "",
    organizer: row.organizer ?? "",
    status: (row.status as InterviewStatus) ?? "scheduled",
    notes: row.notes ?? "",
    rawText: row.raw_text ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const STATUSES: InterviewStatus[] = [
  "to-schedule",
  "scheduled",
  "completed",
  "cancelled",
  "rejected",
  "failed",
];
const PLATFORMS: Platform[] = ["feishu", "tencent", "zoom", "teams", "google", "other"];

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nullableStr(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function normalizeInput(body: Record<string, unknown>): InterviewInput {
  const status = str(body.status, "scheduled");
  const platform = str(body.platform, "other");
  return {
    company: str(body.company),
    position: str(body.position),
    round: str(body.round),
    startTime: nullableStr(body.startTime),
    endTime: nullableStr(body.endTime),
    platform: (PLATFORMS.includes(platform as Platform) ? platform : "other") as Platform,
    meetingUrl: nullableStr(body.meetingUrl),
    meetingId: nullableStr(body.meetingId),
    password: nullableStr(body.password),
    interviewers: str(body.interviewers),
    organizer: str(body.organizer),
    status: (STATUSES.includes(status as InterviewStatus) ? status : "scheduled") as InterviewStatus,
    notes: str(body.notes),
    rawText: str(body.rawText),
  };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function listInterviews(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT * FROM interviews
     ORDER BY (start_time IS NULL), start_time ASC, created_at DESC`,
  ).all<Row>();
  return json(results.map(rowToInterview));
}

async function getInterview(env: Env, id: string): Promise<Response> {
  const row = await env.DB.prepare("SELECT * FROM interviews WHERE id = ?").bind(id).first<Row>();
  if (!row) return json({ error: "not found" }, 404);
  return json(rowToInterview(row));
}

async function createInterview(env: Env, request: Request): Promise<Response> {
  const body = (await request.json()) as Record<string, unknown>;
  const input = normalizeInput(body);
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO interviews
      (id, company, position, round, start_time, end_time, platform, meeting_url,
       meeting_id, password, interviewers, organizer, status, notes, raw_text, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      input.company,
      input.position,
      input.round,
      input.startTime,
      input.endTime,
      input.platform,
      input.meetingUrl,
      input.meetingId,
      input.password,
      input.interviewers,
      input.organizer,
      input.status,
      input.notes,
      input.rawText,
      now,
      now,
    )
    .run();
  const row = await env.DB.prepare("SELECT * FROM interviews WHERE id = ?").bind(id).first<Row>();
  return json(row ? rowToInterview(row) : { error: "not found" }, 201);
}

async function updateInterview(env: Env, id: string, request: Request): Promise<Response> {
  const existing = await env.DB.prepare("SELECT * FROM interviews WHERE id = ?").bind(id).first<Row>();
  if (!existing) return json({ error: "not found" }, 404);
  const body = (await request.json()) as Record<string, unknown>;
  const input = normalizeInput(body);
  const now = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE interviews SET
      company = ?, position = ?, round = ?, start_time = ?, end_time = ?, platform = ?,
      meeting_url = ?, meeting_id = ?, password = ?, interviewers = ?, organizer = ?, status = ?,
      notes = ?, raw_text = ?, updated_at = ?
     WHERE id = ?`,
  )
    .bind(
      input.company,
      input.position,
      input.round,
      input.startTime,
      input.endTime,
      input.platform,
      input.meetingUrl,
      input.meetingId,
      input.password,
      input.interviewers,
      input.organizer,
      input.status,
      input.notes,
      input.rawText,
      now,
      id,
    )
    .run();
  const row = await env.DB.prepare("SELECT * FROM interviews WHERE id = ?").bind(id).first<Row>();
  return json(row ? rowToInterview(row) : { error: "not found" });
}

async function deleteInterview(env: Env, id: string): Promise<Response> {
  await env.DB.prepare("DELETE FROM interviews WHERE id = ?").bind(id).run();
  return json({ ok: true });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (!path.startsWith("/api/")) {
      return new Response("Not Found", { status: 404 });
    }

    await ensureSchema(env.DB);

    if (path === "/api/interviews") {
      if (request.method === "GET") return listInterviews(env);
      if (request.method === "POST") return createInterview(env, request);
      return json({ error: "method not allowed" }, 405);
    }

    const match = path.match(/^\/api\/interviews\/([^/]+)$/);
    if (match) {
      const id = decodeURIComponent(match[1]);
      if (request.method === "GET") return getInterview(env, id);
      if (request.method === "PUT") return updateInterview(env, id, request);
      if (request.method === "DELETE") return deleteInterview(env, id);
      return json({ error: "method not allowed" }, 405);
    }

    return json({ error: "not found" }, 404);
  },
} satisfies ExportedHandler<Env>;
