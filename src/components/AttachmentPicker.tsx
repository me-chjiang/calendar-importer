import { useRef } from "react";
import type { Attachment, ParsedEvent } from "../types";
import { newId } from "../lib/id";

interface AttachmentPickerProps {
  attachments: Attachment[];
  events: ParsedEvent[];
  thresholdBytes: number;
  onChange: (attachments: Attachment[]) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentPicker({
  attachments,
  events,
  thresholdBytes,
  onChange,
}: AttachmentPickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const added: Attachment[] = Array.from(fileList).map((file) => ({
      id: newId(),
      file,
      name: file.name,
      size: file.size,
      assignment: "all",
    }));
    onChange([...attachments, ...added]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeAttachment(id: string) {
    onChange(attachments.filter((a) => a.id !== id));
  }

  function updateAssignment(id: string, assignment: Attachment["assignment"]) {
    onChange(attachments.map((a) => (a.id === id ? { ...a, assignment } : a)));
  }

  function toggleEventForAttachment(attachment: Attachment, eventId: string) {
    const current = attachment.assignment === "all" ? [] : attachment.assignment;
    const next = current.includes(eventId)
      ? current.filter((id) => id !== eventId)
      : [...current, eventId];
    updateAssignment(attachment.id, next);
  }

  return (
    <div className="attachment-picker">
      <h3>附件</h3>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={(e) => handleFilesSelected(e.target.files)}
      />

      {attachments.length === 0 && <p className="hint">还没有添加附件（可选）。</p>}

      <ul className="attachment-list">
        {attachments.map((attachment) => {
          const oversized = attachment.size > thresholdBytes;
          const isAll = attachment.assignment === "all";
          return (
            <li key={attachment.id} className="attachment-item">
              <div className="attachment-row">
                <span className="attachment-name">{attachment.name}</span>
                <span className="attachment-size">{formatSize(attachment.size)}</span>
                {oversized && (
                  <span className="badge badge-warning" title="文件较大，只会把文件名写进备注，不会内嵌到 ics 里">
                    仅记录文件名
                  </span>
                )}
                <button type="button" onClick={() => removeAttachment(attachment.id)}>
                  移除
                </button>
              </div>

              {events.length > 1 && (
                <div className="attachment-assignment">
                  <label>
                    <input
                      type="checkbox"
                      checked={isAll}
                      onChange={(e) =>
                        updateAssignment(attachment.id, e.target.checked ? "all" : [])
                      }
                    />
                    应用到全部事件
                  </label>
                  {!isAll && (
                    <div className="attachment-event-checkboxes">
                      {events.map((event) => (
                        <label key={event.id}>
                          <input
                            type="checkbox"
                            checked={
                              attachment.assignment !== "all" &&
                              attachment.assignment.includes(event.id)
                            }
                            onChange={() => toggleEventForAttachment(attachment, event.id)}
                          />
                          {event.title || "(未命名日程)"}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
