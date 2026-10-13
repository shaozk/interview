import { readFile } from "node:fs/promises";

const COOKIE = "session";

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`✓ ${msg}`);
}

// 目标地址：SMOKE_BASE_URL 优先，否则从 wrangler.jsonc 的 routes pattern 推导
let base = process.env.SMOKE_BASE_URL;
if (!base) {
  const src = await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  const active = src
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
  const pattern = active.match(/"pattern"\s*:\s*"([^"]+)"/)?.[1];
  if (!pattern) fail("wrangler.jsonc 未配置 routes，且未设置 SMOKE_BASE_URL，无法确定目标地址");
  base = new URL(`https://${pattern.replace(/\/\*$/, "")}`).origin;
}

const EMAIL = "smoke-test@example.com";
const PASSWORD = "test-12345678";

async function call(path, init = {}, cookie) {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
      ...(init.headers ?? {}),
    },
  });
  return res;
}

function sessionCookieOf(res) {
  const raw = res.headers.get("set-cookie");
  const hit = raw
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE}=`));
  return hit && !hit.endsWith("=") ? hit : null;
}

function expect(cond, msg) {
  if (!cond) fail(msg);
  ok(msg);
}

// 1. 未登录访问受保护接口应 401
let res = await call("/api/me");
expect(res.status === 401, "GET /api/me 未登录返回 401");

// 2. 登录既有 smoke 账号（避开注册限流）
res = await call("/api/login", {
  method: "POST",
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
if (res.status === 429) fail("登录触发限流（429），一小时后重试");
expect(res.status === 200, "POST /api/login 返回 200");
const cookie = sessionCookieOf(res);
expect(cookie, "登录下发 session cookie");
if (!cookie) process.exit(1);

// 3. 带 cookie 读取列表（验证 route / D1 建表 / 会话全链路）
res = await call("/api/interviews", {}, cookie);
expect(res.status === 200, "GET /api/interviews 返回 200");
const list = await res.json();
expect(Array.isArray(list), "interviews 返回数组");

// 4. 新建测试条目
res = await call(
  "/api/interviews",
  { method: "POST", body: JSON.stringify({ company: "__smoke__" }) },
  cookie,
);
expect(res.status === 201, "POST /api/interviews 返回 201");
const created = await res.json();
expect(typeof created.id === "string", "创建返回 id");
const id = created.id;
if (!id) process.exit(1);

// 5. 删除测试条目
res = await call(`/api/interviews/${encodeURIComponent(id)}`, { method: "DELETE" }, cookie);
expect(res.status === 200, "DELETE /api/interviews/:id 返回 200");

// 6. 登出
res = await call("/api/logout", { method: "POST" }, cookie);
expect(res.status === 200, "POST /api/logout 返回 200");
if (sessionCookieOf(res) === null) ok("登出清除 session cookie");

console.log(`\n冒烟通过：${base}`);
