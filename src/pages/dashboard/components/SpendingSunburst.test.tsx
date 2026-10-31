import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockMatchMedia } from '@/test/matchMedia';
import { MDL } from '@/test/spending';
import { SpendingSunburst } from './SpendingSunburst';

function renderChart(
  props: Partial<Parameters<typeof SpendingSunburst>[0]> = {}
): { onZoom: ReturnType<typeof vi.fn>; onHighlight: ReturnType<typeof vi.fn> } {
  const onZoom = vi.fn();
  const onHighlight = vi.fn();
  render(
    <SpendingSunburst
      data={MDL}
      centreLabel="October 2026"
      zoomedKey={null}
      onZoom={onZoom}
      highlightedKey={null}
      onHighlight={onHighlight}
      {...props}
    />
  );
  return { onZoom, onHighlight };
}

describe('SpendingSunburst', () => {
  let mm: ReturnType<typeof mockMatchMedia> | null = null;
  afterEach(() => {
    mm?.restore();
    mm = null;
  });

  it('renders one button per arc with aria-labels', () => {
    renderChart();
    expect(
      screen.getByRole('button', { name: /^Food, MDL\s?910\.40, 72\.81%$/ })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Bread,/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Dairy,/ })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^Uncategorized, MDL\s?340\.00/ })
    ).toBeInTheDocument();
  });

  it('shows the total and the period label in the centre', () => {
    renderChart();
    expect(screen.getByText(/MDL\s?1,250\.40/)).toBeInTheDocument();
    expect(screen.getByText('October 2026')).toBeInTheDocument();
  });

  it('clicking a category calls onZoom with its key', async () => {
    const { onZoom } = renderChart();
    await userEvent.click(screen.getByRole('button', { name: /^Food,/ }));
    expect(onZoom).toHaveBeenCalledWith('food');
  });

  it('clicking Uncategorized does not zoom', async () => {
    const { onZoom } = renderChart();
    await userEvent.click(
      screen.getByRole('button', { name: /^Uncategorized,/ })
    );
    expect(onZoom).not.toHaveBeenCalled();
  });

  it('Enter on a focused category zooms', async () => {
    const { onZoom } = renderChart();
    screen.getByRole('button', { name: /^Food,/ }).focus();
    await userEvent.keyboard('{Enter}');
    expect(onZoom).toHaveBeenCalledWith('food');
  });

  it('clicking a sub-category highlights it', async () => {
    const { onZoom, onHighlight } = renderChart();
    await userEvent.click(screen.getByRole('button', { name: /^Dairy,/ }));
    expect(onHighlight).toHaveBeenCalledWith('dairy');
    expect(onZoom).not.toHaveBeenCalled();
  });

  it('when zoomed shows the category name and Back in the centre', async () => {
    const { onZoom } = renderChart({ zoomedKey: 'food' });
    expect(screen.getByText('Food')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onZoom).toHaveBeenCalledWith(null);
  });

  it('Escape zooms out', async () => {
    const { onZoom } = renderChart({ zoomedKey: 'food' });
    screen.getByRole('button', { name: /^Bread,/ }).focus();
    await userEvent.keyboard('{Escape}');
    expect(onZoom).toHaveBeenCalledWith(null);
  });

  it('shows a tooltip on hover when the device can hover', async () => {
    mm = mockMatchMedia(true);
    renderChart();
    await userEvent.hover(screen.getByRole('button', { name: /^Food,/ }));
    expect(screen.getByRole('tooltip')).toHaveTextContent('72.81%');
  });

  it('shows no tooltip on touch devices', async () => {
    mm = mockMatchMedia(false);
    renderChart();
    await userEvent.hover(screen.getByRole('button', { name: /^Food,/ }));
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('marks archived items in the tooltip', async () => {
    mm = mockMatchMedia(true);
    renderChart({
      data: {
        ...MDL,
        categories: [{ ...MDL.categories[0]!, archived: true }],
      },
    });
    await userEvent.hover(screen.getByRole('button', { name: /^Food,/ }));
    expect(screen.getByRole('tooltip')).toHaveTextContent('archived');
  });

  it('resets zoom when the zoomed category disappears', () => {
    const { onZoom } = renderChart({ zoomedKey: 'gone' });
    expect(onZoom).toHaveBeenCalledWith(null);
  });
});
