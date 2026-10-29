import '@/i18n';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import MockAdapter from 'axios-mock-adapter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { apiClient } from '@/auth/apiClient';
import { TooltipProvider } from '@/components/ui/tooltip';
import { BillItemRow } from './BillItemRow';
import type { BillEditItem } from '@/types/bills';

function makeItem(overrides: Partial<BillEditItem> = {}): BillEditItem {
  return {
    name: 'Bread',
    quantity: 1,
    unit: 'piece',
    weight_kg: null,
    price_per_kg: null,
    final_price: 1.2,
    sub_category: null,
    category_confidence: 0.9,
    ...overrides,
  };
}

function renderRow(
  item: BillEditItem,
  onChange = vi.fn()
): ReturnType<typeof render> {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <table>
          <tbody>
            <BillItemRow item={item} index={0} onChange={onChange} />
          </tbody>
        </table>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

// Stateful host so userEvent.type can drive a controlled input the way
// the real page does (React applies each patch and re-renders).
function StatefulRow({
  initial,
  onPatch,
}: {
  initial: BillEditItem;
  onPatch: (patch: Partial<BillEditItem>) => void;
}): React.ReactElement {
  const [item, setItem] = useState(initial);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <table>
          <tbody>
            <BillItemRow
              item={item}
              index={0}
              onChange={(patch) => {
                setItem((prev) => ({ ...prev, ...patch }));
                onPatch(patch);
              }}
            />
          </tbody>
        </table>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

describe('BillItemRow (refactor parity)', () => {
  it('renders name, quantity, unit, and final price inputs', () => {
    renderRow(makeItem({ name: 'Bread', final_price: 1.2 }));
    expect(screen.getByDisplayValue('Bread')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1.2')).toBeInTheDocument();
  });

  it('emits patches when the name field changes', async () => {
    const onPatch = vi.fn();
    render(
      <StatefulRow initial={makeItem({ name: 'Bread' })} onPatch={onPatch} />
    );
    const input = screen.getByDisplayValue('Bread');
    await userEvent.clear(input);
    await userEvent.type(input, 'Sourdough');
    expect(onPatch).toHaveBeenLastCalledWith({ name: 'Sourdough' });
  });

  it('disables weight + price/kg inputs when unit is not kg', () => {
    renderRow(makeItem({ unit: 'piece', weight_kg: null, price_per_kg: null }));
    expect(screen.getByLabelText(/weight \(kg\)/i)).toBeDisabled();
    expect(screen.getByLabelText(/price \/ kg/i)).toBeDisabled();
  });

  it('enables weight + price/kg inputs when unit is kg', () => {
    renderRow(makeItem({ unit: 'kg', weight_kg: 0.5, price_per_kg: 10 }));
    expect(screen.getByLabelText(/weight \(kg\)/i)).not.toBeDisabled();
    expect(screen.getByDisplayValue('0.5')).toBeInTheDocument();
  });
});

describe('BillItemRow — sub-category', () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
  });
  afterEach(() => {
    mock.restore();
  });

  it('emits sub_category, confidence=1 and clears reasoning when picked', async () => {
    mock.onGet('/sub-categories').reply(200, [
      {
        id: '1',
        name: 'milk',
        category_id: 'c1',
        category_name: 'Dairy',
        created_at: '',
        updated_at: '',
      },
    ]);
    const onChange = vi.fn();
    renderRow(
      makeItem({ category_confidence: 0.3, category_reasoning: 'guess' }),
      onChange
    );
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'milk' })).toBeInTheDocument();
    });
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: /category/i }),
      '1'
    );

    expect(onChange).toHaveBeenLastCalledWith({
      sub_category: { id: '1', name: 'milk', category_name: 'Dairy' },
      category_confidence: 1,
      category_reasoning: undefined,
    });
  });

  it('calls onDelete when the trash button is clicked', async () => {
    const onDelete = vi.fn();
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <TooltipProvider>
          <table>
            <tbody>
              <BillItemRow
                item={makeItem()}
                index={0}
                onChange={vi.fn()}
                onDelete={onDelete}
              />
            </tbody>
          </table>
        </TooltipProvider>
      </QueryClientProvider>
    );
    await userEvent.click(screen.getByRole('button', { name: /delete item/i }));
    expect(onDelete).toHaveBeenCalled();
  });
});
