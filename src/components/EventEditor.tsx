import type { ParsedEvent, Recurrence, RecurrenceFreq, Reminder, Weekday } from "../types";
import { WEEKDAYS } from "../types";
import { newId } from "../lib/id";
import { buildOutlookComposeUrl } from "../lib/outlookLink";

interface EventEditorProps {
  events: ParsedEvent[];
  onChange: (events: ParsedEvent[]) => void;
}

const WEEKDAY_LABELS: Record<Weekday, string> = {
  MO: "一",
  TU: "二",
  WE: "三",
  TH: "四",
  FR: "五",
  SA: "六",
  SU: "日",
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toDatetimeLocalValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function blankEvent(): ParsedEvent {
  const now = new Date();
  const later = new Date(now.getTime() + 60 * 60 * 1000);
  return {
    id: newId(),
    title: "",
    location: "",
    notes: "",
    allDay: false,
    start: toDatetimeLocalValue(now),
    end: toDatetimeLocalValue(later),
    eventType: "other",
    reminders: [],
    recurrence: null,
    busyStatus: "busy",
  };
}

type ReminderUnit = "minutes" | "hours" | "days";

function minutesToValueUnit(minutes: number): { value: number; unit: ReminderUnit } {
  if (minutes !== 0 && minutes % 1440 === 0) return { value: minutes / 1440, unit: "days" };
  if (minutes !== 0 && minutes % 60 === 0) return { value: minutes / 60, unit: "hours" };
  return { value: minutes, unit: "minutes" };
}

function valueUnitToMinutes(value: number, unit: ReminderUnit): number {
  if (unit === "days") return value * 1440;
  if (unit === "hours") return value * 60;
  return value;
}

export function EventEditor({ events, onChange }: EventEditorProps) {
  function updateEvent(id: string, patch: Partial<ParsedEvent>) {
    onChange(events.map((ev) => (ev.id === id ? { ...ev, ...patch } : ev)));
  }

  function removeEvent(id: string) {
    onChange(events.filter((ev) => ev.id !== id));
  }

  function addEvent() {
    onChange([...events, blankEvent()]);
  }

  function updateReminder(event: ParsedEvent, reminderId: string, patch: Partial<Reminder>) {
    updateEvent(event.id, {
      reminders: event.reminders.map((r) => (r.id === reminderId ? { ...r, ...patch } : r)),
    });
  }

  function removeReminder(event: ParsedEvent, reminderId: string) {
    updateEvent(event.id, { reminders: event.reminders.filter((r) => r.id !== reminderId) });
  }

  function addReminder(event: ParsedEvent) {
    updateEvent(event.id, {
      reminders: [...event.reminders, { id: newId(), minutesBefore: 30, needsConfirm: false }],
    });
  }

  function setRecurrenceEnabled(event: ParsedEvent, enabled: boolean) {
    updateEvent(event.id, {
      recurrence: enabled ? { freq: "WEEKLY", interval: 1 } : null,
    });
  }

  function updateRecurrence(event: ParsedEvent, patch: Partial<Recurrence>) {
    if (!event.recurrence) return;
    updateEvent(event.id, { recurrence: { ...event.recurrence, ...patch } });
  }

  function toggleWeekday(event: ParsedEvent, day: Weekday) {
    if (!event.recurrence) return;
    const current = event.recurrence.byDay ?? [];
    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day];
    updateRecurrence(event, { byDay: next });
  }

  return (
    <div className="event-editor">
      {events.length === 0 && <p className="hint">还没有日程，点击下方"添加日程"手动创建一条。</p>}

      {events.map((event) => (
        <div key={event.id} className="event-card">
          <div className="event-card-header">
            <input
              className="event-title-input"
              type="text"
              placeholder="标题"
              value={event.title}
              onChange={(e) => updateEvent(event.id, { title: e.target.value })}
            />
            <button type="button" onClick={() => removeEvent(event.id)}>
              删除
            </button>
          </div>

          <div className="outlook-link-row">
            <a
              className="button-link"
              href={buildOutlookComposeUrl(event)}
              target="_blank"
              rel="noopener noreferrer"
            >
              在 Outlook 中打开
            </a>
            <span className="hint">
              只带标题/时间/地点/备注跳转新建；提醒/重复/忙闲/附件仍需用下方"生成并导出 ics"。
            </span>
          </div>

          <label className="field-inline">
            <input
              type="checkbox"
              checked={event.allDay}
              onChange={(e) => {
                const allDay = e.target.checked;
                // keep the date, but make sure the value shape matches what the
                // date / datetime-local input we're switching to expects
                const toDate = (v: string) => v.slice(0, 10);
                const toDatetime = (v: string) => (v.includes("T") ? v : `${v}T00:00`);
                updateEvent(event.id, {
                  allDay,
                  start: allDay ? toDate(event.start) : toDatetime(event.start),
                  end: allDay ? toDate(event.end) : toDatetime(event.end),
                });
              }}
            />
            全天
          </label>

          <div className="field-row">
            <label className="field">
              <span>开始</span>
              <input
                type={event.allDay ? "date" : "datetime-local"}
                value={event.allDay ? event.start.slice(0, 10) : event.start}
                onChange={(e) => updateEvent(event.id, { start: e.target.value })}
              />
            </label>
            <label className="field">
              <span>结束</span>
              <input
                type={event.allDay ? "date" : "datetime-local"}
                value={event.allDay ? event.end.slice(0, 10) : event.end}
                onChange={(e) => updateEvent(event.id, { end: e.target.value })}
              />
            </label>
          </div>

          <label className="field">
            <span>地点</span>
            <input
              type="text"
              value={event.location}
              onChange={(e) => updateEvent(event.id, { location: e.target.value })}
            />
          </label>

          <label className="field">
            <span>备注</span>
            <textarea
              rows={2}
              value={event.notes}
              onChange={(e) => updateEvent(event.id, { notes: e.target.value })}
            />
          </label>

          <label className="field">
            <span>忙闲状态</span>
            <select
              value={event.busyStatus}
              onChange={(e) =>
                updateEvent(event.id, { busyStatus: e.target.value as ParsedEvent["busyStatus"] })
              }
            >
              <option value="busy">忙碌</option>
              <option value="free">空闲</option>
            </select>
          </label>

          <div className="reminders">
            <span className="field-label">提醒</span>
            {event.reminders.map((reminder) => {
              const { value, unit } = minutesToValueUnit(reminder.minutesBefore);
              return (
                <div
                  key={reminder.id}
                  className={reminder.needsConfirm ? "reminder-chip reminder-needs-confirm" : "reminder-chip"}
                >
                  {reminder.needsConfirm && <span className="badge badge-warning">请确认提前量</span>}
                  <input
                    type="number"
                    min={0}
                    value={value}
                    onChange={(e) =>
                      updateReminder(event, reminder.id, {
                        minutesBefore: valueUnitToMinutes(Number(e.target.value) || 0, unit),
                      })
                    }
                  />
                  <select
                    value={unit}
                    onChange={(e) =>
                      updateReminder(event, reminder.id, {
                        minutesBefore: valueUnitToMinutes(value, e.target.value as ReminderUnit),
                      })
                    }
                  >
                    <option value="minutes">分钟前</option>
                    <option value="hours">小时前</option>
                    <option value="days">天前</option>
                  </select>
                  <button type="button" onClick={() => removeReminder(event, reminder.id)}>
                    移除
                  </button>
                </div>
              );
            })}
            <button type="button" onClick={() => addReminder(event)}>
              + 添加提醒
            </button>
          </div>

          <div className="recurrence">
            <label className="field-inline">
              <input
                type="checkbox"
                checked={event.recurrence !== null}
                onChange={(e) => setRecurrenceEnabled(event, e.target.checked)}
              />
              重复日程
            </label>

            {event.recurrence && (
              <div className="recurrence-details">
                <label className="field">
                  <span>频率</span>
                  <select
                    value={event.recurrence.freq}
                    onChange={(e) =>
                      updateRecurrence(event, { freq: e.target.value as RecurrenceFreq })
                    }
                  >
                    <option value="DAILY">每天</option>
                    <option value="WEEKLY">每周</option>
                    <option value="MONTHLY">每月</option>
                  </select>
                </label>

                <label className="field">
                  <span>间隔</span>
                  <input
                    type="number"
                    min={1}
                    value={event.recurrence.interval}
                    onChange={(e) =>
                      updateRecurrence(event, { interval: Math.max(1, Number(e.target.value) || 1) })
                    }
                  />
                </label>

                {event.recurrence.freq === "WEEKLY" && (
                  <div className="weekday-picker">
                    {WEEKDAYS.map((day) => (
                      <label key={day} className="weekday-checkbox">
                        <input
                          type="checkbox"
                          checked={event.recurrence?.byDay?.includes(day) ?? false}
                          onChange={() => toggleWeekday(event, day)}
                        />
                        {WEEKDAY_LABELS[day]}
                      </label>
                    ))}
                  </div>
                )}

                <label className="field">
                  <span>结束日期（可留空）</span>
                  <input
                    type="date"
                    value={event.recurrence.until ?? ""}
                    onChange={(e) =>
                      updateRecurrence(event, { until: e.target.value || undefined })
                    }
                  />
                </label>
              </div>
            )}
          </div>
        </div>
      ))}

      <button type="button" onClick={addEvent}>
        + 添加日程
      </button>
    </div>
  );
}
