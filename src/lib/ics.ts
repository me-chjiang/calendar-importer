import type { Attachment, ParsedEvent, Recurrence } from "../types";

const CRLF = "\r\n";

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}@calendar-importer.local`;
}

/** Escapes text per RFC 5545 §3.3.11 (TEXT value type). */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/** Folds a content line to <=75 octets per line as required by RFC 5545 §3.1. */
function foldLine(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;

  const chunks: string[] = [];
  let rest = line;
  let first = true;
  while (rest.length > 0) {
    const limit = first ? 75 : 74; // continuation lines are prefixed with one space
    let end = Math.min(limit, rest.length);
    // avoid splitting inside a multi-byte UTF-8 character
    while (new TextEncoder().encode(rest.slice(0, end)).length > limit && end > 0) {
      end--;
    }
    chunks.push((first ? "" : " ") + rest.slice(0, end));
    rest = rest.slice(end);
    first = false;
  }
  return chunks.join(CRLF);
}

function line(name: string, value: string): string {
  return foldLine(`${name}:${value}`);
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, "0");
}

/** Formats a local datetime-local string as a UTC ICS DATE-TIME, e.g. 20260920T063000Z. */
function formatUtc(localDateTime: string): string {
  const d = new Date(localDateTime);
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/**
 * Formats a local date as an ICS DATE (all-day), e.g. 20260920.
 * Accepts either "yyyy-MM-dd" or a datetime-local string; a bare date-only
 * string is parsed as UTC by `Date`, so a time-of-day is appended to force
 * local-time parsing and keep the calendar date the user actually picked.
 */
function formatDateOnly(localDate: string): string {
  const d = new Date(localDate.includes("T") ? localDate : `${localDate}T00:00:00`);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

function durationFromMinutes(totalMinutes: number): string {
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days === 0 && hours === 0 && minutes === 0) return "PT0M";
  let out = "P";
  if (days) out += `${days}D`;
  if (hours || minutes) {
    out += "T";
    if (hours) out += `${hours}H`;
    if (minutes) out += `${minutes}M`;
  }
  return out;
}

function serializeRecurrence(recurrence: Recurrence, allDay: boolean): string {
  const parts = [`FREQ=${recurrence.freq}`, `INTERVAL=${recurrence.interval}`];
  if (recurrence.byDay && recurrence.byDay.length > 0) {
    parts.push(`BYDAY=${recurrence.byDay.join(",")}`);
  }
  if (recurrence.until) {
    const untilDate = allDay
      ? formatDateOnly(recurrence.until)
      : formatUtc(`${recurrence.until}T23:59:59`);
    parts.push(`UNTIL=${untilDate}`);
  }
  return parts.join(";");
}

async function arrayBufferToBase64(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function attachmentsForEvent(event: ParsedEvent, attachments: Attachment[]): Attachment[] {
  return attachments.filter(
    (a) => a.assignment === "all" || a.assignment.includes(event.id)
  );
}

export interface BuildIcsOptions {
  /** Files at or below this size (bytes) get base64-embedded; larger ones are only named in the description. */
  attachmentThresholdBytes: number;
}

export async function buildIcs(
  events: ParsedEvent[],
  attachments: Attachment[],
  options: BuildIcsOptions
): Promise<string> {
  const now = formatUtc(new Date().toISOString());

  const veventBlocks = await Promise.all(
    events.map((event) => buildVevent(event, attachments, options, now))
  );

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//calendar-importer//local//ZH",
    "CALSCALE:GREGORIAN",
    ...veventBlocks,
    "END:VCALENDAR",
  ];
  return lines.join(CRLF) + CRLF;
}

async function buildVevent(
  event: ParsedEvent,
  attachments: Attachment[],
  options: BuildIcsOptions,
  dtstamp: string
): Promise<string> {
  const lines: string[] = ["BEGIN:VEVENT"];
  lines.push(line("UID", uid()));
  lines.push(line("DTSTAMP", dtstamp));

  if (event.allDay) {
    lines.push(line("DTSTART;VALUE=DATE", formatDateOnly(event.start)));
    lines.push(line("DTEND;VALUE=DATE", formatDateOnly(event.end)));
  } else {
    lines.push(line("DTSTART", formatUtc(event.start)));
    lines.push(line("DTEND", formatUtc(event.end)));
  }

  lines.push(line("SUMMARY", escapeText(event.title)));
  if (event.location) lines.push(line("LOCATION", escapeText(event.location)));

  lines.push(
    line("TRANSP", event.busyStatus === "busy" ? "OPAQUE" : "TRANSPARENT")
  );

  if (event.recurrence) {
    lines.push(line("RRULE", serializeRecurrence(event.recurrence, event.allDay)));
  }

  const eventAttachments = attachmentsForEvent(event, attachments);
  const oversized = eventAttachments.filter((a) => a.size > options.attachmentThresholdBytes);
  const embedded = eventAttachments.filter((a) => a.size <= options.attachmentThresholdBytes);

  let description = event.notes;
  if (oversized.length > 0) {
    const note = oversized
      .map((a) => `附件（未随行，请自行准备）：${a.name}`)
      .join("\n");
    description = description ? `${description}\n${note}` : note;
  }
  if (description) lines.push(line("DESCRIPTION", escapeText(description)));

  for (const reminder of event.reminders) {
    lines.push("BEGIN:VALARM");
    lines.push(line("ACTION", "DISPLAY"));
    lines.push(line("DESCRIPTION", escapeText(event.title || "日程提醒")));
    lines.push(line("TRIGGER", `-${durationFromMinutes(reminder.minutesBefore)}`));
    lines.push("END:VALARM");
  }

  for (const attachment of embedded) {
    const base64 = await arrayBufferToBase64(await attachment.file.arrayBuffer());
    const fmtType = attachment.file.type || "application/octet-stream";
    lines.push(
      line(
        `ATTACH;FMTTYPE=${fmtType};ENCODING=BASE64;VALUE=BINARY;X-FILENAME=${attachment.name}`,
        base64
      )
    );
  }

  lines.push("END:VEVENT");
  return lines.join(CRLF);
}
