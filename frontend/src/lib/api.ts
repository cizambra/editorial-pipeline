// Typed API client — all calls go through fetch with credentials

const BASE = "";  // same-origin

export interface AuthUser {
  id: number;
  email: string;
  display_name?: string;
  role: string;
  status?: string;
}

export interface AuthMeResponse {
  authenticated: boolean;
  auth_mode: string;
  user?: AuthUser | null;
}

export interface AuthLoginResponse {
  authenticated: boolean;
  auth_mode: string;
  user: AuthUser;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw Object.assign(new Error(err.detail ?? "Request failed"), { status: res.status });
  }
  return res.json();
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const auth = {
  me: () => request<AuthMeResponse>("/api/auth/me"),
  login: (email: string, password: string) =>
    request<AuthLoginResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  listUsers: () => request<any[]>("/api/auth/users"),
  createUser: (data: any) => request<any>("/api/auth/users", { method: "POST", body: JSON.stringify(data) }),
  updateUser: (id: string, data: any) => request<any>(`/api/auth/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  createInvite: (data: any) => request<any>("/api/auth/invites", { method: "POST", body: JSON.stringify(data) }),
  acceptInvite: (data: any) => request<any>("/api/auth/invites/accept", { method: "POST", body: JSON.stringify(data) }),
  auditEvents: (limit = 50) => request<any[]>(`/api/auth/audit?limit=${limit}`),
};

// ── Pipeline ──────────────────────────────────────────────────────────────────
export function pipelineStream(formData: FormData): EventSource {
  // We use fetch + ReadableStream for SSE since we need POST
  throw new Error("Use pipelineFetch instead");
}

export async function pipelineFetch(
  formData: FormData,
  onEvent: (event: string, data: any) => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch("/api/pipeline/run", {
    method: "POST",
    credentials: "include",
    body: formData,
    signal,
  });
  if (!res.ok) throw new Error(await res.text());
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let eventType = "message";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop()!;
    for (const line of lines) {
      if (line.startsWith("event:")) eventType = line.slice(6).trim();
      else if (line.startsWith("data:")) {
        const raw = line.slice(5).trim();
        try { onEvent(eventType, JSON.parse(raw)); } catch { onEvent(eventType, raw); }
        eventType = "message";
      }
    }
  }
}

export async function thumbnailConceptsFetch(
  title: string,
  articleText: string,
  onEvent: (event: string, data: any) => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch("/api/generate-thumbnail-concepts", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, article_text: articleText, auto_generate: true }),
    signal,
  });
  if (!res.ok) throw new Error(await res.text());
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let eventType = "message";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop()!;
    for (const line of lines) {
      if (line.startsWith("event:")) eventType = line.slice(6).trim();
      else if (line.startsWith("data:")) {
        const raw = line.slice(5).trim();
        try { onEvent(eventType, JSON.parse(raw)); } catch { onEvent(eventType, raw); }
        eventType = "message";
      }
    }
  }
}

export const pipeline = {
  checkpoint: () => request<any>("/api/pipeline/checkpoint"),
  clearCheckpoint: () => request<any>("/api/pipeline/checkpoint", { method: "DELETE" }),
  cancel: () => request<any>("/api/pipeline/cancel", { method: "POST" }),
  regenerate: (data: any) => request<any>("/api/pipeline/regenerate", { method: "POST", body: JSON.stringify(data) }),
  companion: (data: { text: string; title: string; article_url?: string; include_spanish?: boolean }) =>
    request<{ companion: { title: string; title_es: string; en: string; es: string }; tokens: any }>("/api/pipeline/companion", { method: "POST", body: JSON.stringify(data) }),
  getQueue: () => request<{ items: any[] }>("/api/pipeline/queue"),
  saveQueue: (items: any[]) => request<{ ok: boolean }>("/api/pipeline/queue", { method: "POST", body: JSON.stringify({ items }) }),
  clearQueue: () => request<{ ok: boolean }>("/api/pipeline/queue", { method: "DELETE" }),
};

// ── History ───────────────────────────────────────────────────────────────────
export const history = {
  list: (limit = 50) => request<any[]>(`/api/history?limit=${limit}`),
  get: (runId: string) => request<any>(`/api/history/${runId}`),
  delete: (runId: string) => request<any>(`/api/history/${runId}`, { method: "DELETE" }),
  saveThumbnailConcepts: (runId: string, concepts: any[]) =>
    request<any>(`/api/history/${runId}/thumbnail-concepts`, { method: "POST", body: JSON.stringify({ concepts }) }),
};

// ── Marketing / Campaigns ─────────────────────────────────────────────────────
export const marketing = {
  library: (q?: string) => request<any>(`/api/marketing/library${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  scheduled: () => request<any[]>("/api/schedule/list"),
  published: () => request<any[]>("/api/publish/list"),
  cancelScheduled: (id: string) => request<any>(`/api/schedule/${id}/cancel`, { method: "POST" }),
  deleteScheduled: (id: string) => request<any>(`/api/schedule/${id}`, { method: "DELETE" }),
  publish: (data: any) => request<any>("/api/publish", { method: "POST", body: JSON.stringify(data) }),
  schedule: (data: any) => request<any>("/api/schedule", { method: "POST", body: JSON.stringify(data) }),
};

// ── Social notes / Compose ────────────────────────────────────────────────────
export const notes = {
  generate: (data: any) => request<any>("/api/substack-notes/generate", { method: "POST", body: JSON.stringify(data) }),
  search: (q: string) => request<any[]>(`/api/substack-notes/search?q=${encodeURIComponent(q)}`),
  batches: () => request<any[]>("/api/substack-notes/batches"),
  batchNotes: (batchId: string) => request<any[]>(`/api/substack-notes/batches/${batchId}`),
  update: (id: string, data: any) => request<any>(`/api/substack-notes/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: string) => request<any>(`/api/substack-notes/${id}`, { method: "DELETE" }),
  deleteBatch: (id: string) => request<any>(`/api/substack-notes/batches/${id}`, { method: "DELETE" }),
  repurpose: (id: string) => request<any>(`/api/substack-notes/${id}/repurpose`, { method: "POST" }),
  composeRepurpose: (data: any) => request<any>("/api/social/compose/repurpose", { method: "POST", body: JSON.stringify(data) }),
};

// ── Quotes ────────────────────────────────────────────────────────────────────
export const quotes = {
  runs: () => request<any[]>("/api/quotes"),
  forRun: (runId: string) => request<any[]>(`/api/quotes/${runId}`),
  update: (id: string, data: any) => request<any>(`/api/quotes/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  repurpose: (id: string) => request<any>(`/api/quotes/${id}/repurpose`, { method: "POST" }),
  promote: (id: string) => request<any>(`/api/quotes/${id}/promote`, { method: "POST" }),
};

// ── Thumbnails ────────────────────────────────────────────────────────────────
export const thumbnails = {
  list: (q?: string) => request<any[]>(`/api/thumbnails${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  get: (id: string) => request<any>(`/api/thumbnails/${id}`),
  save: (data: any) => request<any>("/api/thumbnails", { method: "POST", body: JSON.stringify(data) }),
  delete: (id: string) => request<any>(`/api/thumbnails/${id}`, { method: "DELETE" }),
  generate: (data: any) => request<any>("/api/imagen/generate", { method: "POST", body: JSON.stringify(data) }),
};

// ── Audience / Subscribers ────────────────────────────────────────────────────
export const audience = {
  list: (params?: { q?: string; interval?: string; limit?: number; offset?: number }) => {
    const p = new URLSearchParams();
    if (params?.q) p.set("q", params.q);
    if (params?.interval) p.set("interval", params.interval);
    if (params?.limit) p.set("limit", String(params.limit));
    if (params?.offset) p.set("offset", String(params.offset));
    return request<{ subscribers: any[]; total: number }>(`/api/substack/subscribers?${p}`);
  },
  detail: (email: string) => request<any>(`/api/substack/subscribers/${encodeURIComponent(email)}/detail`),
  sync: () => request<any>("/api/substack/subscribers/sync", { method: "POST" }),
  insights: () => request<any>("/api/substack/audience"),
};

// ── Ideas ─────────────────────────────────────────────────────────────────────
export const ideas = {
  list: () => request<any[]>("/api/ideas"),
  create: (data: any) => request<any>("/api/ideas", { method: "POST", body: JSON.stringify(data) }),
  updateStatus: (id: string, status: string) => request<any>(`/api/ideas/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  delete: (id: string) => request<any>(`/api/ideas/${id}`, { method: "DELETE" }),
  /** SSE scan — calls onProgress with each status line, resolves with result event data */
  redditScan: (onProgress: (msg: string) => void): Promise<{ categories: any[]; total_posts: number }> =>
    new Promise(async (resolve, reject) => {
      try {
        const res = await fetch("/api/reddit-struggles", { method: "POST", credentials: "include" });
        if (!res.ok || !res.body) { reject(new Error(`HTTP ${res.status}`)); return; }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const parts = buf.split("\n\n");
          buf = parts.pop() ?? "";
          for (const part of parts) {
            const eventLine = part.match(/^event:\s*(.+)$/m)?.[1]?.trim();
            const dataLine = part.match(/^data:\s*(.+)$/m)?.[1]?.trim();
            if (!dataLine) continue;
            const payload = JSON.parse(dataLine);
            if (eventLine === "progress") onProgress(payload.message ?? "");
            else if (eventLine === "error") { reject(new Error(payload.message)); return; }
            else if (eventLine === "result") { resolve(payload); return; }
          }
        }
        reject(new Error("Stream ended without result"));
      } catch (e) { reject(e); }
    }),
};

// ── Social publish / schedule ─────────────────────────────────────────────────
export const social = {
  publish: (data: any) => request<any>("/api/social/publish", { method: "POST", body: JSON.stringify(data) }),
  schedule: (data: any) => request<any>("/api/social/schedule", { method: "POST", body: JSON.stringify(data) }),
  scheduled: () => request<any>("/api/social/scheduled"),
  published: (limit = 50) => request<any>(`/api/social/published?limit=${limit}`),
};

// ── Settings / Config ─────────────────────────────────────────────────────────
export const settings = {
  getConfig: () => request<any>("/api/config"),
  saveConfig: (data: any) => request<any>("/api/config", { method: "POST", body: JSON.stringify(data) }),
  getTemplate: () => request<any>("/api/template"),
  uploadTemplate: (formData: FormData) =>
    fetch("/api/template", { method: "POST", credentials: "include", body: formData }).then(r => r.json()),
  getArticles: () => request<any[]>("/api/articles"),
  refreshArticles: () => request<any>("/api/articles/refresh", { method: "POST" }),
  indexNewArticles: () => request<any>("/api/articles/index", { method: "POST" }),
  getDashboard: () => request<any>("/api/dashboard"),
  testSubstack: () => request<any>("/api/substack/test", { method: "POST" }),
};
