import { readFile } from "node:fs/promises";

const PLACEHOLDER = "00000000-0000-0000-0000-000000000000";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let fail = (msg) => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};

const raw = await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8");
const src = raw
  .split("\n")
  .filter((line) => !line.trim().startsWith("//"))
  .join("\n");

const id = src.match(/"database_id"\s*:\s*"([^"]+)"/)?.[1];
if (!id) fail("wrangler.jsonc 缺少 d1_databases.database_id——先 npx wrangler d1 create interview-db");
if (id === PLACEHOLDER || !UUID_RE.test(id))
  fail(`database_id 是占位符或格式非法（${id}）——填入 wrangler d1 create 返回的真实 ID`);

if (!/"routes"\s*:/.test(src)) {
  console.warn("⚠ 未配置 routes：线上将依赖 *.workers.dev 域名，大陆可能无法直连");
}

console.log("✓ wrangler.jsonc 配置检查通过");
