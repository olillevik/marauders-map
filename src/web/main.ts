import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { VesselPosition } from '../server/barentswatch.ts';
import { fetchVesselPositions, uniqueByMmsi } from './vessels.ts';

// Kartverket topo, layer "topo", TileMatrixSet "webmercator" (EPSG:3857).
// The browser loads these tiles directly from Kartverket's cache.
const KARTVERKET_TOPO_TILES = 'https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png';

const map = L.map('map').setView([65, 12], 5);

L.tileLayer(KARTVERKET_TOPO_TILES, {
  attribution: '<a href="https://kartverket.no">© Kartverket</a>',
}).addTo(map);

map.attributionControl.addAttribution('Data delivered by BarentsWatch');

// One plain marker per vessel, with Leaflet's default style. No popup, no label, no colour by type.
const vessels = L.layerGroup().addTo(map);

const refreshButton = document.querySelector<HTMLButtonElement>('#refresh');
const statusLine = document.querySelector<HTMLElement>('#status');
if (!refreshButton || !statusLine) {
  throw new Error('index.html is missing the refresh button or the status line');
}

const showPositions = (positions: VesselPosition[]): void => {
  vessels.clearLayers();
  for (const { latitude, longitude } of uniqueByMmsi(positions)) {
    L.circleMarker([latitude, longitude], { radius: 5 }).addTo(vessels);
  }
};

// On failure the markers already drawn stay on the map, and the page shows the error text.
const refresh = async (): Promise<void> => {
  refreshButton.disabled = true;
  try {
    showPositions(await fetchVesselPositions());
    statusLine.textContent = '';
  } catch (error) {
    statusLine.textContent = error instanceof Error ? error.message : 'Could not load vessel positions';
  } finally {
    refreshButton.disabled = false;
  }
};

refreshButton.addEventListener('click', () => void refresh());
void refresh();
