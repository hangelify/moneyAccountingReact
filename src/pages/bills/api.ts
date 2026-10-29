import { apiClient } from '@/auth/apiClient';
import { BILLS_ENDPOINTS } from '@/const/bills';
import { householdPath } from '@/const/households';
import type {
  BillDetailResponseDto,
  BillResponseDto,
  ConfirmBillRequest,
  CreateBillRequest,
  DraftBillDto,
  ParsePhotoResponse,
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

  // Drafts accept only page and limit; any other param is a 400.
  listDrafts: async (
    hid: string,
    page: number,
    limit: number
  ): Promise<Paginated<DraftBillDto>> => {
    const { data } = await apiClient.get<Paginated<DraftBillDto>>(
      householdPath(hid, BILLS_ENDPOINTS.DRAFTS),
      { params: { page, limit } }
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

  remove: async (hid: string, id: string): Promise<void> => {
    await apiClient.delete(householdPath(hid, BILLS_ENDPOINTS.DETAIL(id)));
  },
};
