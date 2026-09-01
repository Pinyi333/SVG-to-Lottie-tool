import type { Warning } from 'svgmotion';
import { useI18n } from '../i18n/index.js';

/**
 * Surfaces everything the exporters could not carry across.
 *
 * These are shown rather than logged deliberately: an export tool that
 * silently drops a gradient teaches people not to trust its output.
 */
export function WarningList({ warnings }: { warnings: Warning[] }) {
  const { t } = useI18n();
  if (warnings.length === 0) return null;

  // The same issue can be reported by several exporters at once.
  const unique = [
    ...new Map(warnings.map((w) => [`${w.code}:${w.subject}:${w.message}`, w])).values(),
  ];

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-700/60 dark:bg-amber-950/40">
      <p className="mb-1.5 text-xs font-semibold text-amber-900 dark:text-amber-200">
        {t.warnings.title}
      </p>
      <ul className="space-y-1">
        {unique.map((warning, index) => (
          <li
            key={index}
            className="text-xs leading-relaxed text-amber-900/90 dark:text-amber-100/90"
          >
            {warning.subject ? (
              <code className="rounded bg-amber-100 px-1 font-mono dark:bg-amber-900/60">
                {warning.subject}
              </code>
            ) : null}{' '}
            {warning.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
