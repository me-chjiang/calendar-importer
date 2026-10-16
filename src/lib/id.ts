/** Short unique id for client-side list items (events, reminders, attachments). */
export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
