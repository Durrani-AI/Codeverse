/*
 * API client - Axios-based typed HTTP client for the FastAPI backend.
 *
 * - Axios instance with base URL + JSON defaults
 * - Request interceptor: attaches Bearer token automatically
 * - Response interceptor: normalises errors, handles 401 (auto-logout)
 * - Every endpoint function is fully typed with interfaces from @/types
 */

import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";

import type {
  AnalyticsOverview,
  AnswerSubmitResponse,
  ApiError,
  ApiResponse,
  InterviewSession,
  InterviewStartResponse,
  LoginRequest,
  RecentSession,
  RegisterRequest,
  SessionFeedbackResponse,
  StartInterviewRequest,
  SubmitAnswerRequest,
  TokenResponse,
  User,
} from "@/types";

// Configuration

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api/v1";

// Token helpers

let accessToken: string | null = null;

export function getToken(): string | null {
  if (accessToken) return accessToken;
  if (typeof window !== "undefined") {
    accessToken = localStorage.getItem("token");
  }
  return accessToken;
}

export function setToken(token: string): void {
  accessToken = token;
  if (typeof window !== "undefined") {
    localStorage.setItem("token", token);
  }
}

export function clearToken(): void {
  accessToken = null;
  if (typeof window !== "undefined") {
    localStorage.removeItem("token");
  }
}

// Axios instance──

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  timeout: 60_000, // 60 s - generous for Render free-tier cold starts + AI responses
});

// Request interceptor - attach Bearer token

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error),
);

// Response interceptor - normalise errors & handle 401────

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError<ApiError>) => {
    if (error.response) {
      const { status } = error.response;

      // 401 Unauthorized -> clear tokens & redirect to login
      if (status === 401) {
        clearToken();
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
      }

      // Normalise the error payload so callers always get a message string
      const data = error.response.data as Record<string, unknown> | undefined;

      // 422 validation errors return { details: [{field, message}, ...] }
      if (status === 422 && data?.details && Array.isArray(data.details)) {
        const msgs = (data.details as Array<{ field?: string; message?: string }>)
          .map((d) => d.message || "Invalid value")
          .join(". ");
        error.message = msgs || "Validation failed";
        return Promise.reject(error);
      }

      const message =
        (typeof data?.detail === "string" ? data.detail : undefined) ??
        (typeof data?.message === "string" ? data.message : undefined) ??
        (typeof data?.error === "string" ? data.error : undefined) ??
        `Request failed with status ${status}`;

      // Preserve the original AxiosError so request() can extract the status code
      error.message = message;
      return Promise.reject(error);
    }

    // Network / timeout error
    if (error.code === "ECONNABORTED") {
      return Promise.reject(new Error("Request timed out - please try again."));
    }

    return Promise.reject(
      new Error("Network error - check your connection and try again."),
    );
  },
);

// Generic typed helper

async function request<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  data?: unknown,
): Promise<ApiResponse<T>> {
  try {
    const res = await api.request<T>({ method, url: path, data });
    return { ok: true, status: res.status, data: res.data };
  } catch (err) {
    // If the error came from the response interceptor it's already an Error.
    // Try to extract the original status code from the axios error.
    const axiosErr = err as AxiosError;
    const status = axiosErr.response?.status ?? 500;
    const message =
      err instanceof Error ? err.message : "An unexpected error occurred";

    return {
      ok: false,
      status,
      data: { detail: message } as unknown as T,
    };
  }
}

// Auth endpoints

/** Register a new user account. */
export async function register(body: RegisterRequest) {
  return request<User>("POST", "/auth/register", body);
}

/** Log in with username + password; stores token on success. */
export async function login(body: LoginRequest) {
  const res = await request<TokenResponse>("POST", "/auth/login", body);
  if (res.ok) {
    setToken(res.data.access_token);
  }
  return res;
}

/** Get the currently authenticated user profile. */
export async function getMe() {
  return request<User>("GET", "/auth/me");
}

/** Log out - simply clears the stored token (stateless JWT). */
export function logout(): void {
  clearToken();
}

/** Change the authenticated user's password. */
export async function changePassword(body: { current_password: string; new_password: string }) {
  return request<{ message: string }>("PUT", "/auth/password", body);
}

/** Change the authenticated user's username. */
export async function changeUsername(body: { username: string }) {
  return request<User>("PUT", "/auth/username", body);
}

/** Permanently delete the authenticated user's account. */
export async function deleteAccount() {
  return request<{ message: string }>("DELETE", "/auth/account");
}

/** Upload or replace profile picture. Max 5 MB. */
export async function uploadProfilePicture(file: File): Promise<ApiResponse<User>> {
  const formData = new FormData();
  formData.append("file", file);
  try {
    const res = await api.put<User>("/auth/profile-picture", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return { ok: true, status: res.status, data: res.data };
  } catch (err) {
    const axiosErr = err as import("axios").AxiosError;
    const status = axiosErr.response?.status ?? 500;
    const message = err instanceof Error ? err.message : "Upload failed";
    return { ok: false, status, data: { detail: message } as unknown as User };
  }
}

/** Remove profile picture. */
export async function removeProfilePicture() {
  return request<User>("DELETE", "/auth/profile-picture");
}

/** Change the authenticated user's email. */
export async function changeEmail(body: { email: string }) {
  return request<User>("PUT", "/auth/email", body);
}

// Interview endpoints

/** Start a new interview session. */
export async function startInterview(body: StartInterviewRequest) {
  return request<InterviewStartResponse>("POST", "/interviews/start", body);
}

/** Submit an answer for a given session. */
export async function submitAnswer(
  sessionId: string,
  body: SubmitAnswerRequest,
) {
  return request<AnswerSubmitResponse>(
    "POST",
    `/interviews/${sessionId}/answer`,
    body,
  );
}

/** Get overall feedback / summary for a completed session. */
export async function getSessionFeedback(sessionId: string) {
  return request<SessionFeedbackResponse>(
    "POST",
    `/interviews/${sessionId}/feedback`,
  );
}

/** List all interview sessions for the logged-in user. */
export async function listSessions() {
  return request<InterviewSession[]>("GET", "/interviews/");
}

/** Get a single interview session by ID. */
export async function getSession(sessionId: string) {
  return request<InterviewSession>("GET", `/interviews/${sessionId}`);
}

/** Cancel (delete) an in-progress interview session. */
export async function cancelSession(sessionId: string) {
  return request<{ message: string }>(
    "DELETE",
    `/interviews/${sessionId}`,
  );
}

// Analytics endpoints

/** Get analytics overview for the authenticated user. */
export async function getAnalyticsOverview() {
  return request<AnalyticsOverview>("GET", "/analytics/overview");
}

/** Get recent activity / session list for the authenticated user. */
export async function getRecentActivity() {
  return request<RecentSession[]>("GET", "/analytics/recent-activity");
}

// Export the raw axios instance for advanced use cases

export default api;
