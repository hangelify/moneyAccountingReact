import type {
  BillBatch,
  BillEventData,
  BillEventType,
  ItemEventData,
} from '../../types/bills';

export interface WaitingChange {
  set?: number;
  clear?: number;
}

export function applyBatchEvent(
  batch: BillBatch,
  type: BillEventType,
  data: BillEventData
): { batch: BillBatch; waiting: WaitingChange } {
  if (data.batch_id !== batch.batch_id) return { batch, waiting: {} };

  if (type === 'batch.completed') {
    return { batch: { ...batch, completed: true }, waiting: {} };
  }

  const event = data as ItemEventData;
  const previous = batch.items.find((i) => i.position === event.position);
  const items = batch.items.map((item) =>
    item.position === event.position
      ? {
          ...item,
          status: event.status,
          bill_id: event.bill_id ?? item.bill_id,
          parse_error_code: event.parse_error_code ?? null,
          parse_error_message: event.parse_error_message ?? null,
        }
      : item
  );
  const waiting: WaitingChange =
    previous?.status === 'processing' && event.status === 'queued'
      ? { set: event.position }
      : { clear: event.position };
  return { batch: { ...batch, items }, waiting };
}
