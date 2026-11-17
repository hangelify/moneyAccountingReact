import { describe, it, expect } from 'vitest';
import { billPath, withHid } from './billPath';

describe('billPath', () => {
  it.each([
    ['all', '/bills/b1?hid=hh-2'],
    ['confirmed', '/bills/confirmed/b1?hid=hh-2'],
    ['drafts', '/bills/drafts/b1?hid=hh-2'],
  ] as const)('%s -> %s', (section, expected) => {
    expect(billPath(section, 'b1', 'hh-2')).toBe(expected);
  });

  it('keeps other params and replaces hid', () => {
    expect(billPath('confirmed', 'b1', 'new', '?from=x&hid=old')).toBe(
      '/bills/confirmed/b1?from=x&hid=new'
    );
  });
});

describe('withHid', () => {
  it('adds hid to an empty search', () => {
    expect(withHid('', 'hh-1')).toBe('?hid=hh-1');
  });

  it('keeps other params and replaces hid', () => {
    expect(withHid('?from=x&hid=old', 'new')).toBe('?from=x&hid=new');
  });
});
