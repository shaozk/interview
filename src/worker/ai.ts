import type { ParsedMeeting, Platform } from "../shared/types";

const PLATFORMS: Platform[] = ["feishu", "tencent", "zoom", "teams", "google", "other"];

export interface AiEnv {
  AI_API_KEY?: string;
  AI_BASE_URL?: string;
  AI_MODEL?: string;
}

const DEFAULT_BASE_URL = "https://open.bigmodel.cn/api/paas/v4";
const DEFAULT_MODEL = "glm-4-flash";

const SYSTEM_PROMPT = `你是面试邀请解析器。从用户给的会议邀请/邮件正文中提取字段，只输出一个 JSON 对象，不要输出任何其它文字。

字段 schema（全部字段必须出现，未知值置 null 或空字符串）：
{
  "company": "公司品牌名，如：智驾新程（上海）智能科技有限公司 → 智驾新程；无则 \"\"",
  "position": "职位名，去掉工程师/专员等后缀亦可，如：智驾应用软件开发工程师 → 智驾应用软件开发",
  "round": "轮次，归一化为：笔试/一面/二面/三面/四面/五面/终面/HR面/群面/交叉面/加面；初面→一面，复面→二面；无则 \"一面\"",
  "startTime": "开始时间，ISO 8601 含时区（北京时间请用 +08:00），如 2026-10-14T19:00:00+08:00；无则 null",
  "endTime": "结束时间，同上；无则 null",
  "platform": "feishu|tencent|zoom|teams|google|other 之一",
  "meetingUrl": "入会链接 URL；无则 null",
  "meetingId": "会议号，仅数字/连字符；无则 null",
  "password": "会议密码；无则 null",
  "interviewers": "面试官姓名，多人用、分隔；无则 \"\"",
  "organizer": "组织者；无则 \"\"",
  "notes": "注意事项（着装、材料、链接说明等），一段话；无则 \"\"",
  "confidence": 0 到 1 的小数，整体识别把握
}

规则：
- 正文中的时间多为北京时间（GMT+8），转成 +08:00 的 ISO 8601
- 相对时间（如"明天下午3点"）一律置 null，不要猜测
- 不要编造任何正文中不存在的信息`;

interface ChatChoice {
  message?: { content?: string };
}

interface ChatResponse {
  choices?: ChatChoice[];
}

function asString(v: unknown, maxLen: number): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, maxLen);
}

function asNullableString(v: unknown, maxLen: number): string | null {
  const s = asString(v, maxLen);
  return s === "" ? null : s;
}

function asIsoOrNull(v: unknown): string | null {
  const s = asString(v, 64);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function asPlatform(v: unknown): Platform {
  return PLATFORMS.includes(v as Platform) ? (v as Platform) : "other";
}

/** 模型输出 → 受信的 ParsedMeeting：字段级白名单清洗，防幻觉字段/非法值入库 */
export function sanitizeParsed(raw: unknown): ParsedMeeting {
  const obj = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const confidence = typeof obj.confidence === "number" && Number.isFinite(obj.confidence)
    ? Math.min(1, Math.max(0, obj.confidence))
    : 0.5;
  return {
    company: asString(obj.company, 120),
    position: asString(obj.position, 120),
    round: asString(obj.round, 20) || "一面",
    startTime: asIsoOrNull(obj.startTime),
    endTime: asIsoOrNull(obj.endTime),
    platform: asPlatform(obj.platform),
    meetingUrl: asNullableString(obj.meetingUrl, 2048),
    meetingId: asNullableString(obj.meetingId, 64),
    password: asNullableString(obj.password, 64),
    interviewers: asString(obj.interviewers, 200),
    organizer: asString(obj.organizer, 120),
    notes: asString(obj.notes, 2000),
    warnings: [],
    confidence,
  };
}

export async function parseWithAI(text: string, env: AiEnv): Promise<ParsedMeeting> {
  if (!env.AI_API_KEY) {
    throw new AiNotConfiguredError();
  }
  const base = (env.AI_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const model = env.AI_MODEL ?? DEFAULT_MODEL;
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.AI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: text.slice(0, 8000) },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`AI 服务返回 ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
  }
  const data = (await res.json()) as ChatResponse;
  const content = data.choices?.[0]?.message?.content ?? "";
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    throw new Error("AI 返回的不是有效 JSON，请重试或改用本地解析");
  }
  return sanitizeParsed(raw);
}

export class AiNotConfiguredError extends Error {
  constructor() {
    super("AI 解析未配置：请先设置 AI_API_KEY");
    this.name = "AiNotConfiguredError";
  }
}
