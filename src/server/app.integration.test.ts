import { afterEach, expect, it, vi } from 'vitest';
import { fetchVesselPositions } from '../web/vessels.ts';
import { EXPECTED_POSITIONS, startApp, stopApps, stubBarentsWatch } from './test-support.ts';

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await stopApps();
});

// The browser client calls the route by its path, so the test resolves that path against the running server.
const browserFetch = (base: string) => (path: string) => fetch(`${base}${path}`);

it('the browser client reads vessel positions from the running server', async () => {
  stubBarentsWatch();
  const base = await startApp();

  await expect(fetchVesselPositions(browserFetch(base))).resolves.toEqual(EXPECTED_POSITIONS);
});

it('the browser client shows the route error text when BarentsWatch refuses the token request', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  stubBarentsWatch({ token: () => new Response('refused', { status: 401 }) });
  const base = await startApp();

  await expect(fetchVesselPositions(browserFetch(base))).rejects.toThrow('BarentsWatch is unavailable');
});
