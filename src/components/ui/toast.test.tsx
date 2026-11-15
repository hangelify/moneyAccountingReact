import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Toast,
  ToastClose,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  type ToastProps,
} from './toast';

// a raw Tailwind palette class, with or without a variant prefix
const RAW =
  /(^|[\s:])(bg|text|border|ring|ring-offset)-(red|yellow|green|amber|gray|black|white)\b/;

function renderToast(variant: ToastProps['variant']): HTMLElement {
  render(
    <ToastProvider>
      <Toast open variant={variant}>
        <ToastTitle>Hi</ToastTitle>
        <ToastClose />
      </Toast>
      <ToastViewport />
    </ToastProvider>
  );
  const root = screen.getByText('Hi').closest('li');
  if (!root) throw new Error('toast root not found');
  return root;
}

describe('Toast', () => {
  it.each(['success', 'warning'] as const)(
    '%s toast is opaque and uses tokens',
    (variant) => {
      const root = renderToast(variant);
      expect(root).toHaveClass('bg-background', `text-${variant}`);
      expect(root.className).not.toMatch(RAW);
    }
  );

  it('destructive close button uses tokens', () => {
    const root = renderToast('destructive');
    const close = root.querySelector('[toast-close]');
    if (!close) throw new Error('close button not found');
    expect(close.className).not.toMatch(RAW);
    expect(close.className).toContain(
      'group-[.destructive]:text-destructive-foreground'
    );
  });
});
