import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { formatAmount } from '../format';
import { UnconvertedNote } from './UnconvertedNote';
import '@/i18n';

describe('UnconvertedNote', () => {
  it('lists bills without a currency', () => {
    render(
      <UnconvertedNote
        buckets={[{ currency: null, bill_count: 1, amount: 31 }]}
      />
    );
    expect(
      screen.getByText('+ 31.00 without currency (1 bill)')
    ).toBeInTheDocument();
  });

  it('lists bills in a currency that was not converted', () => {
    render(
      <UnconvertedNote
        buckets={[{ currency: 'GBP', bill_count: 2, amount: 120 }]}
      />
    );
    expect(
      screen.getByText(
        `+ ${formatAmount(120, 'GBP', 'en')} not converted (2 bills)`
      )
    ).toBeInTheDocument();
  });

  it('renders nothing when every bill was converted', () => {
    const { container } = render(<UnconvertedNote buckets={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
