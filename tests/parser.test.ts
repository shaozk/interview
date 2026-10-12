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
    expect(meeting.position).toBe("后端开发");
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

  it("parses the Feishu inviter as organizer", () => {
    const raw = `项秀邀请你加入飞书视频会议
会议主题：数据平台开发-视频初面：邵梓康
会议时间：10月15日 (周四) 11:00 - 11:45 (GMT+8)
会议 ID：628 940 214
会议链接：https://vc.feishu.cn/j/628940214`;
    const { meeting } = parseMeeting(raw, now);
    expect(meeting.platform).toBe("feishu");
    expect(meeting.organizer).toBe("项秀");
    expect(meeting.position).toBe("数据平台开发");
    expect(meeting.round).toBe("一面");
    expect(meeting.meetingId).toBe("628940214");
    expect(meeting.meetingUrl).toBe("https://vc.feishu.cn/j/628940214");
    expect(meeting.startTime).toBe("2026-10-15T03:00:00.000Z");
    expect(meeting.endTime).toBe("2026-10-15T03:45:00.000Z");
  });

  it("extracts the 注意事项 section into notes", () => {
    const raw = `智驾新程（上海）智能科技有限公司诚邀你参加【FY26】智驾应用软件开发工程师-L4职位的面试。
【面试信息】
面试形式：视频面试
面试时间：2026-10-14 20:00 (GMT+08:00) 中国标准时间 - 北京
面试链接：https://neuehct.feishu.cn/hire/short_url/nPzS6zSeSV8（飞书）
【注意事项】
研发类岗位面试均涉及代码考核，烦请提前自备电脑，搭建好编程运行环境
本次线上面试将采用双机位监考模式。请您准备两台设备
如需修改面试时间，请提前 1 天与 HR 联系，HR：徐乐晨 +8618020583895
智驾新程（上海）智能科技有限公司人力资源部
公司地址：
上海：嘉定区泰业街150弄2号楼`;
    const { meeting } = parseMeeting(raw, now);
    expect(meeting.company).toBe("智驾新程");
    expect(meeting.position).toBe("智驾应用软件开发");
    expect(meeting.notes).toContain("代码考核");
    expect(meeting.notes).toContain("双机位");
    expect(meeting.notes).toContain("徐乐晨");
    expect(meeting.notes).toContain("，");
    expect(meeting.meetingUrl).toBe("https://neuehct.feishu.cn/hire/short_url/nPzS6zSeSV8");
    expect(meeting.notes).not.toContain("面试形式");
    expect(meeting.notes).not.toContain("公司地址");
    expect(meeting.notes).not.toContain("嘉定区");

    const rawZw = "【注意事项】\u200B\n要点一\u200B\n智驾新程（上海）智能科技有限公司人力资源部\u200B\n公司地址：";
    const { meeting: zw } = parseMeeting(rawZw, now);
    expect(zw.notes).toBe("要点一");
  });

  it("defaults the round to 一面 when none is found", () => {
    const raw = `会议主题：某公司 后端面试
面试时间：2026-10-20 10:00`;
    const { meeting } = parseMeeting(raw, now);
    expect(meeting.round).toBe("一面");
  });

  it("warns when no time is recognized", () => {
    const raw = `随便一段没有时间的内容`;
    const { meeting } = parseMeeting(raw, now);
    expect(meeting.startTime).toBeNull();
  });
});
