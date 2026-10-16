import type { ParsedEvent } from "../types";

/**
 * Builds an Outlook "compose event" deep link. Outlook's mobile app has no
 * generic .ics import, but it does register outlook.office.com as an Android
 * App Link, so opening this URL jumps straight into a prefilled "new event"
 * screen in the app instead of the ics file being a dead end.
 *
 * Hard limitation of this protocol (not something we can work around): it
 * only carries subject/time/location/body. Reminders, recurrence, busy/free
 * status, and attachments never make it through — the ics export remains the
 * only way to bring those into the calendar.
 */
export function buildOutlookComposeUrl(event: ParsedEvent): string {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: event.title,
    location: event.location,
    body: event.notes,
    allday: String(event.allDay),
  });

  if (event.allDay) {
    params.set("startdt", event.start.slice(0, 10));
    params.set("enddt", event.end.slice(0, 10));
  } else {
    params.set("startdt", new Date(event.start).toISOString());
    params.set("enddt", new Date(event.end).toISOString());
  }

  return `https://outlook.office.com/calendar/0/deeplink/compose?${params.toString()}`;
}
