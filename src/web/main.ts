import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Kartverket topo, layer "topo", TileMatrixSet "webmercator" (EPSG:3857).
// The browser loads these tiles directly from Kartverket's cache.
const KARTVERKET_TOPO_TILES = 'https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png';

const map = L.map('map').setView([65, 12], 5);

L.tileLayer(KARTVERKET_TOPO_TILES, {
  attribution: '<a href="https://kartverket.no">© Kartverket</a>',
}).addTo(map);

map.attributionControl.addAttribution('Data delivered by BarentsWatch');
