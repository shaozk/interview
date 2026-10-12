import { describe, expect, it } from "vitest";
import { buildMonthSchedule } from "../src/client/schedule";
import type { Interview } from "../src/shared/types";

function makeInterview(over: Partial<Interview>): Interview {
  return {
    id: over.id ?? "id",
    company: over.company ?? "",
    position: over.position ?? "",
    round: over.round ?? "",
    startTime: over.startTime ?? null,
    endTime: over.endTime ?? null,
    platform: over.platform ?? "feishu",
    meetingUrl: over.meetingUrl ?? null,
    meetingId: over.meetingId ?? null,
    password: over.password ?? null,
    interviewers: over.interviewers ?? "",
    organizer: over.organizer ?? "",
    status: over.status ?? "scheduled",
    notes: over.notes ?? "",
    rawText: over.rawText ?? "",
    createdAt: over.createdAt ?? "",
    updatedAt: over.updatedAt ?? "",
  };
}

const now = new Date("2026-10-05T00:00:00+08:00");

describe("buildMonthSchedule", () => {
  it("lists today-and-later slots for the current month, masking details", () => {
    const items = [
      makeInterview({
        startTime: "2026-10-01T04:00:00.000Z",
        company: "过去公司",
      }),
      makeInterview({
        startTime: "2026-10-14T12:00:00.000Z",
        endTime: "2026-10-14T13:00:00.000Z",
        company: "智驾新程",
        position: "智驾应用软件开发",
        round: "一面",
        interviewers: "王老师",
      }),
      makeInterview({ startTime: "2026-11-01T01:00:00.000Z", company: "别家公司" }),
    ];
    const text = buildMonthSchedule(items, now);
    expect(text).toContain("2026年10月");
    expect(text).toContain("共 1 项");
    expect(text).toContain("10月14日");
    expect(text).toContain("20:00-21:00");
    expect(text).toContain("已占用");
    expect(text).not.toContain("10月1日");
    expect(text).not.toContain("过去公司");
    expect(text).not.toContain("智驾新程");
    expect(text).not.toContain("智驾应用软件开发");
    expect(text).not.toContain("王老师");
    expect(text).not.toContain("别家公司");
    expect(text).not.toContain("11月");
  });

  it("excludes cancelled interviews", () => {
    const items = [
      makeInterview({ startTime: "2026-10-14T12:00:00.000Z", status: "cancelled" }),
    ];
    expect(buildMonthSchedule(items, now)).toContain("今天起本月暂无安排");
  });
});
