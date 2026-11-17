import { apiClient } from '@/auth/apiClient';
import { HOUSEHOLDS_ENDPOINTS, householdPath } from '@/const/households';
import type {
  CreateHouseholdRequest,
  Household,
  HouseholdResponse,
  UpdateHouseholdRequest,
  UpdateMyHouseholdRequest,
} from '@/types/households';

export const householdsApi = {
  list: async (): Promise<Household[]> => {
    const { data } = await apiClient.get<Household[]>(
      HOUSEHOLDS_ENDPOINTS.LIST
    );
    return data;
  },
  create: async (body: CreateHouseholdRequest): Promise<HouseholdResponse> => {
    const { data } = await apiClient.post<HouseholdResponse>(
      HOUSEHOLDS_ENDPOINTS.LIST,
      body
    );
    return data;
  },
  update: async (
    hid: string,
    body: UpdateHouseholdRequest
  ): Promise<HouseholdResponse> => {
    const { data } = await apiClient.put<HouseholdResponse>(
      householdPath(hid),
      body
    );
    return data;
  },
  updateMine: async (
    hid: string,
    body: UpdateMyHouseholdRequest
  ): Promise<HouseholdResponse> => {
    const { data } = await apiClient.put<HouseholdResponse>(
      householdPath(hid, '/me'),
      body
    );
    return data;
  },
  remove: async (hid: string): Promise<void> => {
    await apiClient.delete(householdPath(hid));
  },
};
