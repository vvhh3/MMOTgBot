import axios,{ type AxiosError } from "axios";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "fallback no";

export const api = axios.create({
  baseURL: apiBaseUrl,
  headers: { "content-type": "application/json" }
});

export class ApiError extends Error {
  constructor(message: string, public status?: number, public code?: string) { super(message); }
}

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: string; code?: string }>) => {
    const message = error.response?.data?.error ?? error.message;
    return Promise.reject(new ApiError(message, error.response?.status, error.response?.data?.code));
  }
);

export function authHeader(token: string): { authorization: string } {
  return { authorization: `Bearer ${token}` };
}
