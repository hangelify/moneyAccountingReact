import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement, ReactNode } from 'react';
import { apiClient } from '@/auth/apiClient';
import { CategoryPicker } from './CategoryPicker';
import type { CategoryValue } from './CategoryPicker';
import { HouseholdTestProvider } from '@/test/household';

function Wrapper({ children }: { children: ReactNode }): ReactElement {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={client}>
      <HouseholdTestProvider>{children}</HouseholdTestProvider>
    </QueryClientProvider>
  );
}

const CATEGORIES = '/households/hh-1/categories';
const SUB_CATEGORIES = '/households/hh-1/sub-categories';

const dairy = { id: 'c1', name: 'Dairy' };
const cheese = { id: 's1', name: 'Cheese', category_name: 'Dairy' };
const EMPTY: CategoryValue = { category: null, sub_category: null };

function mockLists(mock: MockAdapter): void {
  mock.onGet(CATEGORIES).reply(200, [
    { id: 'c1', name: 'Dairy', created_at: '', updated_at: '' },
    { id: 'c2', name: 'Snacks', created_at: '', updated_at: '' },
  ]);
  mock.onGet(SUB_CATEGORIES).reply(200, [
    {
      id: 's1',
      name: 'Cheese',
      category_id: 'c1',
      category_name: 'Dairy',
      created_at: '',
      updated_at: '',
    },
  ]);
}

function renderPicker(
  value: CategoryValue,
  onChange: (next: CategoryValue) => void = vi.fn()
): void {
  render(
    <CategoryPicker value={value} onChange={onChange} aria-label="Category" />,
    { wrapper: Wrapper }
  );
}

async function openPicker(): Promise<void> {
  const trigger = screen.getByRole('combobox', { name: 'Category' });
  await waitFor(() => expect(trigger).not.toBeDisabled());
  await userEvent.click(trigger);
}

describe('CategoryPicker', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(apiClient);
  });
  afterEach(() => {
    mock.restore();
  });

  it("shows the line's category on the trigger", () => {
    mockLists(mock);
    renderPicker({ category: dairy, sub_category: cheese });
    expect(
      screen.getByRole('combobox', { name: 'Category' })
    ).toHaveTextContent('Dairy › Cheese');
  });

  it('shows a whole category on the trigger', () => {
    mockLists(mock);
    renderPicker({ category: dairy, sub_category: null });
    expect(
      screen.getByRole('combobox', { name: 'Category' })
    ).toHaveTextContent('Dairy');
  });

  it('shows the placeholder when empty', async () => {
    mockLists(mock);
    renderPicker(EMPTY);
    const trigger = screen.getByRole('combobox', { name: 'Category' });
    expect(trigger).toHaveTextContent('Loading categories…');
    await waitFor(() => expect(trigger).toHaveTextContent('—'));
  });

  it('lists a category without sub-categories', async () => {
    mockLists(mock);
    renderPicker(EMPTY);
    await openPicker();
    expect(
      await screen.findByRole('option', { name: 'Snacks' })
    ).toBeInTheDocument();
  });

  it('picks a sub-category with the keyboard', async () => {
    mockLists(mock);
    const onChange = vi.fn();
    renderPicker(EMPTY, onChange);
    await openPicker();

    await userEvent.keyboard('chee');
    await waitFor(() =>
      expect(screen.queryByRole('option', { name: 'Snacks' })).toBeNull()
    );
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('option', { name: 'Cheese' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await userEvent.keyboard('{Enter}');

    expect(onChange).toHaveBeenCalledWith({
      category: dairy,
      sub_category: cheese,
    });
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
  });

  it('picks a whole category', async () => {
    mockLists(mock);
    const onChange = vi.fn();
    renderPicker(EMPTY, onChange);
    await openPicker();

    await userEvent.click(await screen.findByRole('option', { name: 'Dairy' }));

    expect(onChange).toHaveBeenCalledWith({
      category: dairy,
      sub_category: null,
    });
  });

  it('clears with the none row', async () => {
    mockLists(mock);
    const onChange = vi.fn();
    renderPicker({ category: dairy, sub_category: null }, onChange);
    await openPicker();

    await userEvent.click(
      await screen.findByRole('option', { name: 'No category' })
    );

    expect(onChange).toHaveBeenCalledWith(EMPTY);
  });

  it('closes on Escape without change', async () => {
    mockLists(mock);
    const onChange = vi.fn();
    renderPicker(EMPTY, onChange);
    await openPicker();
    await screen.findByRole('listbox');

    await userEvent.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows a value missing from the list by name', async () => {
    mockLists(mock);
    renderPicker({ category: { id: 'gone', name: 'Old' }, sub_category: null });
    expect(
      screen.getByRole('combobox', { name: 'Category' })
    ).toHaveTextContent('Old');
    await openPicker();
    await screen.findByRole('option', { name: 'Dairy' });

    expect(
      screen
        .getAllByRole('option')
        .filter((option) => option.dataset.current === 'true')
    ).toEqual([]);
  });

  it('checks the sub-category of an old line without category', async () => {
    mockLists(mock);
    renderPicker({ category: null, sub_category: cheese });
    expect(
      screen.getByRole('combobox', { name: 'Category' })
    ).toHaveTextContent('Dairy › Cheese');
    await openPicker();

    expect(
      await screen.findByRole('option', { name: 'Cheese' })
    ).toHaveAttribute('data-current', 'true');
    expect(screen.getByRole('option', { name: 'Dairy' })).not.toHaveAttribute(
      'data-current'
    );
  });

  it('shows Retry on error', async () => {
    mock.onGet(CATEGORIES).reply(500);
    mock.onGet(SUB_CATEGORIES).reply(200, []);
    renderPicker(EMPTY);
    await openPicker();

    expect(
      await screen.findByText("Couldn't load categories")
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() =>
      expect(mock.history.get.filter((r) => r.url === CATEGORIES)).toHaveLength(
        2
      )
    );
  });

  it('is disabled while loading', () => {
    mock.onGet(CATEGORIES).reply(() => new Promise<[number]>(() => undefined));
    mock
      .onGet(SUB_CATEGORIES)
      .reply(() => new Promise<[number]>(() => undefined));
    renderPicker(EMPTY);
    expect(screen.getByRole('combobox', { name: 'Category' })).toBeDisabled();
  });
});
