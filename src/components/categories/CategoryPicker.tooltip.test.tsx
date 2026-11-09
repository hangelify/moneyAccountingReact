import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement, ReactNode } from 'react';
import { apiClient } from '@/auth/apiClient';
import { TooltipProvider } from '@/components/ui/tooltip';
import { isControlOverflowing } from '@/lib/textOverflow';
import { HouseholdTestProvider } from '@/test/household';
import { CategoryPicker } from './CategoryPicker';

vi.mock('@/lib/textOverflow', () => ({
  isControlOverflowing: vi.fn(),
}));

const overflowing = vi.mocked(isControlOverflowing);

function Wrapper({ children }: { children: ReactNode }): ReactElement {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={client}>
      <HouseholdTestProvider>
        <TooltipProvider delayDuration={0}>{children}</TooltipProvider>
      </HouseholdTestProvider>
    </QueryClientProvider>
  );
}

describe('CategoryPicker overflow tooltip', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    overflowing.mockReset();
    overflowing.mockReturnValue(true);
    mock = new MockAdapter(apiClient);
    mock
      .onGet('/households/hh-1/categories')
      .reply(200, [
        { id: 'c1', name: 'Dairy', created_at: '', updated_at: '' },
      ]);
    mock.onGet('/households/hh-1/sub-categories').reply(200, []);
  });
  afterEach(() => {
    mock.restore();
  });

  function renderPicker(): HTMLElement {
    render(
      <CategoryPicker
        overflowTooltip
        aria-label="Category"
        value={{
          category: { id: 'c1', name: 'Dairy' },
          sub_category: { id: 's1', name: 'Cheese', category_name: 'Dairy' },
        }}
        onChange={vi.fn()}
      />,
      { wrapper: Wrapper }
    );
    return screen.getByRole('combobox', { name: 'Category' });
  }

  it('shows the full category on hover when the trigger is cut off', async () => {
    const trigger = renderPicker();
    await waitFor(() => expect(trigger).toBeEnabled());

    await userEvent.hover(trigger);

    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Dairy › Cheese'
    );
    expect(overflowing).toHaveBeenCalledWith(trigger);
  });

  it('stays hidden while typing in the open list', async () => {
    const trigger = renderPicker();
    await waitFor(() => expect(trigger).toBeEnabled());
    await userEvent.click(trigger);
    await screen.findByRole('listbox');

    await userEvent.keyboard('dai');

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
