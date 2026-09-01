import { describe, expect, it } from 'vitest';
import { htmlEmbed, iframeEmbed, reactEmbed, vueEmbed } from './embed.js';

const OPTIONS = {
  url: 'https://example.com/animation.json',
  loop: true,
  speed: 1.5,
  width: 320,
  background: '#ffffff',
};

describe('embed snippets', () => {
  it('carry every setting into the HTML snippet', () => {
    const code = htmlEmbed(OPTIONS);
    expect(code).toContain("path: 'https://example.com/animation.json'");
    expect(code).toContain('loop: true');
    expect(code).toContain('setSpeed(1.5)');
    expect(code).toContain('width:320px');
  });

  it('escape quotes when nesting the snippet in an iframe srcdoc attribute', () => {
    const code = iframeEmbed(OPTIONS);
    // An unescaped quote here would terminate the attribute and break the page.
    const srcdoc = code.slice(code.indexOf('srcdoc="') + 'srcdoc="'.length, code.lastIndexOf('"'));
    expect(srcdoc).not.toContain('"');
    expect(srcdoc).toContain('&quot;');
  });

  it('destroy the animation on unmount in both frameworks', () => {
    // lottie-web keeps a requestAnimationFrame loop per animation, so a
    // snippet that leaks one is a snippet that degrades the host page.
    expect(reactEmbed(OPTIONS)).toContain('animation.destroy()');
    expect(vueEmbed(OPTIONS)).toContain('animation?.destroy()');
  });

  it('produce framework snippets that reference the right lifecycle hooks', () => {
    expect(reactEmbed(OPTIONS)).toContain('useEffect');
    expect(reactEmbed(OPTIONS)).toContain('useRef');
    expect(vueEmbed(OPTIONS)).toContain('onMounted');
    expect(vueEmbed(OPTIONS)).toContain('onBeforeUnmount');
  });

  it('never leave a placeholder unsubstituted', () => {
    for (const code of [
      htmlEmbed(OPTIONS),
      iframeEmbed(OPTIONS),
      reactEmbed(OPTIONS),
      vueEmbed(OPTIONS),
    ]) {
      expect(code).not.toMatch(/\$\{|undefined|NaN/);
    }
  });
});
