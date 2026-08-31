import type { Warning } from '../types.js';

/**
 * Elements that are removed outright. These either execute script, embed
 * arbitrary HTML, or pull in remote documents.
 */
const FORBIDDEN_ELEMENTS = new Set([
  'script',
  'foreignobject',
  'iframe',
  'embed',
  'object',
  'audio',
  'video',
  'set',
  'handler',
  'listener',
]);

/** Attributes that can navigate to or fetch a remote/script URL. */
const URL_ATTRIBUTES = ['href', 'xlink:href', 'src', 'from', 'to', 'values', 'begin', 'end'];

/** Schemes allowed in the attributes above. Everything else is stripped. */
const SAFE_URL = /^(#|data:image\/(png|jpeg|gif|webp);base64,)/i;

function isEventAttribute(name: string): boolean {
  return name.toLowerCase().startsWith('on');
}

/**
 * Removes script execution vectors from an already-parsed SVG document, in
 * place. The web app renders uploaded SVG directly into the page for preview,
 * so this runs before anything touches the DOM, not as a formality at export.
 *
 * This is deliberately a denylist over a parsed DOM rather than a regex over
 * markup: regex sanitizers on SVG are routinely bypassed by entity and
 * namespace tricks that the parser has already resolved by this point.
 */
export function sanitizeElement(root: Element, warnings: Warning[]): Element {
  const seen = new Set<string>();

  const warnOnce = (code: Warning['code'], subject: string, message: string) => {
    const key = `${code}:${subject}`;
    if (seen.has(key)) return;
    seen.add(key);
    warnings.push({ code, subject, message });
  };

  // Collect first, then remove: mutating while walking a live NodeList skips nodes.
  const doomed: Element[] = [];
  const walk = (el: Element) => {
    const tag = el.tagName.toLowerCase();
    if (FORBIDDEN_ELEMENTS.has(tag)) {
      doomed.push(el);
      warnOnce('removed-for-safety', tag, `<${tag}> was removed because it can execute script.`);
      return;
    }

    for (const attr of Array.from(el.attributes)) {
      const name = attr.name;
      const value = attr.value;

      if (isEventAttribute(name)) {
        el.removeAttribute(name);
        warnOnce(
          'removed-for-safety',
          name,
          `Event handler attribute "${name}" was removed from <${tag}>.`,
        );
        continue;
      }

      if (URL_ATTRIBUTES.includes(name.toLowerCase()) && value.trim() !== '') {
        // Local fragment references and inline images are fine; anything that
        // can reach the network or the script engine is not.
        if (!SAFE_URL.test(value.trim())) {
          el.removeAttribute(name);
          warnOnce(
            'removed-for-safety',
            name,
            `External or unsafe reference in "${name}" was removed from <${tag}>.`,
          );
        }
        continue;
      }

      if (name.toLowerCase() === 'style' && /javascript:|expression\s*\(/i.test(value)) {
        el.removeAttribute(name);
        warnOnce('removed-for-safety', 'style', `Unsafe style attribute removed from <${tag}>.`);
      }
    }

    for (const child of Array.from(el.children)) walk(child);
  };

  walk(root);
  for (const el of doomed) el.remove();
  return root;
}
