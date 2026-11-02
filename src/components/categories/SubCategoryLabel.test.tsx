import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SubCategoryLabel } from './SubCategoryLabel';

describe('SubCategoryLabel', () => {
  it('renders "Category › Sub" for a given subCategory', () => {
    render(
      <SubCategoryLabel
        subCategory={{ name: 'milk', category_name: 'Dairy' }}
      />
    );
    expect(screen.getByText(/Dairy.*milk/)).toBeInTheDocument();
  });

  it('renders an em dash when subCategory is null', () => {
    render(<SubCategoryLabel subCategory={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
