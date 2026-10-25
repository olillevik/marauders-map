import { createBarentsWatchClient } from '../server/barentswatch.ts';

interface Env {
  BARENTSWATCH_CLIENT_ID: string;
  BARENTSWATCH_CLIENT_SECRET: string;
}

// Secrets reach the Worker only through the handler's env, so the client is created on the first request.
// It then lives as long as the instance, and so does its cache.
let barentsWatch: ReturnType<typeof createBarentsWatchClient> | undefined;

// Only /api/* reaches this handler. The static page is served from the built assets.
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (request.method !== 'GET' || pathname !== '/api/vessel-positions') {
      return new Response('Not found', { status: 404 });
    }

    barentsWatch ??= createBarentsWatchClient({
      clientId: env.BARENTSWATCH_CLIENT_ID,
      clientSecret: env.BARENTSWATCH_CLIENT_SECRET,
    });
    try {
      return Response.json(await barentsWatch.latestPositions());
    } catch (error) {
      console.error('BarentsWatch latest positions request failed:', error);
      return Response.json({ error: 'BarentsWatch is unavailable' }, { status: 502 });
    }
  },
};
