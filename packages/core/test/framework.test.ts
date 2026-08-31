import { describe, expect, it } from 'vitest';
import { parseSvg } from '../src/parse/index.js';
import { createSpec, createTrack } from '../src/spec.js';
import { toReact } from '../src/render/react.js';
import { toVue } from '../src/render/vue.js';
import { componentName } from '../src/render/framework.js';
import { fixture } from './helpers.js';

function specFor(name: string, preset: Parameters<typeof createTrack>[1] = 'strokeDraw') {
  const spec = createSpec(parseSvg(fixture(name)));
  spec.tracks = [createTrack('tick', preset)];
  return spec;
}

describe('componentName', () => {
  it('normalizes arbitrary input to PascalCase', () => {
    expect(componentName('check circle', 'X')).toBe('CheckCircle');
    expect(componentName('check-circle-icon', 'X')).toBe('CheckCircleIcon');
    expect(componentName('my_icon.svg', 'X')).toBe('MyIconSvg');
  });

  it('falls back when given nothing usable', () => {
    expect(componentName(undefined, 'AnimatedIcon')).toBe('AnimatedIcon');
    expect(componentName('   ', 'AnimatedIcon')).toBe('AnimatedIcon');
  });

  it('never produces a name starting with a digit', () => {
    expect(componentName('3d-cube', 'X')).toBe('Icon3dCube');
  });
});

describe('toReact', () => {
  const output = toReact(specFor('icon-check.svg'), { name: 'check-icon' });

  it('names the component and the file consistently', () => {
    expect(output.filename).toBe('CheckIcon.tsx');
    expect(output.code).toContain('export function CheckIcon(');
    expect(output.code).toContain('export default CheckIcon;');
  });

  it('uses className rather than class, which React rejects', () => {
    expect(output.code).toContain('className=');
    expect(output.code).not.toMatch(/\bclass=/);
  });

  it('keeps hyphenated SVG attributes, which React passes through', () => {
    expect(output.code).toContain('stroke-width=');
    expect(output.code).toContain('stroke-linecap=');
  });

  it('inlines the stylesheet so the component needs no CSS import', () => {
    expect(output.code).toContain('<style>{css}</style>');
    expect(output.code).toContain('@keyframes');
    expect(output.code).not.toContain("import './");
  });

  it('forwards props so the caller can size and label the icon', () => {
    expect(output.code).toContain('props: SVGProps<SVGSVGElement>');
    expect(output.code).toContain('{...props}');
  });

  it('escapes sequences that would break out of the template literal', () => {
    const spec = createSpec(parseSvg(fixture('icon-check.svg')));
    spec.tracks = [createTrack('tick', 'fade')];
    // A prefix carrying a backtick would otherwise terminate the literal.
    const risky = toReact(spec, { name: 'Risky', prefix: 'a`b${c}' });
    const literal = risky.code.slice(risky.code.indexOf('const css = `'));
    const body = literal.slice('const css = `'.length, literal.indexOf('\n`;'));
    expect(body).not.toMatch(/(^|[^\\])`/);
    expect(body).not.toMatch(/(^|[^\\])\$\{/);
  });
});

describe('toVue', () => {
  const output = toVue(specFor('icon-check.svg'), { name: 'check icon' });

  it('names the component and the file consistently', () => {
    expect(output.filename).toBe('CheckIcon.vue');
  });

  it('emits the three blocks of a single-file component', () => {
    expect(output.code).toContain('<template>');
    expect(output.code).toContain('<script setup lang="ts">');
    expect(output.code).toContain('<style scoped>');
  });

  it('keeps class, which Vue templates use directly', () => {
    expect(output.code).toMatch(/\bclass=/);
    expect(output.code).not.toContain('className=');
  });

  it('scopes the stylesheet so two icons cannot collide', () => {
    expect(output.code).toContain('<style scoped>');
    expect(output.code).toContain('@keyframes');
  });
});

describe('both frameworks', () => {
  it('carry the same animation as the CSS export', () => {
    for (const preset of ['fade', 'scale', 'rotate', 'bounce', 'strokeDraw'] as const) {
      const spec = specFor('icon-check.svg', preset);
      const react = toReact(spec, { name: 'Icon' });
      const vue = toVue(spec, { name: 'Icon' });
      for (const code of [react.code, vue.code]) {
        expect(code).toContain('animation:');
        expect(code).not.toMatch(/NaN|undefined/);
      }
    }
  });

  it('pass warnings through to the caller', () => {
    const spec = createSpec(parseSvg(fixture('shapes.svg')));
    spec.tracks = [createTrack('box', 'strokeDraw')];
    expect(toReact(spec).warnings.length).toBeGreaterThan(0);
    expect(toVue(spec).warnings.length).toBeGreaterThan(0);
  });
});
