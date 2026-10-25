import type { AddressInfo } from 'node:net';
import { vi } from 'vitest';
import { createApp } from './app.ts';

// BarentsWatch endpoints. The tests stub these URLs at the fetch boundary, so they must match the client.
export const TOKEN_URL = 'https://id.barentswatch.no/connect/token';
export const LATEST_POSITIONS_URL = 'https://live.ais.barentswatch.no/v1/latest/combined';
export const TOKEN_LIFETIME_SECONDS = 3600;

export const CLIENT_ID = 'test-client-id';
export const CLIENT_SECRET = 'test-client-secret-value';

// Upstream items carry more fields than the route may return.
export const UPSTREAM_POSITIONS = [
  { mmsi: 257012340, name: 'TEST VESSEL ONE', latitude: 69.6492, longitude: 18.9553, speed: 7.2, course: 90 },
  { mmsi: 259000002, name: 'TEST VESSEL TWO', latitude: 60.3913, longitude: 5.3221, speed: 0, course: 0 },
];
export const EXPECTED_POSITIONS = [
  { mmsi: 257012340, latitude: 69.6492, longitude: 18.9553 },
  { mmsi: 259000002, latitude: 60.3913, longitude: 5.3221 },
];

const realFetch = globalThis.fetch;
const stops: Array<() => Promise<void>> = [];

// Starts the app the way the dev server does, on an ephemeral port. stopApps closes every server started here.
export async function startApp(): Promise<string> {
  const server = await createApp({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  stops.push(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  return `http://127.0.0.1:${port}`;
}

export async function stopApps(): Promise<void> {
  await Promise.all(stops.splice(0).map((stop) => stop()));
}

// Replaces the BarentsWatch endpoints. Requests to the local server pass through to the real fetch.
export function stubBarentsWatch(overrides: { token?: () => Response; positions?: () => Response } = {}) {
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
