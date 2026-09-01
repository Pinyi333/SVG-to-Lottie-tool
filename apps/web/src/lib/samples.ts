/**
 * Sample icons, so the tool is usable before a visitor has found a file.
 *
 * Each is hand-written here rather than pulled from an icon set, which keeps
 * the app free of a third party's licence terms.
 */
export interface Sample {
  id: string;
  label: string;
  svg: string;
}

export const SAMPLES: Sample[] = [
  {
    id: 'check',
    label: 'Check',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle id="ring" cx="12" cy="12" r="10" />
  <path id="tick" d="M8 12.5 11 15.5 16.5 9" />
</svg>`,
  },
  {
    id: 'bell',
    label: 'Bell',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path id="body" d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
  <path id="clapper" d="M13.7 21a2 2 0 0 1-3.4 0" />
</svg>`,
  },
  {
    id: 'chart',
    label: 'Chart',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <rect id="bar-1" x="3" y="13" width="4" height="8" rx="1" fill="#a5b4fc" />
  <rect id="bar-2" x="10" y="8" width="4" height="13" rx="1" fill="#6366f1" />
  <rect id="bar-3" x="17" y="4" width="4" height="17" rx="1" fill="#4338ca" />
</svg>`,
  },
];
