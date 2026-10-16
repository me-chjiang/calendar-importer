import { useState } from "react";
import type { Settings } from "../lib/settings";

interface SettingsModalProps {
  settings: Settings;
  onSave: (settings: Settings) => void;
  onClose: () => void;
}

export function SettingsModal({ settings, onSave, onClose }: SettingsModalProps) {
  const [apiKey, setApiKey] = useState(settings.deepseekApiKey);
  const [showKey, setShowKey] = useState(false);
  const [thresholdKb, setThresholdKb] = useState(
    Math.round(settings.attachmentThresholdBytes / 1024)
  );

  function handleSave() {
    onSave({
      deepseekApiKey: apiKey.trim(),
      attachmentThresholdBytes: Math.max(0, thresholdKb) * 1024,
    });
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>设置</h2>

        <label className="field">
          <span>DeepSeek API Key</span>
          <div className="input-with-button">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              autoComplete="off"
            />
            <button type="button" onClick={() => setShowKey((v) => !v)}>
              {showKey ? "隐藏" : "显示"}
            </button>
          </div>
          <p className="hint">
            只保存在本机浏览器 localStorage 里，直接从浏览器调用 DeepSeek API，不经过任何自建服务器。
          </p>
        </label>

        <label className="field">
          <span>附件内嵌阈值（KB）</span>
          <input
            type="number"
            min={0}
            value={thresholdKb}
            onChange={(e) => setThresholdKb(Number(e.target.value) || 0)}
          />
          <p className="hint">小于等于这个大小的附件会被完整内嵌进 ics；超过的只在备注里记录文件名。</p>
        </label>

        <div className="modal-actions">
          <button type="button" onClick={() => setApiKey("")}>
            清空 Key
          </button>
          <div className="spacer" />
          <button type="button" onClick={onClose}>
            取消
          </button>
          <button type="button" className="primary" onClick={handleSave}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
