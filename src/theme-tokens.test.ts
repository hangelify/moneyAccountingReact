import { describe, expect, it } from 'vitest';
import css from './index.css?raw';

type Rgb = [number, number, number];
type Theme = 'root' | 'dark';

const STATES = ['success', 'warning', 'info'];
const AA = 4.5;

// `--name: H S% L%;` declarations of one `selector { … }` block in index.css
function readBlock(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  const body = css.slice(start, css.indexOf('}', start));
  const vars: Record<string, string> = {};
  for (const line of body.split('\n')) {
    const decl = line.trim();
    const colon = decl.indexOf(':');
    if (!decl.startsWith('--') || colon < 0) continue;
    vars[decl.slice(2, colon)] = decl
      .slice(colon + 1)
      .replace(';', '')
      .trim();
  }
  return vars;
}

const tokens: Record<Theme, Record<string, string | undefined>> = {
  root: readBlock(':root'),
  dark: readBlock('.dark'),
};

function hslToRgb(value: string): Rgb {
  const [h = 0, s = 0, l = 0] = value
    .split(/\s+/)
    .map((part) => Number.parseFloat(part));
  const sat = s / 100;
  const light = l / 100;
  const a = sat * Math.min(light, 1 - light);
  const channel = (n: number): number => {
    const k = (n + h / 30) % 12;
    return light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [channel(0), channel(8), channel(4)];
}

function token(theme: Theme, name: string): Rgb {
  const value = tokens[theme][name];
  if (value === undefined) throw new Error(`--${name} missing in ${theme}`);
  return hslToRgb(value);
}

function luminance([r, g, b]: Rgb): number {
  const lin = (c: number): number =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

// `fg` at `alpha` over `bg`, as `bg-<state>/10` renders
function blend(fg: Rgb, bg: Rgb, alpha: number): Rgb {
  const mix = (f: number, b: number): number => alpha * f + (1 - alpha) * b;
  return [mix(fg[0], bg[0]), mix(fg[1], bg[1]), mix(fg[2], bg[2])];
}

describe.each(['root', 'dark'] as const)('%s theme tokens', (theme) => {
  it.each(STATES)('%s and its foreground are defined', (s) => {
    expect(tokens[theme][s]).toBeDefined();
    expect(tokens[theme][`${s}-foreground`]).toBeDefined();
  });

  it.each(STATES)('%s text is AA on background', (s) => {
    expect(
      contrast(token(theme, s), token(theme, 'background'))
    ).toBeGreaterThanOrEqual(AA);
  });

  it.each(STATES)('%s text is AA on its /10 soft surface', (s) => {
    const surface = blend(token(theme, s), token(theme, 'background'), 0.1);
    expect(contrast(token(theme, s), surface)).toBeGreaterThanOrEqual(AA);
  });

  it.each(STATES)('%s foreground is AA on the solid color', (s) => {
    expect(
      contrast(token(theme, `${s}-foreground`), token(theme, s))
    ).toBeGreaterThanOrEqual(AA);
  });
});
