import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { type BarentsWatchCredentials, createBarentsWatchClient } from './barentswatch.ts';

const projectRoot = fileURLToPath(new URL('../..', import.meta.url));
const VESSEL_POSITIONS_PATH = '/api/vessel-positions';

// One HTTP server serves the page and the API routes. Vite runs in
// middleware mode and shares the server, so its HMR socket uses the same port.
export async function createApp(credentials: BarentsWatchCredentials): Promise<http.Server> {
  const server = http.createServer();
  const barentsWatch = createBarentsWatchClient(credentials);
  const vite = await createViteServer({
    root: projectRoot,
    configFile: false,
    appType: 'spa',
    server: { middlewareMode: true, hmr: { server } },
  });

  async function sendVesselPositions(res: http.ServerResponse): Promise<void> {
    try {
      const positions = await barentsWatch.latestPositions();
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(positions));
    } catch (error) {
      console.error('BarentsWatch latest positions request failed:', error);
      res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'BarentsWatch is unavailable' }));
    }
  }

  server.on('request', (req, res) => {
    if (req.method === 'GET' && new URL(req.url ?? '/', 'http://localhost').pathname === VESSEL_POSITIONS_PATH) {
      void sendVesselPositions(res);
      return;
    }
    vite.middlewares(req, res, () => {
      res.statusCode = 404;
      res.end('Not found');
    });
  });
  server.on('close', () => {
    void vite.close();
  });

  return server;
}
