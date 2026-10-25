import type { AddressInfo } from 'node:net';
import { expect, it } from 'vitest';
import { createApp } from './app.ts';

// Checked against Kartverket's WMTS capabilities (GET https://cache.kartverket.no/v1/wmts/1.0.0/WMTSCapabilities.xml),
// layer "topo", TileMatrixSet "webmercator" (EPSG:3857).
const KARTVERKET_TOPO_TILES = 'https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png';

it('serves the topo map page with the Kartverket tile layer and both credits', async () => {
  const server = await createApp();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;

  try {
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
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
