import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TooltipProvider } from '@/components/ui/tooltip';
import { isControlOverflowing } from '@/lib/textOverflow';
import { OverflowTooltip } from './OverflowTooltip';

vi.mock('@/lib/textOverflow', () => ({
  isControlOverflowing: vi.fn(),
}));

const overflowing = vi.mocked(isControlOverflowing);

function renderTooltip(text: string): void {
  render(
    <TooltipProvider delayDuration={0}>
      <OverflowTooltip text={text}>
        <input aria-label="name" defaultValue={text} />
      </OverflowTooltip>
    </TooltipProvider>
  );
}

describe('OverflowTooltip', () => {
  beforeEach(() => {
    overflowing.mockReset();
  });

  it('shows the full text on hover when the control is cut off', async () => {
    overflowing.mockReturnValue(true);
    renderTooltip('Extra virgin olive oil 1l');

    await userEvent.hover(screen.getByRole('textbox', { name: 'name' }));

    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Extra virgin olive oil 1l'
    );
  });

  it('stays hidden when the text fits', async () => {
    overflowing.mockReturnValue(false);
    renderTooltip('Milk');

    await userEvent.hover(screen.getByRole('textbox', { name: 'name' }));

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('stays hidden when there is no text', async () => {
    overflowing.mockReturnValue(true);
    renderTooltip('');

    await userEvent.hover(screen.getByRole('textbox', { name: 'name' }));

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
