import '@/i18n';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { BillItemCard } from './BillItemCard';
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

function renderCard(item: BillEditItem): ReturnType<typeof render> {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <BillItemCard item={item} index={0} onChange={vi.fn()} />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

describe('BillItemCard (refactor parity)', () => {
  it('renders name and price inputs in a card layout', () => {
    renderCard(makeItem());
    expect(screen.getByDisplayValue('Bread')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1.2')).toBeInTheDocument();
  });

  it('shows weight + price/kg fields only when unit is kg', () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { rerender } = render(
      <QueryClientProvider client={client}>
        <TooltipProvider>
          <BillItemCard
            item={makeItem({ unit: 'piece' })}
            index={0}
            onChange={vi.fn()}
          />
        </TooltipProvider>
      </QueryClientProvider>
    );
    expect(screen.queryByLabelText(/weight \(kg\)/i)).toBeNull();

    rerender(
      <QueryClientProvider client={client}>
        <TooltipProvider>
          <BillItemCard
            item={makeItem({ unit: 'kg', weight_kg: 0.5, price_per_kg: 10 })}
            index={0}
            onChange={vi.fn()}
          />
        </TooltipProvider>
      </QueryClientProvider>
    );
    expect(screen.getByLabelText(/weight \(kg\)/i)).toBeInTheDocument();
  });
});
