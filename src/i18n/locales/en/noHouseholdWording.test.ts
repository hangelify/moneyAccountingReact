import { describe, expect, it } from 'vitest';

const modules = import.meta.glob<Record<string, unknown>>('./*.json', {
  eager: true,
  import: 'default',
});

function collect(value: unknown, path: string, out: string[]): void {
  if (typeof value === 'string') {
    if (/household/i.test(value)) out.push(path);
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      collect(child, `${path}.${key}`, out);
    }
  }
}

describe('en locale wording', () => {
  it('never calls a budget a household in user-facing text', () => {
    const offending: string[] = [];
    for (const [file, content] of Object.entries(modules)) {
      collect(content, file, offending);
    }
    expect(offending).toEqual([]);
  });
});
