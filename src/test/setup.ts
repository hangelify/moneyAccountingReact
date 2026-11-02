import '@testing-library/jest-dom';
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@/i18n';

// Radix Toast starts a 5 s close timer and never clears it on unmount. A toast
// shown near the end of a file then fires after jsdom is torn down
// ("document is not defined"). Track the timers a test starts and clear the
// ones still pending once it ends.
const pendingTimers = new Set<ReturnType<typeof setTimeout>>();
const realSetTimeout = globalThis.setTimeout;
const realClearTimeout = globalThis.clearTimeout;
globalThis.setTimeout = ((
  handler: (...args: unknown[]) => void,
  ms?: number,
  ...args: unknown[]
) => {
  const id = realSetTimeout(() => {
    pendingTimers.delete(id);
    handler(...args);
  }, ms);
  pendingTimers.add(id);
  return id;
}) as typeof setTimeout;
globalThis.clearTimeout = ((id?: ReturnType<typeof setTimeout>) => {
  if (id !== undefined) pendingTimers.delete(id);
  realClearTimeout(id);
}) as typeof clearTimeout;

// Cleanup after each test
afterEach(() => {
  cleanup();
  pendingTimers.forEach((id) => realClearTimeout(id));
  pendingTimers.clear();
});

// Extend Vitest's expect with jest-dom matchers
expect.extend({
  // Add custom matchers if needed
});
