import axios,{ type AxiosError } from "axios";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "fallback no";

export const api = axios.create({
  baseURL: apiBaseUrl,
  headers: { "content-type": "application/json" }
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: string }>) => {
    const message = error.response?.data?.error ?? error.message;
    return Promise.reject(new Error(message));
  }
);

export function authHeader(token: string): { authorization: string } {
  return { authorization: `Bearer ${token}` };
}
