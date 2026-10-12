import type { Interview, InterviewInput } from "../shared/types";

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
