import { describe, expect, it } from "vitest";
import { sanitizeParsed } from "../src/worker/ai";

describe("sanitizeParsed", () => {
  it("passes through a well-formed payload", () => {
    const out = sanitizeParsed({
      company: "智驾新程",
      position: "智驾应用软件开发",
      round: "一面",
      startTime: "2026-10-14T19:00:00+08:00",
      endTime: "2026-10-14T20:00:00+08:00",
      platform: "tencent",
      meetingUrl: "https://meeting.tencent.com/dm/abc",
      meetingId: "290285719",
      password: "1234",
      interviewers: "张三、李四",
      organizer: "HR 王",
      notes: "提前十分钟入场",
      confidence: 0.9,
    });
    expect(out.company).toBe("智驾新程");
    expect(out.platform).toBe("tencent");
    expect(out.startTime).toBe("2026-10-14T11:00:00.000Z");
    expect(out.confidence).toBe(0.9);
    expect(out.warnings).toEqual([]);
  });

  it("fills defaults for missing fields on a non-object payload", () => {
    const out = sanitizeParsed("not an object");
    expect(out.company).toBe("");
    expect(out.round).toBe("一面");
    expect(out.platform).toBe("other");
    expect(out.startTime).toBeNull();
    expect(out.confidence).toBe(0.5);
  });

  it("interprets tz-naive times as beijing (+08:00)", () => {
    const out = sanitizeParsed({ startTime: "2026-10-20T14:00", endTime: "2026-10-20T15:00:00" });
    expect(out.startTime).toBe("2026-10-20T06:00:00.000Z");
    expect(out.endTime).toBe("2026-10-20T07:00:00.000Z");
  });

  it("drops unknown platform values and invalid timestamps", () => {
    const out = sanitizeParsed({
      platform: "wechat",
      startTime: "明天下午3点",
      endTime: "",
      meetingId: 12345,
    });
    expect(out.platform).toBe("other");
    expect(out.startTime).toBeNull();
    expect(out.endTime).toBeNull();
    expect(out.meetingId).toBeNull();
  });

  it("clamps confidence and truncates overlong strings", () => {
    const out = sanitizeParsed({
      company: "x".repeat(500),
      notes: "n".repeat(5000),
      confidence: 42,
    });
    expect(out.company.length).toBe(120);
    expect(out.notes.length).toBe(2000);
    expect(out.confidence).toBe(1);
    expect(sanitizeParsed({ confidence: -3 }).confidence).toBe(0);
  });
});
