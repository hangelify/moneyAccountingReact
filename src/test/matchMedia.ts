// Fake window.matchMedia for tests; jsdom has none, so useMediaQuery is
// false (mobile) unless a test installs this.
export function mockMatchMedia(initial: boolean): {
  setMatches: (next: boolean) => void;
  restore: () => void;
} {
  const original = Object.getOwnPropertyDescriptor(window, 'matchMedia');
  let matches = initial;
  const listeners = new Set<() => void>();
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (media: string): MediaQueryList =>
      ({
        get matches() {
          return matches;
        },
        media,
        onchange: null,
        addEventListener: (_: string, cb: () => void) => listeners.add(cb),
        removeEventListener: (_: string, cb: () => void) =>
          listeners.delete(cb),
        addListener: (cb: () => void) => listeners.add(cb),
        removeListener: (cb: () => void) => listeners.delete(cb),
        dispatchEvent: () => true,
      }) as unknown as MediaQueryList,
  });
  return {
    setMatches(next) {
      matches = next;
      listeners.forEach((cb) => cb());
    },
    restore() {
      if (original) Object.defineProperty(window, 'matchMedia', original);
      else delete (window as { matchMedia?: unknown }).matchMedia;
    },
  };
}
