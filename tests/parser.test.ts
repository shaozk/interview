import { describe, expect, it } from "vitest";
import { parseMeeting } from "../src/shared/parser";

const now = new Date("2026-10-01T00:00:00+08:00");

describe("parseMeeting", () => {
  it("parses a Tencent Meeting invite", () => {
    const raw = `腾讯会议邀请
会议主题：字节跳动 - 后端开发工程师 - 一面
会议时间：2026/10/15 14:00-15:00
点击链接入会：https://meeting.tencent.com/dm/abc123
#腾讯会议：123-456-789`;
    const { meeting } = parseMeeting(raw, now);
    expect(meeting.platform).toBe("tencent");
    expect(meeting.company).toBe("字节跳动");
    expect(meeting.position).toBe("后端开发工程师");
    expect(meeting.round).toBe("一面");
    expect(meeting.startTime).toBe("2026-10-15T06:00:00.000Z");
    expect(meeting.endTime).toBe("2026-10-15T07:00:00.000Z");
    expect(meeting.meetingUrl).toContain("meeting.tencent.com");
    expect(meeting.meetingId).toBe("123456789");
  });

  it("parses a Feishu calendar invite", () => {
    const raw = `飞书会议
主题：腾讯 前端开发 二面
时间：2026年10月16日（周五）10:00 - 11:00
会议号：876 543 210
入会链接：https://vc.feishu.cn/j/123456789`;
    const { meeting } = parseMeeting(raw, now);
    expect(meeting.platform).toBe("feishu");
    expect(meeting.company).toBe("腾讯");
    expect(meeting.position).toBe("前端开发");
    expect(meeting.round).toBe("二面");
    expect(meeting.startTime).toBe("2026-10-16T02:00:00.000Z");
    expect(meeting.endTime).toBe("2026-10-16T03:00:00.000Z");
    expect(meeting.meetingId).toBe("876543210");
  });

  it("parses a Zoom invite", () => {
    const raw = `Zoom meeting invitation
Topic: 阿里巴巴 - 算法工程师 - 技术面
Time: Oct 17, 2026 02:00 PM Beijing
Join Zoom Meeting
https://us05web.zoom.us/j/1234567890?pwd=abc
Meeting ID: 123 4567 8901
Passcode: 8xY2kP`;
    const { meeting } = parseMeeting(raw, now);
    expect(meeting.platform).toBe("zoom");
    expect(meeting.company).toBe("阿里巴巴");
    expect(meeting.position).toBe("算法工程师");
    expect(meeting.round).toBe("技术面");
    expect(meeting.startTime).toBe("2026-10-17T06:00:00.000Z");
    expect(meeting.meetingId).toBe("12345678901");
    expect(meeting.password).toBe("8xY2kP");
  });

  it("parses a Microsoft Teams invite", () => {
    const raw = `Microsoft Teams meeting
Subject: 美团 产品经理 终面
When: 2026-10-18 15:30
Meeting ID: 111 222 333 444
Passcode: abcd123
Join: https://teams.microsoft.com/l/meetup-join/xyz`;
    const { meeting } = parseMeeting(raw, now);
    expect(meeting.platform).toBe("teams");
    expect(meeting.company).toBe("美团");
    expect(meeting.position).toBe("产品经理");
    expect(meeting.round).toBe("终面");
    expect(meeting.startTime).toBe("2026-10-18T07:30:00.000Z");
    expect(meeting.password).toBe("abcd123");
  });

  it("parses an HR email body", () => {
    const raw = `【面试通知】小米 - 测试工程师 - 一面
您好，邀请您参加面试。
面试时间：10月20日 下午3:00-4:00
面试官：王老师
会议链接：https://meet.google.com/abc-defg-hij`;
    const { meeting } = parseMeeting(raw, now);
    expect(meeting.platform).toBe("google");
    expect(meeting.company).toBe("小米");
    expect(meeting.position).toBe("测试工程师");
    expect(meeting.round).toBe("一面");
    expect(meeting.interviewers).toBe("王老师");
    expect(meeting.startTime).toBe("2026-10-20T07:00:00.000Z");
    expect(meeting.endTime).toBe("2026-10-20T08:00:00.000Z");
  });

  it("infers the year for a date without one", () => {
    const raw = `会议时间：12月5日 10:00
主题：华为 运维工程师 一面`;
    const { meeting } = parseMeeting(raw, now);
    expect(meeting.startTime).toBe("2026-12-05T02:00:00.000Z");
  });

  it("warns when no time is recognized", () => {
    const raw = `随便一段没有时间的内容`;
    const { meeting } = parseMeeting(raw, now);
    expect(meeting.startTime).toBeNull();
  });
});
