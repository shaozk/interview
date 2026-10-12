import type { ParsedMeeting, ParseResult, Platform } from "./types";

const TZ_OFFSET_MIN = 8 * 60;

const CN_WEEKDAYS: Record<string, number> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  日: 0,
  天: 0,
};

const EN_MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

const KNOWN_COMPANIES = [
  "字节跳动",
  "字节",
  "腾讯",
  "阿里巴巴",
  "阿里云",
  "阿里",
  "蚂蚁集团",
  "蚂蚁",
  "美团",
  "百度",
  "京东",
  "华为",
  "小米",
  "网易",
  "快手",
  "滴滴",
  "拼多多",
  "哔哩哔哩",
  "小红书",
  "知乎",
  "微博",
  "携程",
  "去哪儿",
  "大疆",
  "蔚来",
  "理想",
  "小鹏",
  "比亚迪",
  "宁德时代",
  "商汤",
  "旷视",
  "科大讯飞",
  "海康威视",
  "微软",
  "谷歌",
  "亚马逊",
  "苹果",
  "meta",
  "facebook",
  "shopee",
  "shein",
  "google",
  "microsoft",
  "amazon",
];

const COMPANY_SUFFIX =
  /(有限公司|股份有限公司|集团|科技公司|网络科技|信息技术|数据科技|智能科技|软件公司|科技有限公司|研究院|事务所|工作室)/;

const POSITION_KEYWORDS = [
  "后端开发工程师",
  "前端开发工程师",
  "全栈工程师",
  "算法工程师",
  "客户端开发",
  "测试开发工程师",
  "测试工程师",
  "运维工程师",
  "大数据开发",
  "数据开发工程师",
  "数据分析师",
  "数据挖掘",
  "机器学习工程师",
  "深度学习",
  "推荐算法",
  "搜索算法",
  "广告算法",
  "安全工程师",
  "风控",
  "产品经理",
  "产品运营",
  "项目经理",
  "解决方案",
  "研发工程师",
  "软件工程师",
  "开发工程师",
  "服务端开发",
  "服务端",
  "后端开发",
  "前端开发",
  "后端",
  "前端",
  "全栈",
  "算法",
  "客户端",
  "测试",
  "运维",
  "大数据",
  "数据分析",
  "数据",
  "产品",
  "运营",
  "设计师",
  "交互",
  "Java",
  "Golang",
  "Go",
  "Python",
  "C++",
  "Android",
  "iOS",
  "架构师",
  "实习生",
];

const ROUND_RE =
  /(初面|一面|二面|三面|四面|五面|六面|终面|复试|复面|加面|交叉面|HR面|HR面试|人力面|群面|笔试|在线测评|在线笔试|性格测试|技术面|主管面|总监面|CTO面|部门面|业务面|offer沟通|谈薪|第[一二三四五六七八九十\d]+面)/i;

function normalize(input: string): string {
  return input
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[\u3000\t]/g, " ")
    .replace(/[〜～]/g, "~")
    .replace(/[\u2013\u2014\u2212]/g, "-");
}

function detectPlatform(text: string): Platform {
  const t = text.toLowerCase();
  if (/feishu|lark|飞书|vc\.feishu|meeting\.feishu/.test(t)) return "feishu";
  if (/腾讯会议|tencent|voov|meeting\.tencent/.test(t)) return "tencent";
  if (/zoom\.us|zoom\.com|\bzoom\b/.test(t)) return "zoom";
  if (/teams\.microsoft|microsoft teams|\bteams\b/.test(t)) return "teams";
  if (/meet\.google|google meet/.test(t)) return "google";
  return "other";
}

function extractUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s<>"'（）()【】\[\]，,。]+/i);
  if (!m) return null;
  return m[0].replace(/[）()】\]（(【\[]+$/, "");
}

function extractMeetingId(text: string): string | null {
  const label =
    /(?:会议\s*(?:号|号码|ID)|会议ID|Meeting\s*ID|Tencent\s*Meeting\s*ID|Meeting\s*Number)/i;
  const li = text.search(label);
  if (li >= 0) {
    const rest = text.slice(li).replace(label, "");
    const digits = rest.match(/([0-9][0-9\s]{7,}[0-9])/);
    if (digits) {
      const joined = digits[1].replace(/\s+/g, "");
      if (joined.length >= 8 && joined.length <= 13) return joined;
    }
  }
  const tencent = text.match(/腾讯会议\s*[:：]?\s*(\d{3}[- ]?\d{3}[- ]?\d{3,4})/);
  if (tencent) return tencent[1].replace(/[-\s]/g, "");
  const dashed = text.match(/\b(\d{3})[-\s](\d{3})[-\s](\d{3,4})\b/);
  if (dashed) return `${dashed[1]}${dashed[2]}${dashed[3]}`;
  const standalone = text.match(/\b\d{9,11}\b/);
  if (standalone) return standalone[0];
  return null;
}

