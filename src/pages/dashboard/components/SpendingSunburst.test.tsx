import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockMatchMedia } from '@/test/matchMedia';
import { MDL, MDL_NO_SUB } from '@/test/spending';
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

  it('when zoomed shows the category name and total in the centre', () => {
    renderChart({ zoomedKey: 'food' });
    expect(screen.getByText('Food')).toBeInTheDocument();
    expect(screen.getByText(/MDL\s?910\.40/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /back/i })).toBeNull();
  });

  it('clicking the centre zooms out', async () => {
    const { onZoom } = renderChart({ zoomedKey: 'food' });
    await userEvent.click(screen.getByTestId('sunburst-centre'));
    expect(onZoom).toHaveBeenCalledWith(null);
  });

  it('clicking the centre does nothing at the top level', async () => {
    const { onZoom } = renderChart();
    await userEvent.click(screen.getByTestId('sunburst-centre'));
    expect(onZoom).not.toHaveBeenCalled();
  });

  it('returns focus to the category segment after zooming out', () => {
    mm = mockMatchMedia(true);
    const { rerender } = render(
      <SpendingSunburst
        data={MDL}
        centreLabel="October 2026"
        zoomedKey="food"
        onZoom={vi.fn()}
        highlightedKey={null}
        onHighlight={vi.fn()}
      />
    );
    rerender(
      <SpendingSunburst
        data={MDL}
        centreLabel="October 2026"
        zoomedKey={null}
        onZoom={vi.fn()}
        highlightedKey={null}
        onHighlight={vi.fn()}
      />
    );
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: /^Food,/ })
    );
    // Restoring focus is not a hover; no tooltip pops up.
    expect(screen.queryByRole('tooltip')).toBeNull();
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

  describe('no sub-category slice', () => {
    const noSubArcs = (): HTMLElement[] =>
      screen.getAllByRole('button', { name: /^No sub-category,/ });

    it('labels it translated, once per category', () => {
      renderChart({ data: MDL_NO_SUB });
      expect(noSubArcs()).toHaveLength(2);
      expect(noSubArcs()[0]).toHaveAccessibleName(
        /^No sub-category, MDL\s?50\.00, 5\.21%$/
      );
      expect(
        screen.queryByRole('button', { name: /raw no-sub name/ })
      ).toBeNull();
    });

    it('fills it with the hatch pattern of its category colour', () => {
      const { container } = render(
        <SpendingSunburst
          data={MDL_NO_SUB}
          centreLabel="October 2026"
          zoomedKey={null}
          onZoom={vi.fn()}
          highlightedKey={null}
          onHighlight={vi.fn()}
        />
      );
      const tea = screen.getAllByRole('button', {
        name: /^No sub-category,/,
      })[1]!;
      const ref = /^url\(#(.+)\)$/.exec(tea.style.fill)?.[1];
      expect(ref).toBeDefined();
      const pattern = container.querySelector(`pattern[id="${ref}"]`);
      expect(pattern).not.toBeNull();
      // Tea is the second category: palette colour 2.
      expect(pattern!.innerHTML).toContain('--chart-2');
    });

    it('clicking it highlights it by its category key and does not zoom', async () => {
      const { onZoom, onHighlight } = renderChart({ data: MDL_NO_SUB });
      await userEvent.click(noSubArcs()[1]!);
      expect(onHighlight).toHaveBeenCalledWith('tea:none');
      expect(onZoom).not.toHaveBeenCalled();
    });

    it('shows the translated name in the tooltip', async () => {
      mm = mockMatchMedia(true);
      renderChart({ data: MDL_NO_SUB });
      await userEvent.hover(noSubArcs()[0]!);
      expect(screen.getByRole('tooltip')).toHaveTextContent('No sub-category');
    });
  });
});
