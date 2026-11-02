import '@/i18n';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog', () => {
  it('renders title and description when open', () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Delete user?"
        description="This action cannot be undone."
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByText('Delete user?')).toBeInTheDocument();
    expect(
      screen.getByText('This action cannot be undone.')
    ).toBeInTheDocument();
  });

  it('calls onConfirm when the confirm button is clicked', async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Proceed?"
        onConfirm={onConfirm}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onOpenChange(false) when cancel is clicked', async () => {
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Proceed?"
        onConfirm={vi.fn()}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('uses custom labels when provided', () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Discard?"
        confirmLabel="Discard"
        cancelLabel="Keep"
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: 'Discard' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep' })).toBeInTheDocument();
  });

  it('disables buttons while an async onConfirm is pending', async () => {
    let resolve: () => void = vi.fn();
    const pending = new Promise<void>((r) => {
      resolve = r;
    });
    const onConfirm = vi.fn(() => pending);
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Proceed?"
        onConfirm={onConfirm}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(screen.getByRole('button', { name: /confirm/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();

    resolve();
  });
});
