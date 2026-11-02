import '@/i18n';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pagination } from './Pagination';

describe('Pagination', () => {
  it('renders nothing when total_pages <= 1', () => {
    const { container } = render(
      <Pagination
        meta={{ total: 3, page: 1, limit: 20, total_pages: 1 }}
        onPageChange={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('disables Prev on first page', () => {
    render(
      <Pagination
        meta={{ total: 100, page: 1, limit: 20, total_pages: 5 }}
        onPageChange={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
  });

  it('disables Next on last page', () => {
    render(
      <Pagination
        meta={{ total: 100, page: 5, limit: 20, total_pages: 5 }}
        onPageChange={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
  });

  it('emits page+1 / page-1 on Next/Prev click', async () => {
    const onPageChange = vi.fn();
    render(
      <Pagination
        meta={{ total: 100, page: 3, limit: 20, total_pages: 5 }}
        onPageChange={onPageChange}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(onPageChange).toHaveBeenCalledWith(4);
    await userEvent.click(screen.getByRole('button', { name: /previous/i }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});
