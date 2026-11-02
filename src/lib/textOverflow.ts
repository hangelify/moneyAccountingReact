let canvas: HTMLCanvasElement | null = null;

// A native <select> draws its arrow inside the box, outside the padding.
const SELECT_ARROW_PX = 24;

/**
 * True when the text shown by an input (its value) or a select (its chosen
 * option) is wider than the box it sits in. `el` may be the control itself
 * or a wrapper around it. Inputs and selects don't report their text
 * overflow through scrollWidth everywhere, so the text is measured instead.
 */
export function isControlOverflowing(el: Element | null): boolean {
  const control = el?.matches('input, select')
    ? el
    : el?.querySelector('input, select');
  if (
    !(
      control instanceof HTMLInputElement ||
      control instanceof HTMLSelectElement
    )
  ) {
    return false;
  }
  const text =
    control instanceof HTMLSelectElement
      ? (control.selectedOptions[0]?.text ?? '')
      : control.value;
  // No width means the control isn't laid out (hidden, or no layout engine).
  if (text === '' || control.clientWidth === 0) return false;

  canvas ??= document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  const style = getComputedStyle(control);
  ctx.font =
    style.font || `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const padding =
    parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
  const arrow = control instanceof HTMLSelectElement ? SELECT_ARROW_PX : 0;
  return ctx.measureText(text).width > control.clientWidth - padding - arrow;
}
