import '@/i18n';
import { useState, type ReactElement } from 'react';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LimitRow } from './LimitRow';
import type { LimitRowModel } from './limitRows';
import { makeLimit } from './testLimits';

const saveMutate = vi.fn();
const removeMutate = vi.fn();

vi.mock('@/hooks/useCategoryLimits', () => ({
  useSaveCategoryLimit: () => ({ mutateAsync: saveMutate, isPending: false }),
  useRemoveCategoryLimit: () => ({
    mutateAsync: removeMutate,
    isPending: false,
  }),
  useRefreshCategoryLimits: () => vi.fn(),
}));

const row = (overrides: Partial<LimitRowModel> = {}): LimitRowModel => ({
  categoryId: 'c1',
  name: 'Food',
  limit: makeLimit({ amount: 400 }),
  state: 'active',
  otherCurrency: false,
  ...overrides,
});

function renderRow(
  model: LimitRowModel,
  editing = false
): { onEdit: ReturnType<typeof vi.fn> } {
  const onEdit = vi.fn();
  render(
    <ul>
      <LimitRow
        hid="hh-1"
        row={model}
        currency="EUR"
        editing={editing}
        onEdit={onEdit}
        onDone={vi.fn()}
      />
    </ul>
  );
  return { onEdit };
}

describe('LimitRow', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-18T10:00:00Z'));
    saveMutate.mockReset();
    removeMutate
      .mockReset()
      .mockResolvedValue(makeLimit({ effective_to: '2026-12-01' }));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a category without a limit with only Set', () => {
    renderRow(row({ limit: null, state: 'none' }));
    expect(screen.getByText('No limit')).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(
      screen.getByRole('button', { name: 'Set limit for Food' })
    ).toBeInTheDocument();
  });

  it('shows an active limit with Edit and Remove', async () => {
    const { onEdit } = renderRow(row());
    expect(screen.getByText('€400.00 / month')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Edit limit for Food' })
    );
    expect(onEdit).toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: 'Remove limit for Food' })
    ).toBeInTheDocument();
  });

  it('shows until when an ending limit applies, with Set', () => {
    renderRow(
      row({
        limit: makeLimit({ amount: 400, effective_to: '2026-12-01' }),
        state: 'ending',
      })
    );
    expect(
      screen.getByText('€400.00 / month · until December 1, 2026')
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(
      screen.getByRole('button', { name: 'Set limit for Food' })
    ).toBeInTheDocument();
  });

  it('notes the budget currency for a limit kept in another one', () => {
    renderRow(
      row({
        limit: makeLimit({ amount: 400, currency: 'USD' }),
        otherCurrency: true,
      })
    );
    expect(screen.getByText('$400.00 / month')).toBeInTheDocument();
    expect(screen.getByText('Changing it will use EUR')).toBeInTheDocument();
  });

  it('shows an archived category without actions', () => {
    renderRow(row({ state: 'archived' }));
    expect(screen.getByText('Archived')).toBeInTheDocument();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('renders the inline form while editing', () => {
    renderRow(row(), true);
    expect(screen.getByLabelText('Amount')).toHaveValue('400');
  });

  it('confirms removal with the date the limit ends', async () => {
    renderRow(row());
    await userEvent.click(
      screen.getByRole('button', { name: 'Remove limit for Food' })
    );
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('December 1, 2026');
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(removeMutate).toHaveBeenCalledWith('c1');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

function TwoRows(): ReactElement {
  const [editing, setEditing] = useState<string | null>(null);
  const rows = [
    row({ categoryId: 'a', name: 'Food', limit: null, state: 'none' }),
    row({ categoryId: 'b', name: 'Rent', limit: null, state: 'none' }),
  ];
  return (
    <ul>
      {rows.map((r) => (
        <LimitRow
          key={r.categoryId}
          hid="hh-1"
          row={r}
          currency="EUR"
          editing={editing === r.categoryId}
          onEdit={() => {
            setEditing(r.categoryId);
          }}
          onDone={() => {
            setEditing(null);
          }}
        />
      ))}
    </ul>
  );
}

describe('LimitRow switching', () => {
  it('drops unsaved edits of a row when another row opens', async () => {
    render(<TwoRows />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Set limit for Food' })
    );
    await userEvent.type(screen.getByLabelText('Amount'), '123');
    await userEvent.click(
      screen.getByRole('button', { name: 'Set limit for Rent' })
    );
    expect(screen.getAllByLabelText('Amount')).toHaveLength(1);
    expect(screen.getByLabelText('Amount')).toHaveValue('');
    expect(saveMutate).not.toHaveBeenCalled();
  });

  it('returns focus to the row button when the form closes', async () => {
    render(<TwoRows />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Set limit for Food' })
    );
    await userEvent.keyboard('{Escape}');
    expect(
      screen.getByRole('button', { name: 'Set limit for Food' })
    ).toHaveFocus();
  });
});
