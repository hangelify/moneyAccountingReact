import { create } from 'zustand';
import type {
  BillEdits,
  BillEditItem,
  ParsedBillItem,
  ParsedBill,
} from '@/types/bills';

interface BillDraftState {
  file: File | null;
  previewUrl: string | null;
  hid: string | null;
  draftId: string | null; // null in 'create' mode
  mode: 'confirm' | 'create' | null;
  parsed: ParsedBill | null;
  edits: BillEdits;
  setDraft: (args: {
    file: File;
    parsed: ParsedBill;
    hid: string;
    mode: 'confirm' | 'create';
  }) => void;
  updateEdits: (patch: Partial<BillEdits>) => void;
  updateItem: (index: number, patch: Partial<BillEditItem>) => void;
  addItem: () => number;
  removeItem: (index: number) => void;
  clear: () => void;
}

const EMPTY_EDITS: BillEdits = {
  market_name: '',
  bill_date: '',
  currency: '',
  total_amount: 0,
  items: [],
};

function toEditItem(item: ParsedBillItem): BillEditItem {
  return {
    ...(item.id !== undefined ? { id: item.id } : {}),
    name: item.name,
    quantity: item.quantity ?? 0,
    unit: item.unit ?? '',
    weight_kg: item.weight_kg,
    price_per_kg: item.price_per_kg,
    final_price: item.final_price,
    sub_category: item.sub_category,
    category_confidence: item.category_confidence,
    ...(item.category_reasoning !== undefined
      ? { category_reasoning: item.category_reasoning }
      : {}),
  };
}

function toEdits(parsed: ParsedBill): BillEdits {
  return {
    market_name: parsed.market_name ?? '',
    bill_date: parsed.bill_date ?? '',
    currency: parsed.currency ?? '',
    total_amount: parsed.total_amount ?? 0,
    items: parsed.items.map(toEditItem),
  };
}

export const useBillDraftStore = create<BillDraftState>((set, get) => ({
  file: null,
  previewUrl: null,
  hid: null,
  draftId: null,
  mode: null,
  parsed: null,
  edits: EMPTY_EDITS,

  setDraft: ({ file, parsed, hid, mode }) => {
    const existing = get().previewUrl;
    if (existing) URL.revokeObjectURL(existing);
    const previewUrl = URL.createObjectURL(file);
    set({
      file,
      previewUrl,
      hid,
      draftId: mode === 'confirm' ? parsed.draft_id : null,
      mode,
      parsed,
      edits: toEdits(parsed),
    });
  },

  updateEdits: (patch) => {
    set((s) => ({ edits: { ...s.edits, ...patch } }));
  },

  updateItem: (index, patch) => {
    set((s) => {
      const items = s.edits.items.slice();
      if (items[index]) items[index] = { ...items[index], ...patch };
      return { edits: { ...s.edits, items } };
    });
  },

  addItem: () => {
    const newItem: BillEditItem = {
      name: '',
      quantity: 1,
      unit: 'piece',
      weight_kg: null,
      price_per_kg: null,
      final_price: 0,
      sub_category: null,
      category_confidence: 1,
    };
    const newIndex = get().edits.items.length;
    set((s) => ({
      edits: { ...s.edits, items: [...s.edits.items, newItem] },
    }));
    return newIndex;
  },

  removeItem: (index) => {
    set((s) => {
      if (index < 0 || index >= s.edits.items.length) return {};
      const items = s.edits.items.slice();
      items.splice(index, 1);
      return { edits: { ...s.edits, items } };
    });
  },

  clear: () => {
    const existing = get().previewUrl;
    if (existing) URL.revokeObjectURL(existing);
    set({
      file: null,
      previewUrl: null,
      hid: null,
      draftId: null,
      mode: null,
      parsed: null,
      edits: EMPTY_EDITS,
    });
  },
}));
