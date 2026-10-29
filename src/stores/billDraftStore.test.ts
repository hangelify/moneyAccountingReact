import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useBillDraftStore } from './billDraftStore';
import type { ParsedBill } from '@/types/bills';

function makeFile(name = 'r.jpg'): File {
  return new File(['x'], name, { type: 'image/jpeg' });
}

function makeParsed(overrides: Partial<ParsedBill> = {}): ParsedBill {
  return {
    draft_id: 'd1',
    market_name: 'Lidl',
    bill_date: '2026-05-07',
    currency: 'EUR',
    total_amount: 10,
    items: [
      {
        name: 'BREAD',
        quantity: 1,
        unit: 'piece',
        weight_kg: null,
        price_per_kg: null,
        final_price: 1.2,
        sub_category: null,
        category_confidence: 0.9,
      },
    ],
    ...overrides,
  };
}

describe('billDraftStore', () => {
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createObjectURL = vi.fn(() => 'blob:fake-url');
    revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      value: createObjectURL,
      configurable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: revokeObjectURL,
      configurable: true,
    });
    useBillDraftStore.getState().clear();
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
  });

  afterEach(() => {
    useBillDraftStore.getState().clear();
  });

  it('setDraft creates a preview URL and seeds edits from parsed data', () => {
    const file = makeFile();
    const parsed = makeParsed();

    useBillDraftStore
      .getState()
      .setDraft({ file, parsed, hid: 'h1', mode: 'confirm' });

    const state = useBillDraftStore.getState();
    expect(state.file).toBe(file);
    expect(state.previewUrl).toBe('blob:fake-url');
    expect(state.parsed).toBe(parsed);
    expect(state.edits.market_name).toBe('Lidl');
    expect(state.edits.bill_date).toBe('2026-05-07');
    expect(state.edits.currency).toBe('EUR');
    expect(state.edits.total_amount).toBe(10);
    expect(state.edits.items[0]!.name).toBe('BREAD');
    expect(state.edits.items[0]!.quantity).toBe(1);
    expect(state.edits.items[0]!.unit).toBe('piece');
  });

  it('setDraft defaults null parsed fields to empty string / 0', () => {
    const file = makeFile();
    const parsed = makeParsed({
      market_name: null,
      bill_date: null,
      currency: null,
      total_amount: null,
      items: [],
    });

    useBillDraftStore
      .getState()
      .setDraft({ file, parsed, hid: 'h1', mode: 'confirm' });

    const e = useBillDraftStore.getState().edits;
    expect(e.market_name).toBe('');
    expect(e.bill_date).toBe('');
    expect(e.currency).toBe('');
    expect(e.total_amount).toBe(0);
  });

  it('setDraft revokes a previously set preview URL', () => {
    const first = makeFile('a.jpg');
    useBillDraftStore.getState().setDraft({
      file: first,
      parsed: makeParsed(),
      hid: 'h1',
      mode: 'confirm',
    });
    createObjectURL.mockReturnValueOnce('blob:second');

    const second = makeFile('b.jpg');
    useBillDraftStore.getState().setDraft({
      file: second,
      parsed: makeParsed(),
      hid: 'h1',
      mode: 'confirm',
    });

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake-url');
    expect(useBillDraftStore.getState().previewUrl).toBe('blob:second');
  });

  it('updateEdits patches edits', () => {
    useBillDraftStore.getState().setDraft({
      file: makeFile(),
      parsed: makeParsed(),
      hid: 'h1',
      mode: 'confirm',
    });
    useBillDraftStore.getState().updateEdits({ market_name: 'Rewe' });
    expect(useBillDraftStore.getState().edits.market_name).toBe('Rewe');
  });

  it('updateItem patches a single item by index', () => {
    useBillDraftStore.getState().setDraft({
      file: makeFile(),
      parsed: makeParsed(),
      hid: 'h1',
      mode: 'confirm',
    });
    useBillDraftStore.getState().updateItem(0, { name: 'Sourdough' });
    expect(useBillDraftStore.getState().edits.items[0]!.name).toBe('Sourdough');
  });

  it('addItem appends a default item and returns its index', () => {
    useBillDraftStore.getState().setDraft({
      file: makeFile(),
      parsed: makeParsed(),
      hid: 'h1',
      mode: 'confirm',
    });

    const i = useBillDraftStore.getState().addItem();

    const items = useBillDraftStore.getState().edits.items;
    expect(i).toBe(items.length - 1);
    expect(items[i]).toMatchObject({
      name: '',
      quantity: 1,
      unit: 'piece',
      weight_kg: null,
      price_per_kg: null,
      final_price: 0,
      sub_category: null,
      category_confidence: 1,
    });
  });

  it('removeItem splices the item at index', () => {
    useBillDraftStore.getState().setDraft({
      file: makeFile(),
      parsed: makeParsed(),
      hid: 'h1',
      mode: 'confirm',
    });
    useBillDraftStore.getState().addItem();
    expect(useBillDraftStore.getState().edits.items).toHaveLength(2);

    useBillDraftStore.getState().removeItem(0);

    const items = useBillDraftStore.getState().edits.items;
    expect(items).toHaveLength(1);
    expect(items[0]!.name).toBe(''); // the appended one
  });

  it('removeItem is a no-op for out-of-bounds indices', () => {
    useBillDraftStore.getState().setDraft({
      file: makeFile(),
      parsed: makeParsed(),
      hid: 'h1',
      mode: 'confirm',
    });

    useBillDraftStore.getState().removeItem(99);

    expect(useBillDraftStore.getState().edits.items).toHaveLength(1);
  });

  it('clear revokes preview URL and nulls slots', () => {
    useBillDraftStore.getState().setDraft({
      file: makeFile(),
      parsed: makeParsed(),
      hid: 'h1',
      mode: 'confirm',
    });

    useBillDraftStore.getState().clear();

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake-url');
    const s = useBillDraftStore.getState();
    expect(s.file).toBeNull();
    expect(s.previewUrl).toBeNull();
    expect(s.parsed).toBeNull();
    expect(s.edits.items).toEqual([]);
  });
  it('setDraft keeps line ids on edit items', () => {
    const parsed = makeParsed({
      items: [{ ...makeParsed().items[0]!, id: 'l1' }],
    });
    useBillDraftStore
      .getState()
      .setDraft({ file: makeFile(), parsed, hid: 'h1', mode: 'confirm' });

    const s = useBillDraftStore.getState();
    expect(s.edits.items[0]!.id).toBe('l1');
    expect(s.hid).toBe('h1');
    expect(s.draftId).toBe('d1');
    expect(s.mode).toBe('confirm');
  });

  it('setDraft in create mode leaves draftId null', () => {
    useBillDraftStore.getState().setDraft({
      file: makeFile(),
      parsed: makeParsed(),
      hid: 'h1',
      mode: 'create',
    });

    const s = useBillDraftStore.getState();
    expect(s.draftId).toBeNull();
    expect(s.mode).toBe('create');
  });

  it('clear resets hid, draftId and mode', () => {
    useBillDraftStore.getState().setDraft({
      file: makeFile(),
      parsed: makeParsed(),
      hid: 'h1',
      mode: 'confirm',
    });

    useBillDraftStore.getState().clear();

    const s = useBillDraftStore.getState();
    expect(s.hid).toBeNull();
    expect(s.draftId).toBeNull();
    expect(s.mode).toBeNull();
  });
});
