import { apiClient } from '@/auth/apiClient';
import { BILLS_ENDPOINTS } from '@/const/bills';
import { householdPath } from '@/const/households';
import type {
  BillBatch,
  BillDetailResponseDto,
  BillResponseDto,
  ConfirmBillRequest,
  CreateBillRequest,
  DraftBillDto,
  DuplicateRange,
  DuplicateSuggestionsResponse,
  ParsePhotoResponse,
  UpdateBillRequest,
} from '@/types/bills';
import type { Paginated } from '@/types/pagination';
import type { AxiosRequestConfig } from 'axios';
import {
  buildBillsQueryParams,
  type ConfirmedBillsFilters,
} from './buildBillsQueryParams';

function billsParamsSerializer(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  const append = (key: string, v: unknown): void => {
    if (typeof v === 'string') sp.append(key, v);
    else if (typeof v === 'number' || typeof v === 'boolean')
      sp.append(key, String(v));
  };
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue;
    if (Array.isArray(value)) value.forEach((v) => append(key, v));
    else append(key, value);
  }
  return sp.toString();
}

export const billsApi = {
  parsePhoto: async (
    hid: string,
    file: Blob,
    opts?: { signal?: AbortSignal }
  ): Promise<ParsePhotoResponse> => {
    const formData = new FormData();
    formData.append('image', file);
    // Override the instance-level 'Content-Type: application/json' so axios
    // (and the browser) set 'multipart/form-data; boundary=…' automatically.
    const config = {
      headers: { 'Content-Type': undefined },
      timeout: 120_000,
      ...(opts?.signal ? { signal: opts.signal } : {}),
    } as unknown as AxiosRequestConfig;
    const { data } = await apiClient.post<ParsePhotoResponse>(
      householdPath(hid, BILLS_ENDPOINTS.PARSE_PHOTO),
      formData,
      config
    );
    return data;
  },

  parsePhotos: async (
    hid: string,
    files: Blob[],
    opts?: { signal?: AbortSignal }
  ): Promise<BillBatch> => {
    const formData = new FormData();
    for (const file of files) formData.append('images', file);
    const config = {
      headers: { 'Content-Type': undefined },
      timeout: 120_000,
      ...(opts?.signal ? { signal: opts.signal } : {}),
    } as unknown as AxiosRequestConfig;
    const { data } = await apiClient.post<BillBatch>(
      householdPath(hid, BILLS_ENDPOINTS.PARSE_PHOTOS),
      formData,
      config
    );
    return data;
  },

  batch: async (hid: string, id: string): Promise<BillBatch> => {
    const { data } = await apiClient.get<BillBatch>(
      householdPath(hid, BILLS_ENDPOINTS.BATCH(id))
    );
    return data;
  },

  retry: async (hid: string, id: string): Promise<BillBatch> => {
    const { data } = await apiClient.post<BillBatch>(
      householdPath(hid, BILLS_ENDPOINTS.RETRY(id))
    );
    return data;
  },

  draftImage: async (hid: string, id: string): Promise<Blob> => {
    const { data } = await apiClient.get<Blob>(
      householdPath(hid, BILLS_ENDPOINTS.DRAFT_IMAGE(id)),
      { responseType: 'blob' }
    );
    return data;
  },

  list: async (
    hid: string,
    filters: ConfirmedBillsFilters,
    page: number,
    limit: number
  ): Promise<Paginated<BillResponseDto>> => {
    const { data } = await apiClient.get<Paginated<BillResponseDto>>(
      householdPath(hid, BILLS_ENDPOINTS.LIST),
      {
        params: buildBillsQueryParams(filters, page, limit),
        paramsSerializer: billsParamsSerializer,
      }
    );
    return data;
  },

  // Drafts accept page, limit and status; status is sent only for 'failed'.
  listDrafts: async (
    hid: string,
    page: number,
    limit: number,
    status: 'draft' | 'failed' = 'draft'
  ): Promise<Paginated<DraftBillDto>> => {
    const { data } = await apiClient.get<Paginated<DraftBillDto>>(
      householdPath(hid, BILLS_ENDPOINTS.DRAFTS),
      {
        params: status === 'failed' ? { page, limit, status } : { page, limit },
      }
    );
    return data;
  },

  detail: async (hid: string, id: string): Promise<BillDetailResponseDto> => {
    const { data } = await apiClient.get<BillDetailResponseDto>(
      householdPath(hid, BILLS_ENDPOINTS.DETAIL(id))
    );
    return data;
  },

  confirm: async (
    hid: string,
    draftId: string,
    body: ConfirmBillRequest
  ): Promise<BillDetailResponseDto> => {
    const { data } = await apiClient.post<BillDetailResponseDto>(
      householdPath(hid, BILLS_ENDPOINTS.CONFIRM(draftId)),
      body
    );
    return data;
  },

  create: async (
    hid: string,
    body: CreateBillRequest
  ): Promise<BillDetailResponseDto> => {
    const { data } = await apiClient.post<BillDetailResponseDto>(
      householdPath(hid, BILLS_ENDPOINTS.LIST),
      body
    );
    return data;
  },

  // Edits a bill of any status; never changes the status.
  update: async (
    hid: string,
    id: string,
    body: UpdateBillRequest
  ): Promise<BillDetailResponseDto> => {
    const { data } = await apiClient.put<BillDetailResponseDto>(
      householdPath(hid, BILLS_ENDPOINTS.DETAIL(id)),
      body
    );
    return data;
  },

  remove: async (hid: string, id: string): Promise<void> => {
    await apiClient.delete(householdPath(hid, BILLS_ENDPOINTS.DETAIL(id)));
  },

  markDuplicate: async (
    hid: string,
    id: string,
    duplicateOfId: string
  ): Promise<BillDetailResponseDto> => {
    const { data } = await apiClient.post<BillDetailResponseDto>(
      householdPath(hid, BILLS_ENDPOINTS.MARK_DUPLICATE(id)),
      { duplicate_of_id: duplicateOfId }
    );
    return data;
  },

  unmarkDuplicate: async (
    hid: string,
    id: string
  ): Promise<BillDetailResponseDto> => {
    const { data } = await apiClient.post<BillDetailResponseDto>(
      householdPath(hid, BILLS_ENDPOINTS.UNMARK_DUPLICATE(id))
    );
    return data;
  },

  // "Keep both": the pair is never suggested again.
  dismissDuplicate: async (
    hid: string,
    id: string,
    otherBillId: string
  ): Promise<void> => {
    await apiClient.post(
      householdPath(hid, BILLS_ENDPOINTS.DISMISS_DUPLICATE(id)),
      { other_bill_id: otherBillId }
    );
  },

  duplicateSuggestions: async (
    hid: string,
    range: DuplicateRange
  ): Promise<DuplicateSuggestionsResponse> => {
    const params: Record<string, string> = {};
    if (range.date_from) params.date_from = range.date_from;
    if (range.date_to) params.date_to = range.date_to;
    const { data } = await apiClient.get<DuplicateSuggestionsResponse>(
      householdPath(hid, BILLS_ENDPOINTS.DUPLICATE_SUGGESTIONS),
      { params }
    );
    return data;
  },
};
