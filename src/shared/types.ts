export type InterviewStatus =
  | "to-schedule"
  | "scheduled"
  | "completed"
  | "cancelled"
  | "rejected";

export type Platform =
  | "feishu"
  | "tencent"
  | "zoom"
  | "teams"
  | "google"
  | "other";

export interface Interview {
  id: string;
  company: string;
  position: string;
  round: string;
  startTime: string | null;
  endTime: string | null;
  platform: Platform;
  meetingUrl: string | null;
  meetingId: string | null;
  password: string | null;
  interviewers: string;
  status: InterviewStatus;
  notes: string;
  rawText: string;
  createdAt: string;
  updatedAt: string;
}

export type InterviewInput = Omit<Interview, "id" | "createdAt" | "updatedAt">;

export interface ParsedMeeting {
  company: string;
  position: string;
  round: string;
  startTime: string | null;
  endTime: string | null;
  platform: Platform;
  meetingUrl: string | null;
  meetingId: string | null;
  password: string | null;
  interviewers: string;
  warnings: string[];
  confidence: number;
}

export interface ParseResult {
  meeting: ParsedMeeting;
  warnings: string[];
  confidence: number;
}

export const STATUS_LABELS: Record<InterviewStatus, string> = {
  "to-schedule": "待安排",
  scheduled: "待面试",
  completed: "已面试",
  cancelled: "已取消",
  rejected: "已拒绝",
};

export const STATUS_ORDER: InterviewStatus[] = [
  "to-schedule",
  "scheduled",
  "completed",
  "cancelled",
  "rejected",
];

export const PLATFORM_LABELS: Record<Platform, string> = {
  feishu: "飞书会议",
  tencent: "腾讯会议",
  zoom: "Zoom",
  teams: "Microsoft Teams",
  google: "Google Meet",
  other: "其他",
};

export const ROUND_PRESETS = [
  "笔试",
  "一面",
  "二面",
  "三面",
  "四面",
  "五面",
  "终面",
  "HR面",
  "群面",
  "交叉面",
  "加面",
];
