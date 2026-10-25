import { expect, it, vi } from 'vitest';
import { fetchVesselPositions, uniqueByMmsi } from './vessels.ts';

const POSITIONS = [{ mmsi: 257012340, latitude: 69.6492, longitude: 18.9553 }];

it('keeps one position per MMSI and the later entry when an MMSI repeats', () => {
  const positions = [
    { mmsi: 257012340, latitude: 69.6, longitude: 18.9 },
    { mmsi: 259000002, latitude: 60.3, longitude: 5.3 },
    { mmsi: 257012340, latitude: 70.1, longitude: 19.2 },
  ];

  expect(uniqueByMmsi(positions)).toEqual([
    { mmsi: 257012340, latitude: 70.1, longitude: 19.2 },
    { mmsi: 259000002, latitude: 60.3, longitude: 5.3 },
  ]);
});

it('returns the positions the route sends', async () => {
  const fetchFn = vi.fn(async () => Response.json(POSITIONS));

  await expect(fetchVesselPositions(fetchFn)).resolves.toEqual(POSITIONS);
  expect(fetchFn).toHaveBeenCalledWith('/api/vessel-positions');
});

it('throws the short error text the route sends when the request fails', async () => {
  const fetchFn = vi.fn(async () => Response.json({ error: 'BarentsWatch is unavailable' }, { status: 502 }));

  await expect(fetchVesselPositions(fetchFn)).rejects.toThrow('BarentsWatch is unavailable');
});

it('says the server cannot be reached when the request itself fails', async () => {
  const fetchFn = vi.fn(async () => {
    throw new TypeError('fetch failed');
  });

  await expect(fetchVesselPositions(fetchFn)).rejects.toThrow('Could not reach the server');
});

it('rejects a successful response that is not a list of positions', async () => {
  const fetchFn = vi.fn(async () => Response.json({ vessels: [] }));

  await expect(fetchVesselPositions(fetchFn)).rejects.toThrow('Unexpected response from the server');
});

it('falls back to the status when a failed response has no JSON error text', async () => {
  const fetchFn = vi.fn(async () => new Response('<html>Bad Gateway</html>', { status: 502 }));

  await expect(fetchVesselPositions(fetchFn)).rejects.toThrow('Request failed with status 502');
});
