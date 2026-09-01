import { useEffect, useState } from 'react';
import { copyText, downloadText } from '../lib/download.js';
import { useI18n } from '../i18n/index.js';
import { Button } from './ui.js';

/** Longer output is clipped in the viewer; the download always has everything. */
const PREVIEW_LIMIT = 20000;

export function CodeBlock({
  code,
  filename,
  mime,
  actions,
}: {
  code: string;
  filename: string;
  mime: string;
  actions?: React.ReactNode;
}) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  const clipped = code.length > PREVIEW_LIMIT;
  const shown = clipped ? `${code.slice(0, PREVIEW_LIMIT)}\n…` : code;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() => {
            void copyText(code).then(setCopied);
          }}
        >
          {copied ? t.exportPanel.copied : t.exportPanel.copy}
        </Button>
        <Button onClick={() => downloadText(filename, code, mime)}>{t.exportPanel.download}</Button>
        <span className="font-mono text-xs text-slate-500">{filename}</span>
        <div className="ml-auto flex gap-2">{actions}</div>
      </div>
      <pre className="max-h-80 overflow-auto rounded-lg bg-slate-900 p-3 text-xs leading-relaxed text-slate-100 dark:bg-slate-950">
        <code>{shown}</code>
      </pre>
      {clipped ? (
        <p className="text-xs text-slate-500">
          Preview truncated at {PREVIEW_LIMIT.toLocaleString()} characters. The download and the
          copy button both include the whole file.
        </p>
      ) : null}
    </div>
  );
}
