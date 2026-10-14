import type { Interview, InterviewInput, InterviewStatus, Platform } from "../shared/types";
import {
  clearedSessionCookie,
  hashPassword,
  isExpired,
  parseSessionCookie,
  randomToken,
  sessionCookie,
  sessionExpiry,
  verifyPassword,
  type SessionUser,
} from "./auth";
import { rateLimit } from "./ratelimit";

interface Env {
  DB: D1Database;
  CORS_ORIGINS?: string;
}

interface Row {
  id: string;
  user_id: string | null;
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
  "interviewed",
  "completed",
  "cancelled",
  "rejected",
  "failed",
];
const PLATFORMS: Platform[] = ["feishu", "tencent", "zoom", "teams", "google", "other"];
// 无结束时间的面试：开始 2h 后视为已面试
const INTERVIEWED_FALLBACK_MS = 2 * 60 * 60 * 1000;

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

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = (await request.json()) as unknown;
    return body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const DUMMY_HASH = `pbkdf2$100000$${"0".repeat(32)}$${"0".repeat(64)}`;

function clientIp(request: Request): string {
  return request.headers.get("cf-connecting-ip") ?? "unknown";
}

function corsOrigin(request: Request, env: Env): string | null {
  const allowed = (env.CORS_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const origin = request.headers.get("origin");
  return origin && allowed.includes(origin) ? origin : null;
}

function applyCors(response: Response, origin: string | null): Response {
  if (!origin) return response;
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", origin);
  headers.set("access-control-allow-credentials", "true");
  headers.append("vary", "Origin");
  return new Response(response.body, { status: response.status, headers });
}

async function getSessionUser(db: D1Database, request: Request): Promise<SessionUser | null> {
  const sid = parseSessionCookie(request.headers.get("cookie"));
  if (!sid) return null;
  const row = await db
    .prepare(
      `SELECT u.id, u.email, s.expires_at FROM sessions s
       JOIN users u ON u.id = s.user_id WHERE s.id = ?`,
    )
    .bind(sid)
    .first<{ id: string; email: string; expires_at: string }>();
  if (!row) return null;
  if (isExpired(row.expires_at)) {
    await db.prepare("DELETE FROM sessions WHERE id = ?").bind(sid).run();
    return null;
  }
  return { id: row.id, email: row.email };
}

async function startSession(
  db: D1Database,
  userId: string,
  email: string,
  crossSite: boolean,
): Promise<Response> {
  await db
    .prepare("DELETE FROM sessions WHERE expires_at <= ?")
    .bind(new Date().toISOString())
    .run();
  const sid = randomToken();
  const expiresAt = sessionExpiry();
  await db
    .prepare("INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .bind(sid, userId, expiresAt, new Date().toISOString())
    .run();
  return json({ email }, 200, { "set-cookie": sessionCookie(sid, expiresAt, crossSite) });
}

async function register(db: D1Database, request: Request, crossSite: boolean): Promise<Response> {
  if (!rateLimit(`register:${clientIp(request)}`, 5, RATE_WINDOW_MS)) {
    return json({ error: "尝试过于频繁，请一小时后再试" }, 429);
  }
  const body = await readBody(request);
  if (!body) return json({ error: "请求格式不正确" }, 400);
  const email = str(body.email).trim().toLowerCase();
  const password = str(body.password);
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return json({ error: "邮箱格式不正确" }, 400);
  }
  if (password.length < 8 || password.length > 128) {
    return json({ error: "密码长度需在 8-128 位之间" }, 400);
  }
  const existing = await db.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
  if (existing) return json({ error: "该邮箱已注册" }, 409);
  const id = crypto.randomUUID();
  await db
    .prepare("INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)")
    .bind(id, email, await hashPassword(password), new Date().toISOString())
    .run();
  return startSession(db, id, email, crossSite);
}

async function login(db: D1Database, request: Request, crossSite: boolean): Promise<Response> {
  if (!rateLimit(`login:${clientIp(request)}`, 10, RATE_WINDOW_MS)) {
    return json({ error: "尝试过于频繁，请一小时后再试" }, 429);
  }
  const body = await readBody(request);
  if (!body) return json({ error: "请求格式不正确" }, 400);
  const email = str(body.email).trim().toLowerCase();
  const password = str(body.password);
  const row = await db
    .prepare("SELECT id, password_hash FROM users WHERE email = ?")
    .bind(email)
    .first<{ id: string; password_hash: string }>();
  if (!row) {
    await verifyPassword(password, DUMMY_HASH);
    return json({ error: "邮箱或密码不正确" }, 401);
  }
  if (!(await verifyPassword(password, row.password_hash))) {
    return json({ error: "邮箱或密码不正确" }, 401);
  }
  return startSession(db, row.id, email, crossSite);
}

async function logout(db: D1Database, request: Request, crossSite: boolean): Promise<Response> {
  const sid = parseSessionCookie(request.headers.get("cookie"));
  if (sid) {
    await db.prepare("DELETE FROM sessions WHERE id = ?").bind(sid).run();
  }
  return json({ ok: true }, 200, { "set-cookie": clearedSessionCookie(crossSite) });
}

// 世界时间超过面试结束时间（无结束时间则开始后 2h）后，待面试自动变为已面试
async function materializeInterviewed(db: D1Database, userId: string): Promise<void> {
  const now = new Date().toISOString();
  const startCutoff = new Date(Date.now() - INTERVIEWED_FALLBACK_MS).toISOString();
  await db
    .prepare(
      `UPDATE interviews SET status = 'interviewed', updated_at = ?
       WHERE user_id = ? AND status = 'scheduled'
         AND ((end_time IS NOT NULL AND end_time <= ?)
           OR (end_time IS NULL AND start_time IS NOT NULL AND start_time <= ?))`,
    )
    .bind(now, userId, now, startCutoff)
    .run();
}

async function listInterviews(db: D1Database, userId: string): Promise<Response> {
  await materializeInterviewed(db, userId);
  const { results } = await db
    .prepare(
      `SELECT * FROM interviews WHERE user_id = ?
       ORDER BY (start_time IS NULL), start_time ASC, created_at DESC`,
    )
    .bind(userId)
    .all<Row>();
  return json(results.map(rowToInterview));
}

async function getInterview(db: D1Database, userId: string, id: string): Promise<Response> {
  await materializeInterviewed(db, userId);
  const row = await db
    .prepare("SELECT * FROM interviews WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .first<Row>();
  if (!row) return json({ error: "not found" }, 404);
  return json(rowToInterview(row));
}

async function createInterview(
  db: D1Database,
  userId: string,
  request: Request,
): Promise<Response> {
  const body = await readBody(request);
  if (!body) return json({ error: "请求格式不正确" }, 400);
  const input = normalizeInput(body);
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO interviews
        (id, user_id, company, position, round, start_time, end_time, platform, meeting_url,
         meeting_id, password, interviewers, organizer, status, notes, raw_text, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      userId,
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
  const row = await db
    .prepare("SELECT * FROM interviews WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .first<Row>();
  return json(row ? rowToInterview(row) : { error: "not found" }, 201);
}

async function updateInterview(
  db: D1Database,
  userId: string,
  id: string,
  request: Request,
): Promise<Response> {
  const existing = await db
    .prepare("SELECT id FROM interviews WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .first();
  if (!existing) return json({ error: "not found" }, 404);
  const body = await readBody(request);
  if (!body) return json({ error: "请求格式不正确" }, 400);
  const input = normalizeInput(body);
  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE interviews SET
        company = ?, position = ?, round = ?, start_time = ?, end_time = ?, platform = ?,
        meeting_url = ?, meeting_id = ?, password = ?, interviewers = ?, organizer = ?, status = ?,
        notes = ?, raw_text = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
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
      userId,
    )
    .run();
  const row = await db
    .prepare("SELECT * FROM interviews WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .first<Row>();
  return json(row ? rowToInterview(row) : { error: "not found" });
}

async function deleteInterview(
  db: D1Database,
  userId: string,
  id: string,
): Promise<Response> {
  await db
    .prepare("DELETE FROM interviews WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .run();
  return json({ ok: true });
}

async function handleApi(request: Request, env: Env, crossSite: boolean): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (!path.startsWith("/api/")) {
    return new Response("Not Found", { status: 404 });
  }

  if (path === "/api/register") {
    if (request.method === "POST") return register(env.DB, request, crossSite);
    return json({ error: "method not allowed" }, 405);
  }

  if (path === "/api/login") {
    if (request.method === "POST") return login(env.DB, request, crossSite);
    return json({ error: "method not allowed" }, 405);
  }

  const user = await getSessionUser(env.DB, request);

  if (path === "/api/me") {
    if (request.method !== "GET") return json({ error: "method not allowed" }, 405);
    return user ? json({ email: user.email }) : json({ error: "unauthorized" }, 401);
  }

  if (path === "/api/logout") {
    if (request.method === "POST") return logout(env.DB, request, crossSite);
    return json({ error: "method not allowed" }, 405);
  }

  if (!user) return json({ error: "unauthorized" }, 401);

  if (path === "/api/interviews") {
    if (request.method === "GET") return listInterviews(env.DB, user.id);
    if (request.method === "POST") return createInterview(env.DB, user.id, request);
    return json({ error: "method not allowed" }, 405);
  }

  const match = path.match(/^\/api\/interviews\/([^/]+)$/);
  if (match) {
    const id = decodeURIComponent(match[1]);
    if (request.method === "GET") return getInterview(env.DB, user.id, id);
    if (request.method === "PUT") return updateInterview(env.DB, user.id, id, request);
    if (request.method === "DELETE") return deleteInterview(env.DB, user.id, id);
    return json({ error: "method not allowed" }, 405);
  }

  return json({ error: "not found" }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = corsOrigin(request, env);

    if (origin && request.method === "OPTIONS") {
      return applyCors(
        new Response(null, {
          status: 204,
          headers: {
            "access-control-allow-methods": "GET, POST, PUT, DELETE",
            "access-control-allow-headers": "content-type",
            "access-control-max-age": "86400",
          },
        }),
        origin,
      );
    }

    const crossSite = origin !== null;
    const response = await handleApi(request, env, crossSite);
    return applyCors(response, origin);
  },
} satisfies ExportedHandler<Env>;
