import { apiClient } from '@/auth/apiClient';
import { BILLS_ENDPOINTS } from '@/const/bills';
import type {
  BillDetailResponseDto,
  BillResponseDto,
  ParsedBillResponse,
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
  parsePhoto: async (file: File): Promise<ParsedBillResponse> => {
    const formData = new FormData();
    formData.append('image', file);
    // Override the instance-level 'Content-Type: application/json' so axios
    // (and the browser) set 'multipart/form-data; boundary=…' automatically.
    const config = {
      headers: { 'Content-Type': undefined },
    } as unknown as AxiosRequestConfig;
    const { data } = await apiClient.post<ParsedBillResponse>(
      BILLS_ENDPOINTS.PARSE_PHOTO,
      formData,
      config
    );
    return data;
  },

  list: async (
    filters: ConfirmedBillsFilters,
    page: number,
    limit: number
  ): Promise<Paginated<BillResponseDto>> => {
    const { data } = await apiClient.get<Paginated<BillResponseDto>>(
      BILLS_ENDPOINTS.LIST,
      {
        params: buildBillsQueryParams(filters, page, limit),
        paramsSerializer: billsParamsSerializer,
      }
    );
    return data;
  },

  detail: async (id: string): Promise<BillDetailResponseDto> => {
    const { data } = await apiClient.get<BillDetailResponseDto>(
      BILLS_ENDPOINTS.DETAIL(id)
    );
    return data;
  },
};
