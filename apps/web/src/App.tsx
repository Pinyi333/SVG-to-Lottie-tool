import { useCallback, useState } from 'react';
import { Animate } from './routes/Animate.js';
import { Playground } from './routes/Playground.js';
import { LOCALE_LABELS, useI18n, type Locale } from './i18n/index.js';
import { Tabs } from './components/ui.js';

type Workspace = 'animate' | 'playground';

const REPOSITORY = 'https://github.com/Pinyi333/SVG-to-Lottie-tool';

export function App() {
  const { t, locale, setLocale } = useI18n();
  const [workspace, setWorkspace] = useState<Workspace>('animate');
  const [handoff, setHandoff] = useState<unknown | null>(null);

  // Sending an animation across is what makes one app out of two workspaces:
  // export from Animate, then tune playback and grab an embed in Playground.
  const sendToPlayground = useCallback((data: unknown) => {
    setHandoff(data);
    setWorkspace('playground');
  }, []);

  const consumeHandoff = useCallback(() => setHandoff(null), []);

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 px-4 py-5">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="mr-auto">
          <h1 className="text-lg font-semibold tracking-tight">{t.appName}</h1>
          <p className="text-xs text-slate-500">{t.tagline}</p>
        </div>

        <Tabs
          value={workspace}
          onChange={setWorkspace}
          options={[
            { value: 'animate' as const, label: t.nav.animate },
            { value: 'playground' as const, label: t.nav.playground },
          ]}
        />

        <select
          aria-label="Language"
          className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
          value={locale}
          onChange={(event) => setLocale(event.target.value as Locale)}
        >
          {(Object.keys(LOCALE_LABELS) as Locale[]).map((value) => (
            <option key={value} value={value}>
              {LOCALE_LABELS[value]}
            </option>
          ))}
        </select>
      </header>

      <main className="flex-1">
        {workspace === 'animate' ? (
          <Animate onSendToPlayground={sendToPlayground} />
        ) : (
          <Playground incoming={handoff} onConsumeIncoming={consumeHandoff} />
        )}
      </main>

      <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-200 pt-3 text-xs text-slate-500 dark:border-slate-800">
        <a className="hover:text-accent" href={REPOSITORY}>
          {t.footer.source}
        </a>
        <a className="hover:text-accent" href={`${REPOSITORY}#readme`}>
          {t.footer.docs}
        </a>
        <span className="ml-auto">{t.footer.license}</span>
      </footer>
    </div>
  );
}
