import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HouseholdAmount, householdAmountText } from './HouseholdAmount';
import '@/i18n';

const foreign = {
  currency: 'EUR',
  household_currency: 'MDL',
  household_amount: 1009.95,
} as const;

describe('HouseholdAmount', () => {
  it('shows the converted amount for a foreign bill', () => {
    render(<HouseholdAmount bill={foreign} />);
    expect(screen.getByText('≈ 1,009.95 MDL')).toBeInTheDocument();
  });

  it('renders nothing for a bill in the household currency', () => {
    const { container } = render(
      <HouseholdAmount
        bill={{ ...foreign, household_currency: 'EUR', household_amount: 50 }}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the bill was not converted', () => {
    const { container } = render(
      <HouseholdAmount bill={{ ...foreign, household_amount: null }} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing without a household currency (drafts)', () => {
    const { container } = render(
      <HouseholdAmount bill={{ currency: 'EUR', household_amount: 5 }} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for a bill without a currency', () => {
    expect(
      householdAmountText(
        { currency: null, household_currency: 'EUR', household_amount: 5 },
        'en'
      )
    ).toBeNull();
  });
});
