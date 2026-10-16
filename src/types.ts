export type EventType = "deadline" | "meeting" | "other";

export type BusyStatus = "busy" | "free";

export type RecurrenceFreq = "DAILY" | "WEEKLY" | "MONTHLY";

export const WEEKDAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export interface Recurrence {
  freq: RecurrenceFreq;
  interval: number;
  byDay?: Weekday[];
  /** yyyy-MM-dd, inclusive last day the event can recur on */
  until?: string;
}

export interface Reminder {
  id: string;
  minutesBefore: number;
  /** true when this reminder came from an AI "how much lead time do you need" guess (e.g. travel time for a located event) and must be reviewed rather than trusted silently */
  needsConfirm?: boolean;
}

/**
 * A datetime-local input value, e.g. "2026-09-20T14:30", interpreted in the
 * browser's local timezone. Converted to UTC only at ICS-serialization time.
 */
export type LocalDateTime = string;

export interface ParsedEvent {
  id: string;
  title: string;
  location: string;
  notes: string;
  allDay: boolean;
  start: LocalDateTime;
  end: LocalDateTime;
  eventType: EventType;
  reminders: Reminder[];
  recurrence: Recurrence | null;
  busyStatus: BusyStatus;
}

export interface Attachment {
  id: string;
  file: File;
  name: string;
  size: number;
  /** "all" = attach to every event, otherwise a list of event ids */
  assignment: "all" | string[];
}
