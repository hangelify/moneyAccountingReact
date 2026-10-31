import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MDL } from '@/test/spending';
import { SpendingLegend } from './SpendingLegend';

describe('SpendingLegend', () => {
  it('lists categories with a translated Uncategorized row', () => {
    render(
      <SpendingLegend
        data={MDL}
        zoomedKey={null}
        highlightedKey={null}
        onZoom={vi.fn()}
      />
    );
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Food');
    expect(rows[0]).toHaveTextContent('72.81%');
    expect(rows[1]).toHaveTextContent('Uncategorized');
  });

  it('clicking a category row zooms into it', async () => {
    const onZoom = vi.fn();
    render(
      <SpendingLegend
        data={MDL}
        zoomedKey={null}
        highlightedKey={null}
        onZoom={onZoom}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /Food/ }));
    expect(onZoom).toHaveBeenCalledWith('food');
  });

  it('lists the zoomed category sub-categories', () => {
    render(
      <SpendingLegend
        data={MDL}
        zoomedKey="food"
        highlightedKey="dairy"
        onZoom={vi.fn()}
      />
    );
    const rows = screen.getAllByRole('listitem');
    expect(
      rows.map((r) => within(r).getByText(/Bread|Dairy/).textContent)
    ).toEqual(['Bread', 'Dairy']);
    expect(rows[1]).toHaveAttribute('data-highlighted', 'true');
  });

  it('marks archived rows', () => {
    const data = {
      ...MDL,
      categories: [{ ...MDL.categories[0]!, archived: true }],
    };
    render(
      <SpendingLegend
        data={data}
        zoomedKey={null}
        highlightedKey={null}
        onZoom={vi.fn()}
      />
    );
    expect(screen.getByText('archived')).toBeInTheDocument();
  });
});
