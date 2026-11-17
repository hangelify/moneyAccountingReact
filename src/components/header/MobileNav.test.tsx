import '@/i18n';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { HouseholdTestProvider } from '@/test/household';
import { MobileNav } from './MobileNav';

describe('MobileNav', () => {
  it('shows the active budget', async () => {
    render(
      <HouseholdTestProvider>
        <MemoryRouter>
          <MobileNav onOpenNewBill={vi.fn()} />
        </MemoryRouter>
      </HouseholdTestProvider>
    );
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(
      await screen.findByRole('link', { name: 'Budget: Personal' })
    ).toHaveAttribute('href', '/households');
  });
});
