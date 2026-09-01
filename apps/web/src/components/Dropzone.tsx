import { useCallback, useRef, useState, type DragEvent } from 'react';
import { useI18n } from '../i18n/index.js';

/** Files above this size are rejected before parsing, which would block the UI. */
const MAX_BYTES = 2 * 1024 * 1024;

export function Dropzone({
  accept,
  title,
  hint,
  rejectMessage,
  onFile,
  children,
}: {
  accept: string;
  title: string;
  hint: string;
  rejectMessage: string;
  /** Receives the accepted file. Reading it is the caller's business: an SVG
   * is text, a `.lottie` archive is bytes. Throwing rejects the file. */
  onFile: (file: File) => void | Promise<void>;
  children?: React.ReactNode;
}) {
  const { t, format } = useI18n();
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const accepts = useCallback(
    (file: File) => {
      const extensions = accept.split(',').map((part) => part.trim().toLowerCase());
      return extensions.some(
        (extension) => file.name.toLowerCase().endsWith(extension) || file.type === extension,
      );
    },
    [accept],
  );

  const handleFile = useCallback(
    async (file: File | undefined) => {
      setError(null);
      if (!file) return;

      if (!accepts(file)) {
        setError(rejectMessage);
        return;
      }
      if (file.size > MAX_BYTES) {
        setError(format(t.drop.tooLarge, { size: '2 MB' }));
        return;
      }

      try {
        await onFile(file);
      } catch {
        setError(rejectMessage);
      }
    },
    [accepts, format, onFile, rejectMessage, t.drop.tooLarge],
  );

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    void handleFile(event.dataTransfer.files[0]);
  };

  return (
    <div className="space-y-2">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click();
        }}
        role="button"
        tabIndex={0}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${
          dragging
            ? 'border-accent bg-accent-soft dark:bg-slate-800'
            : 'border-slate-300 hover:border-accent dark:border-slate-700'
        }`}
      >
        <p className="text-sm font-medium">{title}</p>
        <p className="max-w-sm text-xs text-slate-500">{hint}</p>
        {children}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={(event) => {
            void handleFile(event.target.files?.[0]);
            // Reset so choosing the same file twice still fires a change.
            event.target.value = '';
          }}
        />
      </div>
      {error ? (
        <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
