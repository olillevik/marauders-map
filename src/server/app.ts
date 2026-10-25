import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';

const projectRoot = fileURLToPath(new URL('../..', import.meta.url));

// One HTTP server serves the page now and the API routes later. Vite runs in
// middleware mode and shares the server, so its HMR socket uses the same port.
export async function createApp(): Promise<http.Server> {
  const server = http.createServer();
  const vite = await createViteServer({
    root: projectRoot,
    configFile: false,
    appType: 'spa',
    server: { middlewareMode: true, hmr: { server } },
  });

  server.on('request', (req, res) => {
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
