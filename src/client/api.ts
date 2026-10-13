import type { Interview, InterviewInput } from "../shared/types";

export interface Me {
  email: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}${text ? `: ${text}` : ""}`);
  }
  return (await res.json()) as T;
}

export const api = {
  me: async (): Promise<Me | null> => {
    const res = await fetch("/api/me");
    if (res.status === 401) return null;
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return (await res.json()) as Me;
  },
  register: (email: string, password: string) =>
    request<Me>("/api/register", { method: "POST", body: JSON.stringify({ email, password }) }),
  login: (email: string, password: string) =>
    request<Me>("/api/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => request<{ ok: boolean }>("/api/logout", { method: "POST" }),
  list: () => request<Interview[]>("/api/interviews"),
  create: (input: InterviewInput) =>
    request<Interview>("/api/interviews", { method: "POST", body: JSON.stringify(input) }),
  update: (id: string, input: InterviewInput) =>
    request<Interview>(`/api/interviews/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  remove: (id: string) =>
    request<{ ok: boolean }>(`/api/interviews/${id}`, { method: "DELETE" }),
};
