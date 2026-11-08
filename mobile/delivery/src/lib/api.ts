// Api class — fetch wrapper with in-memory session cookie, CSRF token,
// 20-second timeout, 4 MB response cap, and typed ApiFailure errors.

const SESSION_COOKIE = 'supplylink_session';
const TIMEOUT_MS = 20000;
const MAX_RESPONSE_CHARS = 4 * 1024 * 1024;

export class ApiFailure extends Error {
  constructor(
    readonly status: number,
    readonly payload: Record<string, unknown>,
  ) {
    super(typeof payload.error === 'string' ? payload.error : `Server returned ${status}`);
  }
}

/**
 * The session cookie and CSRF token live only in memory. Requests use
 * `credentials: 'omit'` so React Native's persistent native cookie jar is
 * bypassed and nothing survives an app restart.
 */
export class Api {
  private csrf = '';
  private session = '';

  constructor(public base: string) {}

  clear() {
    this.csrf = '';
    this.session = '';
  }

  async call<T>(method: 'GET' | 'POST', path: string, body?: object, idempotencyKey?: string): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (this.session) headers.Cookie = `${SESSION_COOKIE}=${this.session}`;
    if (this.csrf) headers['X-CSRF-Token'] = this.csrf;
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let response: Response;
    let text: string;
    try {
      response = await fetch(this.base + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: 'omit',
        signal: controller.signal,
      });
      this.storeSession(response.headers.get('set-cookie'));
      text = await response.text();
    } catch {
      throw new Error(
        controller.signal.aborted
          ? 'The server took too long to respond.'
          : 'Connection failed. Check the server URL and network.',
      );
    } finally {
      clearTimeout(timer);
    }

    if (text.length > MAX_RESPONSE_CHARS) throw new Error('Response is too large.');
    let result: Record<string, unknown>;
    try {
      result = JSON.parse(text);
    } catch {
      throw new Error('The server did not return SupplyLink JSON. Check the server URL.');
    }
    if (!response.ok) throw new ApiFailure(response.status, result);
    if (typeof result.csrf === 'string') this.csrf = result.csrf;
    return result as T;
  }

  private storeSession(header: string | null) {
    const match = header && new RegExp(`${SESSION_COOKIE}=([^;,]*)([^,]*)`).exec(header);
    if (!match) return;
    this.session = !match[1] || /max-age=0/i.test(match[2]) ? '' : match[1];
  }
}
