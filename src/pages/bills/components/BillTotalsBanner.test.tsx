import '@/i18n';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BillTotalsBanner } from './BillTotalsBanner';

describe('BillTotalsBanner', () => {
  it('renders nothing when difference is within tolerance', () => {
    const { container } = render(
      <BillTotalsBanner
        items={[{ final_price: 5 }, { final_price: 5 }]}
        totalAmount={10}
        currency="EUR"
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders mismatch text when items sum differs from header total', () => {
    render(
      <BillTotalsBanner
        items={[{ final_price: 5 }, { final_price: 7 }]}
        totalAmount={10}
        currency="EUR"
      />
    );
    expect(screen.getByText(/12.*EUR/)).toBeInTheDocument();
    expect(screen.getByText(/10.*EUR/)).toBeInTheDocument();
    expect(screen.getByText(/\+2/)).toBeInTheDocument();
  });

  it('renders nothing while the total is empty', () => {
    const { container } = render(
      <BillTotalsBanner
        items={[{ final_price: 5 }]}
        totalAmount={null}
        currency="EUR"
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('counts an empty line price as 0', () => {
    render(
      <BillTotalsBanner
        items={[{ final_price: 5 }, { final_price: null }]}
        totalAmount={10}
        currency="EUR"
      />
    );
    expect(screen.getByText(/-5/)).toBeInTheDocument();
  });
});
