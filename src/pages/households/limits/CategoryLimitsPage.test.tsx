import '@/i18n';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useHouseholdCategories } from '@/hooks/useCategoryTree';
import { useCategoryLimitsQuery } from '@/hooks/useCategoryLimits';
import { HouseholdTestProvider, makeHouseholdValue } from '@/test/household';
import { CategoryLimitsPage } from './CategoryLimitsPage';
import { makeCategory, makeLimit } from './testLimits';

const saveMutate = vi.fn();

vi.mock('@/hooks/useCategoryTree', () => ({
  useHouseholdCategories: vi.fn(),
}));
vi.mock('@/hooks/useCategoryLimits', () => ({
  useCategoryLimitsQuery: vi.fn(),
  useSaveCategoryLimit: () => ({ mutateAsync: saveMutate, isPending: false }),
  useRemoveCategoryLimit: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRefreshCategoryLimits: () => vi.fn(),
}));

const refetchCategories = vi.fn();
const refetchLimits = vi.fn();

function query(data: unknown, extra: Record<string, unknown> = {}): unknown {
  return { data, isPending: false, isError: false, ...extra };
}

function mockQueries(categories: unknown, limits: unknown): void {
  vi.mocked(useHouseholdCategories).mockReturnValue(
    categories as ReturnType<typeof useHouseholdCategories>
  );
  vi.mocked(useCategoryLimitsQuery).mockReturnValue(
    limits as ReturnType<typeof useCategoryLimitsQuery>
  );
}

function renderPage(
  path = '/households/hh-2/limits',
  overrides: Parameters<typeof makeHouseholdValue>[0] = {}
): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <HouseholdTestProvider value={makeHouseholdValue(overrides)}>
        <Routes>
          <Route
            path="/households/:id/limits"
            element={<CategoryLimitsPage />}
          />
        </Routes>
      </HouseholdTestProvider>
    </MemoryRouter>
  );
}

describe('CategoryLimitsPage', () => {
  beforeEach(() => {
    refetchCategories.mockReset();
    refetchLimits.mockReset();
    mockQueries(
      query([makeCategory('c3', 'Transport'), makeCategory('c1', 'Food')], {
        refetch: refetchCategories,
      }),
      query([makeLimit({ currency: 'MDL' })], { refetch: refetchLimits })
    );
  });

  it('shows the budget, its currency and the rows in order', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { name: 'Family Budget · Limits' })
    ).toBeInTheDocument();
    expect(screen.getByText('Budget currency: MDL')).toBeInTheDocument();
    const names = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(names[0]).toMatch(/^Food/);
    expect(names[1]).toMatch(/^Transport/);
    expect(useHouseholdCategories).toHaveBeenCalledWith('hh-2');
    expect(useCategoryLimitsQuery).toHaveBeenCalledWith('hh-2');
  });

  it('links back to the budgets list', () => {
    renderPage();
    expect(screen.getByRole('link', { name: /Budgets/ })).toHaveAttribute(
      'href',
      '/households'
    );
  });

  it('says so for an unknown budget', () => {
    renderPage('/households/nope/limits');
    expect(screen.getByText('Budget not found')).toBeInTheDocument();
  });

  it('waits for the budgets list before deciding it is unknown', () => {
    renderPage('/households/nope/limits', {
      status: 'loading',
      households: [],
    });
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByText('Budget not found')).not.toBeInTheDocument();
  });

  it('offers a retry when loading fails', async () => {
    mockQueries(
      query(undefined, { isError: true, refetch: refetchCategories }),
      query([], { refetch: refetchLimits })
    );
    renderPage();
    expect(screen.getByText("Couldn't load limits")).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetchCategories).toHaveBeenCalled();
    expect(refetchLimits).toHaveBeenCalled();
  });

  it('says when the budget has no categories', () => {
    mockQueries(query([]), query([]));
    renderPage();
    expect(
      screen.getByText('This budget has no categories')
    ).toBeInTheDocument();
  });

  it('offers a retry when the budgets list fails to load', async () => {
    const refetch = vi.fn().mockResolvedValue(undefined);
    renderPage('/households/hh-2/limits', {
      status: 'error',
      households: [],
      refetch,
    });
    expect(screen.getByText("Couldn't load limits")).toBeInTheDocument();
    expect(screen.queryByText('Budget not found')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetch).toHaveBeenCalled();
  });

  it('keeps a newly opened row open when an earlier save finishes', async () => {
    let finish: ((v: unknown) => void) | undefined;
    saveMutate.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    renderPage();
    await userEvent.click(
      screen.getByRole('button', { name: 'Edit limit for Food' })
    );
    await userEvent.clear(screen.getByLabelText('Amount'));
    await userEvent.type(screen.getByLabelText('Amount'), '450');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Set limit for Transport' })
    );
    finish?.(makeLimit());
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByLabelText('Amount')).toBeInTheDocument();
  });
});
