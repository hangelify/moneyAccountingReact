import '@/i18n';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { PossibleDuplicate } from '@/types/bills';
import { DuplicateOfBadge } from './DuplicateOfBadge';

const original: PossibleDuplicate = {
  id: 'b0',
  bill_date: '2026-10-03',
  total_amount: 412.5,
  currency: 'MDL',
  market_name: 'Linella',
  created_by_name: 'Ana',
};

describe('DuplicateOfBadge', () => {
  it('links to the original and unmarks', async () => {
    const onUnmark = vi.fn();
    render(
      <MemoryRouter initialEntries={['/bills/confirmed/b1?page=2']}>
        <Routes>
          <Route
            path="/bills/confirmed/:id"
            element={
              <DuplicateOfBadge original={original} onUnmark={onUnmark} />
            }
          />
        </Routes>
      </MemoryRouter>
    );
    const link = screen.getByRole('link', {
      name: "Duplicate of Ana's bill on Oct 3",
    });
    expect(link).toHaveAttribute('href', '/bills/confirmed/b0?page=2');
    await userEvent.click(screen.getByRole('button', { name: 'Unmark' }));
    expect(onUnmark).toHaveBeenCalled();
  });
});
