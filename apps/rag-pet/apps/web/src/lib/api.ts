import type { ChunkPreview, Document, QueryRequest, QueryResponse, Stats } from '@rag/shared';

// ponytail: the write key is a shared passphrase kept in localStorage and asked
// for with window.prompt on the first 401. Real accounts if this ever gets users.
const KEY = 'rag-write-key';

async function req<T>(path: string, init?: RequestInit, retried = false): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      ...(init?.body && typeof init.body === 'string' ? { 'content-type': 'application/json' } : {}),
      ...(localStorage.getItem(KEY) ? { 'x-write-key': localStorage.getItem(KEY)! } : {}),
    },
  });
  if (res.status === 401 && !retried) {
    const key = window.prompt('This deployment needs a write key to index or delete:');
    if (key) {
      localStorage.setItem(KEY, key);
      return req<T>(path, init, true);
    }
  }
  if (!res.ok) {
    // FastAPI answers with { detail } — a string for HTTPException, an array of
    // issues for a 422. Fall back to the status when a proxy 502 isn't JSON.
    const body = (await res.json().catch(() => null)) as { detail?: unknown } | null;
    const detail = body?.detail;
    throw new Error(
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((d: { msg?: string }) => d.msg ?? 'invalid').join(', ')
          : `${res.status} ${res.statusText}`,
    );
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const api = {
  stats: () => req<Stats>('/stats'),
  documents: () => req<Document[]>('/documents'),

  ingestText: (filename: string, text: string, trace = false) =>
    req<Document>('/documents/text', {
      method: 'POST',
      body: JSON.stringify({ filename, text, trace }),
    }),

  upload: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return req<Document>('/documents/upload', { method: 'POST', body: form });
  },

  deleteDocument: (id: number) => req<void>(`/documents/${id}`, { method: 'DELETE' }),

  query: (body: QueryRequest) =>
    req<QueryResponse>('/query', { method: 'POST', body: JSON.stringify(body) }),

  chunkPreview: (text: string) =>
    req<ChunkPreview>('/chunk-preview', { method: 'POST', body: JSON.stringify({ text }) }),
};
