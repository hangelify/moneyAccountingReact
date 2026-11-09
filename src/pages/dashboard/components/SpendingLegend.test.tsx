import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MDL, MDL_NO_SUB } from '@/test/spending';
import { SpendingLegend } from './SpendingLegend';

describe('SpendingLegend', () => {
  it('lists categories with a translated Uncategorized row', () => {
    render(
      <SpendingLegend data={MDL} zoomedKey={null} highlightedKey={null} />
    );
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Food');
    expect(rows[0]).toHaveTextContent('72.81%');
    expect(rows[1]).toHaveTextContent('Uncategorized');
  });

  it('clicking a category row expands its sub-categories in place', async () => {
    render(
      <SpendingLegend data={MDL} zoomedKey={null} highlightedKey={null} />
    );
    const food = screen.getByRole('button', { name: /Food/ });
    expect(food).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Bread')).toBeNull();

    await userEvent.click(food);
    expect(food).toHaveAttribute('aria-expanded', 'true');
    const subs = screen.getByRole('list', { name: 'Food' });
    expect(food).toHaveAttribute('aria-controls', subs.id);
    const subRows = within(subs).getAllByRole('listitem');
    expect(subRows).toHaveLength(2);
    expect(subRows[0]).toHaveTextContent('Bread');
    expect(subRows[0]).toHaveTextContent(/500\.40/);
    expect(subRows[0]).toHaveTextContent('54.97%');
    expect(subRows[0]).toHaveTextContent('25 lines');
    expect(subRows[1]).toHaveTextContent('Dairy');

    await userEvent.click(food);
    expect(food).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Bread')).toBeNull();
  });

  it('keeps several categories expanded at once', async () => {
    const data = {
      ...MDL,
      categories: [
        MDL.categories[0]!,
        {
          ...MDL.categories[0]!,
          id: 'home',
          name: 'Home',
          sub_categories: [
            {
              ...MDL.categories[0]!.sub_categories[0]!,
              id: 'rent',
              name: 'Rent',
            },
          ],
        },
      ],
    };
    render(
      <SpendingLegend data={data} zoomedKey={null} highlightedKey={null} />
    );
    await userEvent.click(screen.getByRole('button', { name: /Food/ }));
    await userEvent.click(screen.getByRole('button', { name: /Home/ }));
    expect(screen.getByText('Bread')).toBeInTheDocument();
    expect(screen.getByText('Rent')).toBeInTheDocument();
  });

  it('does not make rows without sub-categories expandable', () => {
    render(
      <SpendingLegend data={MDL} zoomedKey={null} highlightedKey={null} />
    );
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByText('Uncategorized').closest('button')).toBeNull();
  });

  it('highlights a sub-category row inside an expanded category', async () => {
    render(
      <SpendingLegend data={MDL} zoomedKey={null} highlightedKey="dairy" />
    );
    await userEvent.click(screen.getByRole('button', { name: /Food/ }));
    expect(screen.getByText('Dairy').closest('li')).toHaveAttribute(
      'data-highlighted',
      'true'
    );
  });

  it('lists the zoomed category sub-categories', () => {
    render(
      <SpendingLegend data={MDL} zoomedKey="food" highlightedKey="dairy" />
    );
    const rows = screen.getAllByRole('listitem');
    expect(
      rows.map((r) => within(r).getByText(/Bread|Dairy/).textContent)
    ).toEqual(['Bread', 'Dairy']);
    expect(rows[1]).toHaveAttribute('data-highlighted', 'true');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('marks archived rows', () => {
    const data = {
      ...MDL,
      categories: [{ ...MDL.categories[0]!, archived: true }],
    };
    render(
      <SpendingLegend data={data} zoomedKey={null} highlightedKey={null} />
    );
    expect(screen.getByText('archived')).toBeInTheDocument();
  });

  describe('no sub-category row', () => {
    it('lists it last in its category, translated, with a striped swatch', async () => {
      render(
        <SpendingLegend
          data={MDL_NO_SUB}
          zoomedKey={null}
          highlightedKey={null}
        />
      );
      await userEvent.click(screen.getByRole('button', { name: /Food/ }));
      const rows = within(
        screen.getByRole('list', { name: 'Food' })
      ).getAllByRole('listitem');
      expect(rows).toHaveLength(3);
      expect(rows[2]).toHaveTextContent('No sub-category');
      expect(rows[2]).toHaveTextContent('2 lines');
      expect(rows[2]).not.toHaveTextContent('raw no-sub name');
      const swatch = rows[2]!.querySelector<HTMLElement>('[aria-hidden]')!;
      expect(swatch.style.backgroundImage).toContain(
        'repeating-linear-gradient'
      );
    });

    it('expands a category that has nothing but it', async () => {
      render(
        <SpendingLegend
          data={MDL_NO_SUB}
          zoomedKey={null}
          highlightedKey={null}
        />
      );
      await userEvent.click(screen.getByRole('button', { name: /Tea/ }));
      expect(screen.getByRole('list', { name: 'Tea' })).toHaveTextContent(
        'No sub-category'
      );
    });

    it('highlights it by its category key while zoomed', () => {
      render(
        <SpendingLegend
          data={MDL_NO_SUB}
          zoomedKey="food"
          highlightedKey="food:none"
        />
      );
      const rows = screen.getAllByRole('listitem');
      expect(rows[2]).toHaveTextContent('No sub-category');
      expect(rows[2]).toHaveAttribute('data-highlighted', 'true');
      expect(rows[0]).not.toHaveAttribute('data-highlighted');
    });
  });
});
