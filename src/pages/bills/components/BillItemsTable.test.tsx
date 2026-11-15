import '@/i18n';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { HouseholdTestProvider } from '@/test/household';
import { BillItemsTable } from './BillItemsTable';

function renderTable(): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <HouseholdTestProvider>
        <TooltipProvider>
          <BillItemsTable
            items={[]}
            onUpdateItem={vi.fn()}
            onRemoveItem={vi.fn()}
            onAddItem={() => 0}
          />
        </TooltipProvider>
      </HouseholdTestProvider>
    </QueryClientProvider>
  );
}

describe('BillItemsTable', () => {
  // The container already draws the bottom edge; a header border on top of it
  // would read as a double line.
  it('draws no header border when there are no items', () => {
    renderTable();
    const thead = screen.getByRole('table').querySelector('thead');
    expect(thead).toHaveClass('border-b-0');
  });
});
