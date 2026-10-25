import { expect, it } from 'vitest';
import { createBarentsWatchClient } from './barentswatch.ts';

// The only test that calls the real BarentsWatch API. It makes one latestPositions call through the real client.
// That call first requests a token, because the client starts with no cached token, so one run sends two HTTP requests.
// Missing credentials fail the test rather than skip it, so the pre-commit run cannot pass without the real check.
it('reads the latest positions from the real BarentsWatch API', async () => {
  const clientId = process.env.BARENTSWATCH_CLIENT_ID;
  const clientSecret = process.env.BARENTSWATCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('BARENTSWATCH_CLIENT_ID and BARENTSWATCH_CLIENT_SECRET must both be set to run the smoketest');
  }

  const positions = await createBarentsWatchClient({ clientId, clientSecret }).latestPositions();

  expect(Array.isArray(positions)).toBe(true);
});
