import { newId } from "./id";
import type { BusyStatus, EventType, ParsedEvent, Recurrence, Reminder, Weekday } from "../types";
import { WEEKDAYS } from "../types";

const API_URL = "https://api.deepseek.com/chat/completions";

function buildSystemPrompt(): string {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
  const weekday = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][now.getDay()];
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return `你是一个从中文/英文通知文本中抽取日程信息的助手。今天是 ${today}（${weekday}），时区为 ${timeZone}。
请只输出一个 JSON 对象，不要输出任何多余文字，结构如下：

{
  "events": [
    {
      "title": string,               // 事件标题，尽量简短概括
      "location": string,            // 地点，没有则空字符串
      "start": "YYYY-MM-DDTHH:mm",   // 本地时间，24小时制，不带时区后缀
      "end": "YYYY-MM-DDTHH:mm",     // 若原文没写结束时间，按开始时间+1小时
      "allDay": boolean,
      "notes": string,               // 其余细节/备注，没有则空字符串
      "eventType": "deadline" | "meeting" | "other",
      "reminders": [ { "minutesBefore": number, "needsConfirm": boolean } ],
      "recurrence": null | {
        "freq": "DAILY" | "WEEKLY" | "MONTHLY",
        "interval": number,
        "byDay": null | ("MO"|"TU"|"WE"|"TH"|"FR"|"SA"|"SU")[],
        "until": null | "YYYY-MM-DD"
      },
      "busyStatus": "busy" | "free"
    }
  ]
}

抽取规则：
- 一段文本里可能包含多个日程，逐条拆分成多个 events 元素；无法确定的字段留空字符串，不要编造。
- eventType 判断为 "deadline" 的（作业/报名截止/交付截止等），reminders 按距今剩余天数分级生成多档（单位分钟，1天=1440分钟）：
  - 剩余 >=7 天：提前 7 天、3 天、1 天 各一条
  - 剩余 3~7 天：提前 3 天、1 天 各一条
  - 剩余 <3 天：提前 1 天、以及当天几小时前 各一条
  - 这些 reminders 的 needsConfirm 都为 false。
- eventType 为 "meeting"（有明确时间点的会议/课程/活动）：默认给提前 30 分钟、15 分钟两条 reminders（needsConfirm 为 false）；如果标题或备注出现"重要""面试""考试""答辩""汇报"等关键词，额外再加一条更早的提醒（如提前 60 分钟）。
- 如果事件有 location（不是空字符串），额外增加一条你判断的建议提前量（比如通勤时间），这条的 needsConfirm 必须为 true，用户会在界面上单独确认这一条。
- recurrence：只有文本明确暗示"每周""每天""每月"等重复规律时才填写，否则为 null。
- busyStatus：会议/课程/预约等实际占用一段时间的填 "busy"；单纯的截止日期标记、无需到场占用时间段的填 "free"。
- 输出必须是合法 JSON，不要用 markdown 代码块包裹。`;
}

interface RawReminder {
  minutesBefore?: number;
  needsConfirm?: boolean;
}

interface RawRecurrence {
  freq?: string;
  interval?: number;
  byDay?: string[] | null;
  until?: string | null;
}

interface RawEvent {
  title?: string;
  location?: string;
  start?: string;
  end?: string;
  allDay?: boolean;
  notes?: string;
  eventType?: string;
  reminders?: RawReminder[];
  recurrence?: RawRecurrence | null;
  busyStatus?: string;
}

function normalizeReminders(raw: RawReminder[] | undefined): Reminder[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r) => typeof r.minutesBefore === "number" && r.minutesBefore >= 0)
    .map((r) => ({
      id: newId(),
      minutesBefore: Math.round(r.minutesBefore!),
      needsConfirm: r.needsConfirm === true,
    }));
}

function normalizeRecurrence(raw: RawRecurrence | null | undefined): Recurrence | null {
  if (!raw || !raw.freq) return null;
  const freq = raw.freq.toUpperCase();
  if (freq !== "DAILY" && freq !== "WEEKLY" && freq !== "MONTHLY") return null;
  const byDay = Array.isArray(raw.byDay)
    ? (raw.byDay.filter((d): d is Weekday => (WEEKDAYS as readonly string[]).includes(d)) as Weekday[])
    : undefined;
  return {
    freq,
    interval: Number.isFinite(raw.interval) && raw.interval! > 0 ? Math.round(raw.interval!) : 1,
    byDay: byDay && byDay.length > 0 ? byDay : undefined,
    until: raw.until ?? undefined,
  };
}

function normalizeEvent(raw: RawEvent): ParsedEvent {
  const eventType: EventType =
    raw.eventType === "deadline" || raw.eventType === "meeting" ? raw.eventType : "other";
  const busyStatus: BusyStatus = raw.busyStatus === "free" ? "free" : "busy";
  const start = raw.start || "";
  const end = raw.end || start;

  return {
    id: newId(),
    title: raw.title?.trim() || "(未命名日程)",
    location: raw.location?.trim() || "",
    notes: raw.notes?.trim() || "",
    allDay: raw.allDay === true,
    start,
    end,
    eventType,
    reminders: normalizeReminders(raw.reminders),
    recurrence: normalizeRecurrence(raw.recurrence),
    busyStatus,
  };
}

export class DeepSeekError extends Error {}

export async function parseNoticeText(text: string, apiKey: string): Promise<ParsedEvent[]> {
  if (!apiKey) {
    throw new DeepSeekError("请先在设置里填写 DeepSeek API Key");
  }

  let response: Response;
  try {
    response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        response_format: { type: "json_object" },
        temperature: 0,
        messages: [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: text },
        ],
      }),
    });
  } catch (err) {
    throw new DeepSeekError(`网络请求失败：${(err as Error).message}`);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new DeepSeekError(`DeepSeek API 返回错误（${response.status}）：${body.slice(0, 300)}`);
  }

  const payload = await response.json();
  const content: string | undefined = payload?.choices?.[0]?.message?.content;
  if (!content) {
    throw new DeepSeekError("DeepSeek 返回内容为空，无法解析");
  }

  let parsed: { events?: RawEvent[] };
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new DeepSeekError("DeepSeek 返回的不是合法 JSON，请重试");
  }

  if (!Array.isArray(parsed.events) || parsed.events.length === 0) {
    throw new DeepSeekError("没有从文本中识别出任何日程，请检查输入内容");
  }

  return parsed.events.map(normalizeEvent);
}
