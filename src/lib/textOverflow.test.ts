import { describe, it, expect } from 'vitest';
import { isControlOverflowing } from './textOverflow';

function sized(
  el: HTMLElement,
  scrollWidth: number,
  clientWidth: number
): void {
  Object.defineProperty(el, 'scrollWidth', { value: scrollWidth });
  Object.defineProperty(el, 'clientWidth', { value: clientWidth });
}

function buttonWithText(scrollWidth: number, clientWidth: number): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.innerHTML =
    '<button type="button"><span>Household chemicals › Dishwasher tablets</span></button>';
  sized(wrapper.querySelector('span')!, scrollWidth, clientWidth);
  return wrapper;
}

describe('isControlOverflowing — button', () => {
  it('is true when the button text is cut off', () => {
    expect(isControlOverflowing(buttonWithText(320, 120))).toBe(true);
  });

  it('is false when the button text fits', () => {
    expect(isControlOverflowing(buttonWithText(120, 120))).toBe(false);
  });
});
