function extractMessages(body: unknown): string[] {
  if (typeof body !== 'object' || body === null) return [];
  const raw = (body as { message?: unknown }).message;
  if (typeof raw === 'string') return raw ? [raw] : [];
  if (Array.isArray(raw)) {
    return raw.filter((m): m is string => typeof m === 'string' && m !== '');
  }
  return [];
}

export class ApiError extends Error {
  readonly status: number | undefined;
  readonly messages: string[];
  readonly headers: Record<string, string>;
  readonly body: unknown;
  readonly url: string;
  readonly code: string | undefined;

  constructor(
    status: number | undefined,
    body: unknown,
    headers: Record<string, string> = {},
    fallbackMessage?: string,
    meta?: { url?: string; code?: string | undefined }
  ) {
    const messages = extractMessages(body);
    super(messages[0] ?? fallbackMessage ?? 'Request failed');
    this.name = 'ApiError';
    this.status = status;
    this.messages = messages;
    this.headers = headers;
    this.body = body;
    this.url = meta?.url ?? '';
    this.code = meta?.code;
  }

  fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const m of this.messages) {
      const field = m.split(' ')[0] ?? '';
      if (/^[a-z_]+$/.test(field)) out[field] = m;
    }
    return out;
  }

  retryAfterSeconds(): number | null {
    const raw = this.headers['retry-after'];
    if (raw === undefined || !/^\d+$/.test(raw.trim())) return null;
    const n = parseInt(raw, 10);
    return n > 0 ? n : null;
  }
}
