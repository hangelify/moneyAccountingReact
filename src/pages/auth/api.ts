import { apiClient } from '@/auth/apiClient';
import { AUTH_ENDPOINTS } from '@/const/auth';
import type {
  LoginRequest,
  RegisterRequest,
  TokenResponseDto,
  UserProfileDto,
} from '@/types/auth';

export const authApi = {
  login: (p: LoginRequest): Promise<TokenResponseDto> =>
    apiClient
      .post<TokenResponseDto>(AUTH_ENDPOINTS.LOGIN, p)
      .then((r) => r.data),
  register: (p: RegisterRequest): Promise<TokenResponseDto> =>
    apiClient
      .post<TokenResponseDto>(AUTH_ENDPOINTS.REGISTER, p)
      .then((r) => r.data),
  /** Refresh token travels in the HttpOnly cookie; no body. */
  refresh: (): Promise<TokenResponseDto> =>
    apiClient
      .post<TokenResponseDto>(AUTH_ENDPOINTS.REFRESH)
      .then((r) => r.data),
  /** Ends the session identified by the access token; no body. */
  logout: (): Promise<void> =>
    apiClient.post<void>(AUTH_ENDPOINTS.LOGOUT).then(() => undefined),
  /** Ends the session identified by the refresh cookie; no body. */
  revoke: (): Promise<void> =>
    apiClient.post<void>(AUTH_ENDPOINTS.REVOKE).then(() => undefined),
  me: (): Promise<UserProfileDto> =>
    apiClient.get<UserProfileDto>(AUTH_ENDPOINTS.ME).then((r) => r.data),
};
