import { useState } from "react";
import type { Attachment, ParsedEvent } from "./types";
import { parseNoticeText, DeepSeekError } from "./lib/deepseek";
import { buildIcs } from "./lib/ics";
import { exportIcs } from "./lib/share";
import { loadSettings, saveSettings, type Settings } from "./lib/settings";
import { EventEditor } from "./components/EventEditor";
import { AttachmentPicker } from "./components/AttachmentPicker";
import { SettingsModal } from "./components/SettingsModal";

type Step = "input" | "confirm";

function icsFilename(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `日程-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(
    now.getHours()
  )}${pad(now.getMinutes())}.ics`;
}

export default function App() {
  const [step, setStep] = useState<Step>("input");
  const [noticeText, setNoticeText] = useState("");
  const [events, setEvents] = useState<ParsedEvent[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSaveSettings(next: Settings) {
    setSettings(next);
    saveSettings(next);
  }

  async function handleParse() {
    setError(null);
    if (!noticeText.trim()) {
      setError("请先粘贴通知文字");
      return;
    }
    setParsing(true);
    try {
      const parsed = await parseNoticeText(noticeText, settings.deepseekApiKey);
      setEvents(parsed);
      setStep("confirm");
    } catch (err) {
      setError(err instanceof DeepSeekError ? err.message : `解析失败：${(err as Error).message}`);
    } finally {
      setParsing(false);
    }
  }

  function handleSkipAI() {
    setError(null);
    setStep("confirm");
  }

  async function handleGenerate() {
    setError(null);
    if (events.length === 0) {
      setError("至少需要一条日程才能生成 ics");
      return;
    }
    setExporting(true);
    try {
      const ics = await buildIcs(events, attachments, {
        attachmentThresholdBytes: settings.attachmentThresholdBytes,
      });
      await exportIcs(ics, icsFilename());
    } catch (err) {
      setError(`生成/导出失败：${(err as Error).message}`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>通知转日历</h1>
        <button type="button" onClick={() => setSettingsOpen(true)}>
          设置
        </button>
      </header>

      {error && <div className="error-banner">{error}</div>}

      {step === "input" && (
        <section className="input-step">
          <label className="field">
            <span>通知文字</span>
            <textarea
              rows={10}
              placeholder="把通知/邮件/群消息里的文字粘贴到这里..."
              value={noticeText}
              onChange={(e) => setNoticeText(e.target.value)}
            />
          </label>

          <div className="actions">
            <button type="button" className="primary" onClick={handleParse} disabled={parsing}>
              {parsing ? "解析中..." : "AI 解析"}
            </button>
            <button type="button" onClick={handleSkipAI} disabled={parsing}>
              跳过 AI，手动添加日程
            </button>
          </div>
        </section>
      )}

      {step === "confirm" && (
        <section className="confirm-step">
          <p className="hint">请核对/修改下面的日程信息，确认无误后再生成 ics。</p>

          <EventEditor events={events} onChange={setEvents} />

          <AttachmentPicker
            attachments={attachments}
            events={events}
            thresholdBytes={settings.attachmentThresholdBytes}
            onChange={setAttachments}
          />

          <div className="actions">
            <button type="button" onClick={() => setStep("input")}>
              返回修改文字
            </button>
            <button type="button" className="primary" onClick={handleGenerate} disabled={exporting}>
              {exporting ? "生成中..." : "生成并导出 ics"}
            </button>
          </div>
        </section>
      )}

      {settingsOpen && (
        <SettingsModal
          settings={settings}
          onSave={handleSaveSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
