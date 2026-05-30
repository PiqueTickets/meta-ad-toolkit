export interface MetaApiOk<T> {
  ok: true;
  data: T;
}

export interface MetaApiError {
  ok: false;
  error: {
    message: string;
    code: number;
    type: string;
    fbtrace_id?: string;
    retryable: boolean;
  };
}

export type MetaApiResult<T> = MetaApiOk<T> | MetaApiError;

const RETRYABLE_CODES = new Set([4, 17, 32, 613]);
const GRAPH_API_VERSION = "v20.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

interface MetaApiOptions {
  accessToken: string;
  accountId: string;
  fetchImpl?: typeof fetch;
}

export class MetaApi {
  private readonly accessToken: string;
  private readonly accountId: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: MetaApiOptions) {
    this.accessToken = opts.accessToken;
    this.accountId = opts.accountId;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  get accountPath(): string {
    return this.accountId.startsWith("act_") ? this.accountId : `act_${this.accountId}`;
  }

  async get<T>(path: string, fields?: string[]): Promise<MetaApiResult<T>> {
    const withFields = fields && fields.length > 0
      ? `${path}${path.includes("?") ? "&" : "?"}fields=${encodeURIComponent(fields.join(","))}`
      : path;
    const url = this.buildUrl(withFields);
    return this.dispatch<T>(url, { method: "GET" });
  }

  async post<T>(path: string, body: Record<string, unknown>): Promise<MetaApiResult<T>> {
    const url = this.buildUrl(path);
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(body)) {
      if (v === undefined || v === null) continue;
      params.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
    }
    return this.dispatch<T>(url, { method: "POST", body: params });
  }

  async postMultipart<T>(path: string, form: FormData): Promise<MetaApiResult<T>> {
    const url = this.buildUrl(path);
    return this.dispatch<T>(url, { method: "POST", body: form });
  }

  async delete<T>(path: string): Promise<MetaApiResult<T>> {
    const url = this.buildUrl(path);
    return this.dispatch<T>(url, { method: "DELETE" });
  }

  private buildUrl(path: string): string {
    const sep = path.includes("?") ? "&" : "?";
    const normalized = path.startsWith("/") ? path : `/${path}`;
    return `${GRAPH_API_BASE}${normalized}${sep}access_token=${this.accessToken}`;
  }

  private async dispatch<T>(url: string, init: RequestInit): Promise<MetaApiResult<T>> {
    const started = Date.now();
    let response: Response;
    try {
      response = await this.fetchImpl(url, init);
    } catch (e) {
      console.error(JSON.stringify({
        op: "fetch_failed",
        url: this.redactUrl(url),
        ms: Date.now() - started,
        message: (e as Error).message,
      }));
      return {
        ok: false,
        error: { message: (e as Error).message, code: -1, type: "NetworkError", retryable: true },
      };
    }

    const ms = Date.now() - started;
    const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    if (response.ok) {
      console.error(JSON.stringify({ op: "ok", url: this.redactUrl(url), status: response.status, ms }));
      return { ok: true, data: json as T };
    }

    const errBody = (json.error ?? {}) as Record<string, unknown>;
    const code = typeof errBody.code === "number" ? errBody.code : -1;
    const retryable = RETRYABLE_CODES.has(code) || response.status >= 500;
    const error = {
      message: typeof errBody.message === "string" ? errBody.message : `HTTP ${response.status}`,
      code,
      type: typeof errBody.type === "string" ? errBody.type : "Unknown",
      fbtrace_id: typeof errBody.fbtrace_id === "string" ? errBody.fbtrace_id : undefined,
      retryable,
    };
    console.error(JSON.stringify({
      op: "graph_error",
      url: this.redactUrl(url),
      status: response.status,
      ms,
      code,
      fbtrace_id: error.fbtrace_id,
    }));
    return { ok: false, error };
  }

  private redactUrl(url: string): string {
    return url.replace(/access_token=[^&]+/, "access_token=REDACTED");
  }
}
