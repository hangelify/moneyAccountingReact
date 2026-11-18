import '@/i18n';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@/auth/apiError';
import { useSaveCategoryLimit } from '@/hooks/useCategoryLimits';
import type { CategoryLimit } from '@/types/categoryLimits';
import { LimitForm } from './LimitForm';
import { makeLimit } from './testLimits';

const mutateAsync = vi.fn();
const refresh = vi.fn();
let isPending = false;

vi.mock('@/hooks/useCategoryLimits', () => ({
  useSaveCategoryLimit: vi.fn(() => ({ mutateAsync, isPending })),
  useRefreshCategoryLimits: () => refresh,
}));

function renderForm(current: CategoryLimit | null = null): {
  onDone: ReturnType<typeof vi.fn>;
} {
  const onDone = vi.fn();
  render(
    <LimitForm
      hid="hh-1"
      categoryId="c1"
      categoryName="Food"
      current={current}
      currency="EUR"
      onDone={onDone}
    />
  );
  return { onDone };
}

const amount = (): HTMLElement => screen.getByLabelText('Amount');
const period = (): HTMLElement => screen.getByLabelText('Period');
const save = (): HTMLElement => screen.getByRole('button', { name: 'Save' });

describe('LimitForm', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-18T10:00:00Z'));
    mutateAsync.mockReset().mockResolvedValue(makeLimit());
    refresh.mockReset();
    isPending = false;
    vi.mocked(useSaveCategoryLimit).mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows from which period a new limit applies, following the period', async () => {
    renderForm();
    expect(
      screen.getByText(
        /Applies from November 2026\. Past periods don't change\./
      )
    ).toBeInTheDocument();
    await userEvent.selectOptions(period(), 'QUARTERLY');
    expect(screen.getByText(/Applies from Q4 2026/)).toBeInTheDocument();
  });

  it('warns which months lose the limit when a monthly limit becomes quarterly', async () => {
    renderForm(makeLimit());
    await userEvent.selectOptions(period(), 'QUARTERLY');
    expect(
      screen.getByText(
        /October 2026 and November 2026 will be left without a monthly limit/
      )
    ).toBeInTheDocument();
  });

  it('keeps Save disabled until an open limit changes', async () => {
    renderForm(makeLimit());
    expect(save()).toBeDisabled();
    await userEvent.clear(amount());
    await userEvent.type(amount(), '450');
    expect(save()).toBeEnabled();
  });

  it('POSTs a new limit', async () => {
    const { onDone } = renderForm();
    await userEvent.type(amount(), '400');
    await userEvent.click(save());
    expect(mutateAsync).toHaveBeenCalledWith({
      categoryId: 'c1',
      hasOpenLimit: false,
      body: { period_type: 'MONTHLY', amount: 400 },
    });
    expect(onDone).toHaveBeenCalledWith(true);
  });

  it('POSTs over an ending limit and PUTs over an open one', async () => {
    renderForm(makeLimit({ effective_to: '2026-12-01' }));
    await userEvent.click(save());
    expect(mutateAsync).toHaveBeenLastCalledWith(
      expect.objectContaining({ hasOpenLimit: false })
    );
  });

  it('PUTs a changed open limit', async () => {
    renderForm(makeLimit());
    await userEvent.clear(amount());
    await userEvent.type(amount(), '12,5');
    await userEvent.click(save());
    expect(mutateAsync).toHaveBeenCalledWith({
      categoryId: 'c1',
      hasOpenLimit: true,
      body: { period_type: 'MONTHLY', amount: 12.5 },
    });
  });

  it('disables Save while saving so a double click sends one request', () => {
    isPending = true;
    renderForm();
    expect(screen.getByRole('button', { name: /Saving/ })).toBeDisabled();
  });

  it('sends one request when Save is clicked twice quickly', async () => {
    mutateAsync.mockReturnValue(new Promise(() => undefined));
    renderForm();
    await userEvent.type(amount(), '400');
    await userEvent.dblClick(save());
    expect(mutateAsync).toHaveBeenCalledTimes(1);
  });

  it('keeps the form and refreshes the list on 409', async () => {
    mutateAsync.mockRejectedValue(new ApiError(409, {}));
    const { onDone } = renderForm();
    await userEvent.type(amount(), '400');
    await userEvent.click(save());
    expect(
      await screen.findByText(/already has a limit — the list was refreshed/)
    ).toBeInTheDocument();
    expect(refresh).toHaveBeenCalledWith(false);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('closes and refreshes categories too on 404', async () => {
    mutateAsync.mockRejectedValue(new ApiError(404, {}));
    const { onDone } = renderForm(makeLimit());
    await userEvent.clear(amount());
    await userEvent.type(amount(), '450');
    await userEvent.click(save());
    expect(refresh).toHaveBeenCalledWith(true);
    expect(onDone).toHaveBeenCalledWith(false);
  });

  it('shows the validation error under the amount', async () => {
    renderForm();
    await userEvent.type(amount(), '0');
    await userEvent.click(save());
    expect(
      await screen.findByText('Amount must be greater than 0')
    ).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('cancels on Escape', async () => {
    const { onDone } = renderForm();
    await userEvent.type(amount(), '{Escape}');
    expect(onDone).toHaveBeenCalledWith(false);
  });
});