function extractPassword(text: string): string | null {
  const m = text.match(
    /(?:入会密码|会议密码|访问密码|密码|Passcode|Password|访问码)\s*[:：]?\s*([A-Za-z0-9]{4,12})/i,
  );
  return m ? m[1] : null;
}

interface TimeToken {
  index: number;
  length: number;
  hour: number;
  minute: number;
  explicit: boolean;
}

const PERIOD_PM = ["下午", "傍晚", "晚上", "夜间"];
const PERIOD_AM = ["凌晨", "早上", "清晨", "上午"];

function to24h(
  hour: number,
  period: string | undefined,
  meridiem: string | undefined,
): { hour: number; explicit: boolean } {
  let h = hour;
  if (meridiem) {
    const m = meridiem.toLowerCase();
    if (m === "pm" && h < 12) h += 12;
    if (m === "am" && h === 12) h = 0;
    return { hour: h, explicit: true };
  }
  if (period) {
    if (PERIOD_PM.includes(period) && h < 12) h += 12;
    else if (period === "中午") h = h < 11 ? 12 : h;
    else if (PERIOD_AM.includes(period) && h === 12) h = 0;
    return { hour: h, explicit: true };
  }
  if (h >= 1 && h <= 7) return { hour: h + 12, explicit: false };
  return { hour: h, explicit: true };
}

function collectTimeTokens(text: string): TimeToken[] {
  const tokens: TimeToken[] = [];
  const reColon =
    /(凌晨|早上|清晨|上午|中午|下午|傍晚|晚上|夜间)?\s*(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?/gi;
  const reDian =
    /(凌晨|早上|清晨|上午|中午|下午|傍晚|晚上|夜间)?\s*(\d{1,2})\s*[点时](?:(\d{1,2})\s*分?|半)?\s*(am|pm)?/gi;

  let m: RegExpExecArray | null;
  while ((m = reColon.exec(text))) {
    const { hour, explicit } = to24h(Number(m[2]), m[1], m[4]);
    tokens.push({
      index: m.index,
      length: m[0].length,
      hour,
      minute: Number(m[3]),
      explicit,
    });
  }
  while ((m = reDian.exec(text))) {
    const minute = m[3] !== undefined ? Number(m[3]) : /半/.test(m[0]) ? 30 : 0;
    const { hour, explicit } = to24h(Number(m[2]), m[1], m[4]);
    tokens.push({ index: m.index, length: m[0].length, hour, minute, explicit });
  }
  if (tokens.length === 0) {
    const reMeridiem = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/gi;
    while ((m = reMeridiem.exec(text))) {
      const { hour, explicit } = to24h(Number(m[1]), undefined, m[3]);
      tokens.push({
        index: m.index,
        length: m[0].length,
        hour,
        minute: m[2] ? Number(m[2]) : 0,
        explicit,
      });
    }
  }
  tokens.sort((a, b) => a.index - b.index);
  const deduped: TimeToken[] = [];
  let lastEnd = -1;
  for (const t of tokens) {
    if (t.index < lastEnd) continue;
    deduped.push(t);
    lastEnd = t.index + t.length;
  }
  return deduped;
}

interface DateParts {
  year: number | null;
  month: number;
  day: number;
  fromWeekday: boolean;
}

function findDate(text: string): DateParts | null {
  let m = text.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]?/);
  if (m) return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]), fromWeekday: false };

  m = text.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]), fromWeekday: false };

  m = text.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]/);
  if (m) return { year: null, month: Number(m[1]), day: Number(m[2]), fromWeekday: false };

  m = text.match(
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})?/i,
  );
  if (m) {
    const month = EN_MONTHS[m[1].slice(0, 3).toLowerCase()];
    return { year: m[3] ? Number(m[3]) : null, month, day: Number(m[2]), fromWeekday: false };
  }

  m = text.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s*(\d{4})?/i,
  );
  if (m) {
    const month = EN_MONTHS[m[2].slice(0, 3).toLowerCase()];
    return { year: m[3] ? Number(m[3]) : null, month, day: Number(m[1]), fromWeekday: false };
  }
  return null;
}

function findWeekday(text: string): number | null {
  const m = text.match(/(?:周|星期|礼拜)\s*([一二三四五六日天])/);
  if (!m) return null;
  return CN_WEEKDAYS[m[1]];
}

