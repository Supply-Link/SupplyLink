// Unit tests for Api — session cookie and CSRF kept in memory,
// cookie expiry, ApiFailure messages, non-JSON and network errors.

import { Api, ApiFailure } from '../api';

function reply(status: number, body: unknown, setCookie?: string) {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (setCookie) headers.set('set-cookie', setCookie);
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers }));
}

describe('Api', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock;
  });

  it('keeps the session cookie and CSRF token in memory and bypasses the native cookie jar', async () => {
    const api = new Api('http://10.0.2.2:8000');
    fetchMock.mockReturnValueOnce(
      reply(200, { user: { id: 'u1' }, csrf: 'token-1' }, 'supplylink_session=abc123; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200'),
    );
    await api.call('POST', '/api/login', { email: 'a@b.c', password: 'x' });

    fetchMock.mockReturnValueOnce(reply(200, { ok: true }));
    await api.call('POST', '/api/orders', { items: [] }, 'key-12345');

    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe('http://10.0.2.2:8000/api/orders');
    expect(init.credentials).toBe('omit');
    expect(init.headers).toMatchObject({
      Cookie: 'supplylink_session=abc123',
      'X-CSRF-Token': 'token-1',
      'Idempotency-Key': 'key-12345',
      'Content-Type': 'application/json',
    });
  });

  it('forgets the session when the server expires the cookie', async () => {
    const api = new Api('https://example.com');
    fetchMock.mockReturnValueOnce(reply(200, { csrf: 't' }, 'supplylink_session=abc; Path=/; Max-Age=43200'));
    await api.call('POST', '/api/login', {});
    fetchMock.mockReturnValueOnce(reply(200, { ok: true }, 'supplylink_session=; HttpOnly; Path=/; Max-Age=0'));
    await api.call('POST', '/api/logout', {});
    fetchMock.mockReturnValueOnce(reply(200, {}));
    await api.call('GET', '/api/license');
    expect(fetchMock.mock.calls[2][1].headers.Cookie).toBeUndefined();
  });

  it('raises ApiFailure with the server message and payload', async () => {
    const api = new Api('https://example.com');
    fetchMock.mockReturnValueOnce(reply(423, { error: 'Licence expired', code: 'SOFTWARE_LICENSE_BLOCKED', license: { usable: false } }));
    const failure = await api.call<never>('GET', '/api/state').catch((e: ApiFailure) => e);
    expect(failure).toBeInstanceOf(ApiFailure);
    expect(failure.status).toBe(423);
    expect(failure.message).toBe('Licence expired');
    expect(failure.payload.license).toEqual({ usable: false });
  });

  it('explains non-JSON responses and network failures', async () => {
    const api = new Api('https://example.com');
    fetchMock.mockReturnValueOnce(Promise.resolve(new Response('<html>', { status: 200 })));
    await expect(api.call('GET', '/api/state')).rejects.toThrow('did not return SupplyLink JSON');
    fetchMock.mockReturnValueOnce(Promise.reject(new TypeError('Network request failed')));
    await expect(api.call('GET', '/api/state')).rejects.toThrow('Connection failed');
  });
});
