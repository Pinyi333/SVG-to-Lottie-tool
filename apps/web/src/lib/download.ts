/**
 * Saves text to a file the visitor chooses a location for.
 *
 * Everything this app produces is generated in the browser, so there is no URL
 * to link to; an object URL is created, clicked, and revoked immediately.
 */
export function downloadText(filename: string, contents: string, mime: string): void {
  const blob = new Blob([contents], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking immediately is safe: the download has already been handed off.
  URL.revokeObjectURL(url);
}

/**
 * Copies text to the clipboard, falling back for browsers and contexts where
 * the async Clipboard API is unavailable — it needs a secure context, which
 * a local file:// preview is not.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy path rather than reporting failure early.
  }

  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand('copy');
    area.remove();
    return copied;
  } catch {
    return false;
  }
}
