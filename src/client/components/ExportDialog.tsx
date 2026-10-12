import { useState } from "react";

interface Props {
  text: string;
  onClose: () => void;
}

export function ExportDialog({ text, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal">
        <div className="modal-head">
          <h2>导出本月日程</h2>
          <button className="btn small" onClick={onClose}>
            关闭
          </button>
        </div>
        <p className="muted small-text">
          已隐藏公司、职位、轮次等面试细节，仅保留今天起的占用时段，可复制后发给 HR 安排。
        </p>
        <textarea className="export-text" readOnly rows={14} value={text} />
        <div className="form-actions">
          <button className="btn primary" onClick={copy}>
            {copied ? "已复制" : "复制"}
          </button>
          <button className="btn" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
