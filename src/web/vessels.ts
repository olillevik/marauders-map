import type { VesselPosition } from '../server/barentswatch.ts';

const VESSEL_POSITIONS_PATH = '/api/vessel-positions';

// Keeps one position per MMSI. If an MMSI appears more than once, the later entry wins.
export function uniqueByMmsi(positions: VesselPosition[]): VesselPosition[] {
  return [...new Map(positions.map((position) => [position.mmsi, position])).values()];
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}

// Throws an Error whose message is the short text the page shows. A failed request shows the route's own error text.
export async function fetchVesselPositions(fetchFn: typeof fetch = fetch): Promise<VesselPosition[]> {
  let res: Response;
  try {
    res = await fetchFn(VESSEL_POSITIONS_PATH);
  } catch {
    throw new Error('Could not reach the server');
  }
  const body = await readJson(res);
  if (!res.ok) {
    const error = typeof body === 'object' && body !== null && 'error' in body ? body.error : undefined;
    throw new Error(typeof error === 'string' ? error : `Request failed with status ${res.status}`);
  }
  if (!Array.isArray(body)) {
    throw new Error('Unexpected response from the server');
  }
  return body;
}
