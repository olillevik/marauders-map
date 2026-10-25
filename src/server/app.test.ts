import { afterEach, expect, it, vi } from 'vitest';
import { LATEST_POSITIONS_TTL_MS, LATEST_POSITIONS_URL, TOKEN_URL } from './barentswatch.ts';
import {
  CLIENT_SECRET,
  EXPECTED_POSITIONS,
  TOKEN_LIFETIME_SECONDS,
  startApp,
  stopApps,
  stubBarentsWatch,
} from './test-support.ts';

// Checked against Kartverket's WMTS capabilities (GET https://cache.kartverket.no/v1/wmts/1.0.0/WMTSCapabilities.xml),
// layer "topo", TileMatrixSet "webmercator" (EPSG:3857).
const KARTVERKET_TOPO_TILES = 'https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png';

const START_TIME = Date.parse('2026-10-25T10:00:00Z');

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await stopApps();
});

function callsTo(fetchMock: ReturnType<typeof stubBarentsWatch>, url: string) {
  return fetchMock.mock.calls.filter(([input]) => String(input) === url);
}

it('serves the topo map page with the Kartverket tile layer and both credits', async () => {
  const base = await startApp();

  const page = await fetch(`${base}/`);
  expect(page.status).toBe(200);
  expect(page.headers.get('content-type')).toContain('text/html');
  expect(await page.text()).toContain('<div id="map"></div>');

  const script = await fetch(`${base}/src/web/main.ts`);
  expect(script.status).toBe(200);
  const source = await script.text();
  expect(source).toContain(KARTVERKET_TOPO_TILES);
  expect(source).toContain('Data delivered by BarentsWatch');
  expect(source).toContain('© Kartverket');
  expect(source).toContain('https://kartverket.no');
});

it('returns only mmsi, latitude and longitude for each vessel', async () => {
  stubBarentsWatch();
  const base = await startApp();

  const res = await fetch(`${base}/api/vessel-positions`);

  expect(res.status).toBe(200);
  expect(await res.json()).toEqual(EXPECTED_POSITIONS);
});

it('requests a token with the client ID, client secret and ais scope', async () => {
  const fetchMock = stubBarentsWatch();
  const base = await startApp();

  await fetch(`${base}/api/vessel-positions`);

  const [tokenCall] = callsTo(fetchMock, TOKEN_URL);
  const body = new URLSearchParams(String(tokenCall[1]?.body));
  expect(tokenCall[1]?.method).toBe('POST');
  expect(body.get('grant_type')).toBe('client_credentials');
  expect(body.get('client_id')).toBe('test-client-id');
  expect(body.get('client_secret')).toBe(CLIENT_SECRET);
  expect(body.get('scope')).toBe('ais');
});

it('reuses the token within its lifetime', async () => {
  const now = vi.spyOn(Date, 'now').mockReturnValue(START_TIME);
  const fetchMock = stubBarentsWatch();
  const base = await startApp();

  const first = await fetch(`${base}/api/vessel-positions`);
  // Past the positions window but inside the token lifetime, so only the positions are fetched again.
  now.mockReturnValue(START_TIME + LATEST_POSITIONS_TTL_MS);
  const second = await fetch(`${base}/api/vessel-positions`);

  expect(first.status).toBe(200);
  expect(second.status).toBe(200);
  expect(callsTo(fetchMock, TOKEN_URL)).toHaveLength(1);
  expect(callsTo(fetchMock, LATEST_POSITIONS_URL)).toHaveLength(2);
});

it('shares one token request between concurrent first requests', async () => {
  // Delays the token response so both requests start before it arrives.
  const fetchMock = stubBarentsWatch({
    token: async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return Response.json({ access_token: 'token-1', token_type: 'Bearer', expires_in: TOKEN_LIFETIME_SECONDS });
    },
  });
  const base = await startApp();

  const [first, second] = await Promise.all([fetch(`${base}/api/vessel-positions`), fetch(`${base}/api/vessel-positions`)]);

  expect(first.status).toBe(200);
  expect(second.status).toBe(200);
  expect(callsTo(fetchMock, TOKEN_URL)).toHaveLength(1);
});

it('retries the token request after BarentsWatch refuses one', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  let tokenRequests = 0;
  const fetchMock = stubBarentsWatch({
    token: () => {
      tokenRequests += 1;
      if (tokenRequests === 1) return new Response('refused', { status: 503 });
      return Response.json({ access_token: 'token-2', token_type: 'Bearer', expires_in: TOKEN_LIFETIME_SECONDS });
    },
  });
  const base = await startApp();

  const refused = await fetch(`${base}/api/vessel-positions`);
  const retried = await fetch(`${base}/api/vessel-positions`);

  expect(refused.status).toBe(502);
  expect(retried.status).toBe(200);
  expect(callsTo(fetchMock, TOKEN_URL)).toHaveLength(2);
});