function isoFrom(parts: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}): string {
  const ms =
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute) -
    TZ_OFFSET_MIN * 60000;
  return new Date(ms).toISOString();
}

interface TimeResult {
  startTime: string | null;
  endTime: string | null;
  warnings: string[];
}

function extractDateTime(text: string, now: Date): TimeResult {
  const warnings: string[] = [];
  const date = findDate(text);
  const tokens = collectTimeTokens(text);

  if (tokens.length === 0) {
    if (date) warnings.push("未能识别具体时间，请手动补全");
    return { startTime: null, endTime: null, warnings };
  }
  if (!tokens[0].explicit) {
    warnings.push("未标明上午/下午，已按时段推测，请核对");
  }

  let year: number;
  let month: number;
  let day: number;

  if (date) {
    year = date.year ?? now.getFullYear();
    month = date.month;
    day = date.day;
  } else {
    const weekday = findWeekday(text);
    if (weekday === null) {
      warnings.push("未能识别日期，请手动补全");
      return { startTime: null, endTime: null, warnings };
    }
    const base = new Date(now.getTime());
    const diff = (weekday - base.getDay() + 7) % 7;
    base.setDate(base.getDate() + diff);
    year = base.getFullYear();
    month = base.getMonth() + 1;
    day = base.getDate();
    warnings.push("未识别到日期，已按最近的一个该星期推算");
  }

  if (!date?.year && !findWeekday(text)) {
    const candidate = new Date(year, month - 1, day);
    if (candidate.getTime() < now.getTime() - 30 * 24 * 3600 * 1000) {
      year += 1;
      warnings.push(`未写年份，已按 ${year} 年推算`);
    }
  }

  const start = tokens[0];
  const startTime = isoFrom({ year, month, day, hour: start.hour, minute: start.minute });

  let endTime: string | null = null;
  if (tokens.length >= 2) {
    const end = tokens[1];
    let endHour = end.hour;
    let endMinute = end.minute;
    if (endHour * 60 + endMinute <= start.hour * 60 + start.minute) {
      endHour += 24;
    }
    const ms =
      Date.UTC(year, month - 1, day, endHour, endMinute) - TZ_OFFSET_MIN * 60000;
    endTime = new Date(ms).toISOString();
  }

  return { startTime, endTime, warnings };
}

