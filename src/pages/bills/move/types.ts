import type {
  BillDetailResponseDto,
  BillResponseDto,
  MoveConflict,
} from '@/types/bills';
import type { Household } from '@/types/households';
import { billPath } from '@/lib/billPath';

/** A bill as it was on screen when the move started. */
export interface MoveBillRef {
  id: string;
  status: 'draft' | 'confirmed';
  marketName: string | null;
  billDate: string;
  total: number;
  currency: string | null;
}

export interface MovedBillInfo extends MoveBillRef {
  lostCategory: number;
  lostSubCategory: number;
  alreadyMoved: boolean;
}

export interface MoveOutcome {
  target: Household;
  moved: MovedBillInfo[];
  // Items that lost the category.
  lostLines: number;
  // Items that kept the category but lost the subcategory.
  lostSubLines: number;
  withLosses: MovedBillInfo[];
}

export type MoveFailure =
  | { kind: 'conflicts'; conflicts: MoveConflict[] }
  | { kind: 'missing'; ids: string[] }
  | { kind: 'forbidden' }
  | { kind: 'other' };

export function toMoveBillRef(
  bill: BillResponseDto | BillDetailResponseDto
): MoveBillRef {
  return {
    id: bill.id,
    status: bill.status === 'draft' ? 'draft' : 'confirmed',
    marketName: bill.market?.name ?? null,
    billDate: bill.bill_date,
    total: bill.total_amount,
    currency: bill.currency ?? null,
  };
}

/** The rejection of useMoveBills().move. */
export class MoveError extends Error {
  readonly failure: MoveFailure;

  constructor(failure: MoveFailure) {
    super(`Move failed: ${failure.kind}`);
    this.name = 'MoveError';
    this.failure = failure;
  }
}

/** A link to a moved bill in its new budget. */
export function movedBillHref(bill: MoveBillRef, targetId: string): string {
  return billPath(
    bill.status === 'draft' ? 'drafts' : 'all',
    bill.id,
    targetId
  );
}
