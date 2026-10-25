import type { AddressInfo } from 'node:net';
import { afterEach, expect, it, vi } from 'vitest';
import { createApp } from './app.ts';

// Checked against Kartverket's WMTS capabilities (GET https://cache.kartverket.no/v1/wmts/1.0.0/WMTSCapabilities.xml),
// layer "topo", TileMatrixSet "webmercator" (EPSG:3857).
const KARTVERKET_TOPO_TILES = 'https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png';

// BarentsWatch endpoints. The tests stub these URLs at the fetch boundary, so they must match the client.
const TOKEN_URL = 'https://id.barentswatch.no/connect/token';
const LATEST_POSITIONS_URL = 'https://live.ais.barentswatch.no/v1/latest/combined';
const TOKEN_LIFETIME_SECONDS = 3600;

const CLIENT_ID = 'test-client-id';
const CLIENT_SECRET = 'test-client-secret-value';
const START_TIME = Date.parse('2026-10-25T10:00:00Z');

// Upstream items carry more fields than the route may return.
const UPSTREAM_POSITIONS = [
  { mmsi: 257012340, name: 'TEST VESSEL ONE', latitude: 69.6492, longitude: 18.9553, speed: 7.2, course: 90 },
  { mmsi: 259000002, name: 'TEST VESSEL TWO', latitude: 60.3913, longitude: 5.3221, speed: 0, course: 0 },
];
const EXPECTED_POSITIONS = [
  { mmsi: 257012340, latitude: 69.6492, longitude: 18.9553 },
  { mmsi: 259000002, latitude: 60.3913, longitude: 5.3221 },
];

const realFetch = globalThis.fetch;
const stops: Array<() => Promise<void>> = [];

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await Promise.all(stops.splice(0).map((stop) => stop()));
});

async function startApp(): Promise<string> {
  const server = await createApp({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  stops.push(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  return `http://127.0.0.1:${port}`;
}

// Replaces the BarentsWatch endpoints. Requests to the local server pass through to the real fetch.
function stubBarentsWatch(overrides: { token?: () => Response; positions?: () => Response } = {}) {
  let tokenRequests = 0;
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    if (url === TOKEN_URL) {
      tokenRequests += 1;
      if (overrides.token) return overrides.token();
      return Response.json({ access_token: `token-${tokenRequests}`, token_type: 'Bearer', expires_in: TOKEN_LIFETIME_SECONDS });
    }
    if (url === LATEST_POSITIONS_URL) {
      if (overrides.positions) return overrides.positions();
      return Response.json(UPSTREAM_POSITIONS);
    }
    return realFetch(input, init);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

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
  expect(body.get('client_id')).toBe(CLIENT_ID);
  expect(body.get('client_secret')).toBe(CLIENT_SECRET);
  expect(body.get('scope')).toBe('ais');
});

it('reuses the token within its lifetime', async () => {
  const fetchMock = stubBarentsWatch();
  const base = await startApp();

  const first = await fetch(`${base}/api/vessel-positions`);
  const second = await fetch(`${base}/api/vessel-positions`);

  expect(first.status).toBe(200);
  expect(second.status).toBe(200);
  expect(callsTo(fetchMock, TOKEN_URL)).toHaveLength(1);
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