function extractSubjectLine(lines: string[]): string {
  const labelRe = /^(?:会议)?(?:主题|标题|名称|Subject|Topic)\s*[:：]\s*(.+)$/i;
  for (const line of lines) {
    const m = line.match(labelRe);
    if (m) return m[1].trim();
  }
  for (const line of lines) {
    if (/^https?:\/\//i.test(line)) continue;
    if (/^(时间|会议时间|Time|Date)\s*[:：]/i.test(line)) continue;
    if (/^(会议号|Meeting)/i.test(line)) continue;
    if (line.length >= 2) return line;
  }
  return "";
}

function splitSubject(subject: string): string[] {
  return subject
    .split(/[-|｜/·、<>《》【】\[\]()（）]|\s{1,}/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const ROUND_ALIASES: Record<string, string> = {
  初面: "一面",
};

function normalizeRound(value: string): string {
  return ROUND_ALIASES[value] ?? value;
}

function extractRound(subject: string, full: string): string {
  const fromSubject = subject.match(ROUND_RE);
  if (fromSubject) return normalizeRound(fromSubject[1]);
  const fromFull = full.match(ROUND_RE);
  if (fromFull) return normalizeRound(fromFull[1]);
  return "一面";
}

function extractCompany(subject: string, full: string): string {
  const haystacks = [subject, full];
  for (const h of haystacks) {
    const lower = h.toLowerCase();
    let best = "";
    for (const c of KNOWN_COMPANIES) {
      if (lower.includes(c.toLowerCase()) && c.length > best.length) best = c;
    }
    if (best) return best;
  }
  for (const h of haystacks) {
    const m = h.match(
      /([\u4e00-\u9fa5A-Za-z0-9]{2,20})\([^)]{1,12}\)[^，,。\s]{0,20}(?:有限公司|股份有限公司|集团)/,
    );
    if (m) return m[1];
  }
  for (const token of splitSubject(subject)) {
    if (COMPANY_SUFFIX.test(token)) return token;
  }
  const m = full.match(/([\u4e00-\u9fa5A-Za-z0-9]{2,20}(?:有限公司|集团|科技公司))/);
  if (m) return m[1];
  return "";
}

const POSITION_TOKEN_RE =
  /^[\u4e00-\u9fa5A-Za-z]{2,12}(?:工程师|开发|经理|专家|架构师)$/;

function trimPosition(value: string): string {
  return value.replace(/开发工程师$/, "开发");
}

function extractPosition(subject: string, full: string): string {
  let structural = "";
  for (const token of splitSubject(subject)) {
    if (POSITION_TOKEN_RE.test(token) && token.length > structural.length) {
      structural = token;
    }
  }
  if (structural) return trimPosition(structural);

  const haystacks = [subject, full];
  for (const h of haystacks) {
    let best = "";
    for (const p of POSITION_KEYWORDS) {
      if (h.includes(p) && p.length > best.length) best = p;
    }
    if (best) return trimPosition(best);
  }
  const m = subject.match(/([\u4e00-\u9fa5A-Za-z]{2,12}(?:工程师|开发|经理|专家|架构师))/);
  if (m) return trimPosition(m[1]);
  return "";
}

function extractInterviewers(text: string): string {
  const m = text.match(
    /(?:面试官|面试官姓名|招聘官|面试人|考官|面试负责人|Interviewer)\s*[:：]\s*([^\n]{1,40})/i,
  );
  return m ? m[1].trim() : "";
}

function extractOrganizer(lines: string[], text: string): string {
  const label = text.match(
    /(?:组织者|组织人|发起人|主持人|主办方|组织)\s*[:：]\s*([^\n，,。;；]{1,30})/,
  );
  if (label) return label[1].trim();
  for (const line of lines) {
    const cn = line.match(/^(.{1,24}?)\s*邀请你(?:加入|参加)/);
    if (cn) return cn[1].trim();
    const en = line.match(/^(.{1,30}?)\s+invited you/i);
    if (en) return en[1].trim();
  }
  return "";
}

const NOTES_START_RE = /[【\[]\s*注意事项\s*[】\]]\s*[:：]?\s*(.*)$/;
const SECTION_HEAD_RE = /^\s*[【\[][^】\]]{1,20}[】\]]\s*$/;

function isFooter(line: string): boolean {
  if (/^(公司地址|公司名称|地址|招聘邮箱|官网)\s*[:：]?/.test(line)) return true;
  if (/(人力资源部|人力资源中心|招聘团队|此致|敬礼)\s*$/.test(line)) return true;
  if (/(有限公司|股份有限公司|集团|研究院)\s*$/.test(line)) return true;
  return false;
}

function extractNotes(text: string): string {
  const lines = text.split(/\r?\n/);
  let start = -1;
  let inline = "";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const bracketed = line.match(NOTES_START_RE);
    if (bracketed) {
      start = i;
      inline = bracketed[1].trim();
      break;
    }
    if (/^注意事项\s*[:：]?\s*(.*)$/.test(line)) {
      start = i;
      inline = line.replace(/^注意事项\s*[:：]?\s*/, "").trim();
      break;
    }
  }
  if (start === -1) return "";

  const collected: string[] = [];
  if (inline) collected.push(inline);
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (SECTION_HEAD_RE.test(line)) break;
    if (isFooter(line)) break;
    collected.push(line);
  }
  return collected.join("\n");
}

export function parseMeeting(input: string, now: Date = new Date()): ParseResult {
  const text = normalize(input);
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const platform = detectPlatform(text);
  const meetingUrl = extractUrl(text);
  const meetingId = extractMeetingId(text);
  const password = extractPassword(text);
  const subject = extractSubjectLine(lines);
  const round = extractRound(subject, text);
  const company = extractCompany(subject, text);
  const position = extractPosition(subject, text);
  const interviewers = extractInterviewers(text);
  const organizer = extractOrganizer(lines, text);
  const notes = extractNotes(input.replace(/[\u200B-\u200D\uFEFF]/g, ""));
  const { startTime, endTime, warnings } = extractDateTime(text, now);

  let confidence = 0;
  if (startTime) confidence += 0.4;
  if (company) confidence += 0.2;
  if (position) confidence += 0.15;
  if (round) confidence += 0.1;
  if (platform !== "other") confidence += 0.1;
  if (meetingUrl || meetingId) confidence += 0.05;
  confidence = Math.min(1, Math.round(confidence * 100) / 100);

  const meeting: ParsedMeeting = {
    company,
    position,
    round,
    startTime,
    endTime,
    platform,
    meetingUrl,
    meetingId,
    password,
    interviewers,
    organizer,
    notes,
    warnings,
    confidence,
  };

  return { meeting, warnings, confidence };
}