it('fetches a new token after the first one expires', async () => {
  const now = vi.spyOn(Date, 'now').mockReturnValue(START_TIME);
  const fetchMock = stubBarentsWatch();
  const base = await startApp();

  await fetch(`${base}/api/vessel-positions`);
  now.mockReturnValue(START_TIME + (TOKEN_LIFETIME_SECONDS + 1) * 1000);
  const res = await fetch(`${base}/api/vessel-positions`);

  expect(res.status).toBe(200);
  expect(callsTo(fetchMock, TOKEN_URL)).toHaveLength(2);
  const [, lastInit] = callsTo(fetchMock, LATEST_POSITIONS_URL).at(-1) ?? [];
  expect(new Headers(lastInit?.headers).get('authorization')).toBe('Bearer token-2');
});

it('answers repeat requests within 10 minutes from the cache', async () => {
  const now = vi.spyOn(Date, 'now').mockReturnValue(START_TIME);
  const fetchMock = stubBarentsWatch();
  const base = await startApp();

  const first = await fetch(`${base}/api/vessel-positions`);
  now.mockReturnValue(START_TIME + LATEST_POSITIONS_TTL_MS - 1000);
  const second = await fetch(`${base}/api/vessel-positions`);

  expect(first.status).toBe(200);
  expect(await second.json()).toEqual(EXPECTED_POSITIONS);
  expect(callsTo(fetchMock, LATEST_POSITIONS_URL)).toHaveLength(1);
});

it('fetches the latest positions again once 10 minutes have passed', async () => {
  const now = vi.spyOn(Date, 'now').mockReturnValue(START_TIME);
  const fetchMock = stubBarentsWatch();
  const base = await startApp();

  await fetch(`${base}/api/vessel-positions`);
  now.mockReturnValue(START_TIME + LATEST_POSITIONS_TTL_MS);
  const res = await fetch(`${base}/api/vessel-positions`);

  expect(res.status).toBe(200);
  expect(callsTo(fetchMock, LATEST_POSITIONS_URL)).toHaveLength(2);
});

it('does not cache a failed latest positions request', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  let positionRequests = 0;
  const fetchMock = stubBarentsWatch({
    positions: () => {
      positionRequests += 1;
      if (positionRequests === 1) return new Response('unavailable', { status: 503 });
      return Response.json(EXPECTED_POSITIONS);
    },
  });
  const base = await startApp();

  const failed = await fetch(`${base}/api/vessel-positions`);
  const retried = await fetch(`${base}/api/vessel-positions`);

  expect(failed.status).toBe(502);
  expect(retried.status).toBe(200);
  expect(callsTo(fetchMock, LATEST_POSITIONS_URL)).toHaveLength(2);
});

it('shares one latest positions request between concurrent requests', async () => {
  // Delays the positions response so both requests start before it arrives.
  const fetchMock = stubBarentsWatch({
    positions: async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return Response.json(EXPECTED_POSITIONS);
    },
  });
  const base = await startApp();

  const [first, second] = await Promise.all([fetch(`${base}/api/vessel-positions`), fetch(`${base}/api/vessel-positions`)]);

  expect(first.status).toBe(200);
  expect(second.status).toBe(200);
  expect(callsTo(fetchMock, LATEST_POSITIONS_URL)).toHaveLength(1);
});

it('responds 502 when BarentsWatch refuses the token request', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  stubBarentsWatch({
    token: () => new Response(JSON.stringify({ error: 'invalid_client' }), { status: 401 }),
  });
  const base = await startApp();

  const res = await fetch(`${base}/api/vessel-positions`);

  expect(res.status).toBe(502);
  const text = await res.text();
  expect(text).not.toContain('invalid_client');
  expect(JSON.parse(text)).toEqual({ error: 'BarentsWatch is unavailable' });
});

it('responds 502 when BarentsWatch cannot be reached', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  stubBarentsWatch({
    token: () => {
      throw new TypeError('fetch failed');
    },
  });
  const base = await startApp();

  const res = await fetch(`${base}/api/vessel-positions`);

  expect(res.status).toBe(502);
  expect(await res.json()).toEqual({ error: 'BarentsWatch is unavailable' });
});

it('responds 502 when the latest positions are not in the expected shape', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  stubBarentsWatch({ positions: () => Response.json({ vessels: [] }) });
  const base = await startApp();

  const res = await fetch(`${base}/api/vessel-positions`);

  expect(res.status).toBe(502);
});

it('never returns the client secret in a successful response', async () => {
  stubBarentsWatch();
  const base = await startApp();

  const res = await fetch(`${base}/api/vessel-positions`);

  expect(res.status).toBe(200);
  const text = await res.text();
  expect(JSON.parse(text)).toEqual(EXPECTED_POSITIONS);
  expect(text).not.toContain(CLIENT_SECRET);
});

it('never returns or logs the client secret when the request fails', async () => {
  const logSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  // An upstream that echoes the secret back in its refusal is the worst case the route must withstand.
  stubBarentsWatch({
    token: () => new Response(`refused for ${CLIENT_SECRET}`, { status: 401 }),
  });
  const base = await startApp();

  const res = await fetch(`${base}/api/vessel-positions`);

  expect(res.status).toBe(502);
  expect(await res.text()).not.toContain(CLIENT_SECRET);
  expect(JSON.stringify(logSpy.mock.calls)).not.toContain(CLIENT_SECRET);
});
