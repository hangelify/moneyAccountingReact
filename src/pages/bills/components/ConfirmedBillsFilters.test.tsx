import '@/i18n';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '@/auth/apiClient';
import { ConfirmedBillsFilters } from './ConfirmedBillsFilters';
import type { ConfirmedBillsFilters as Filters } from '@/pages/bills/buildBillsQueryParams';
import type { ReactElement, ReactNode } from 'react';

const empty: Filters = {
  date_from: null,
  date_to: null,
  market_names: [],
  amount_min: null,
  amount_max: null,
  currency: null,
};

function wrap(ui: ReactNode): ReactElement {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
}

describe('ConfirmedBillsFilters', () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    mock.onGet('/markets').reply(200, []);
  });
  afterEach(() => {
    mock.restore();
  });

  it('emits merged filter when a child changes', async () => {
    const onChange = vi.fn();
    render(
      wrap(
        <ConfirmedBillsFilters
          value={empty}
          onChange={onChange}
          onClear={vi.fn()}
        />
      )
    );
    await userEvent.selectOptions(screen.getByLabelText(/currency/i), 'EUR');
    expect(onChange).toHaveBeenCalledWith({ ...empty, currency: 'EUR' });
  });

  it('calls onClear when clear button is clicked', async () => {
    const onClear = vi.fn();
    render(
      wrap(
        <ConfirmedBillsFilters
          value={empty}
          onChange={vi.fn()}
          onClear={onClear}
        />
      )
    );
    await userEvent.click(screen.getByRole('button', { name: /clear/i }));
    expect(onClear).toHaveBeenCalled();
  });
});
