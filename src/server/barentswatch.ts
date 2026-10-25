// Endpoints as documented by BarentsWatch. The client secret is sent only to the token endpoint.
export const TOKEN_URL = 'https://id.barentswatch.no/connect/token';
export const LATEST_POSITIONS_URL = 'https://live.ais.barentswatch.no/v1/latest/combined';

// The latest positions are reused for this long after a successful fetch.
export const LATEST_POSITIONS_TTL_MS = 10 * 60 * 1000;

export interface BarentsWatchCredentials {
  clientId: string;
  clientSecret: string;
}

export interface VesselPosition {
  mmsi: number;
  latitude: number;
  longitude: number;
}

interface CachedToken {
  value: string;
  expiresAt: number;
}

interface CachedPositions {
  value: VesselPosition[];
  expiresAt: number;
}

export function createBarentsWatchClient(credentials: BarentsWatchCredentials) {
  let cached: CachedToken | undefined;
  let inFlight: Promise<string> | undefined;
  let cachedPositions: CachedPositions | undefined;
  let positionsInFlight: Promise<VesselPosition[]> | undefined;

  async function accessToken(): Promise<string> {
    if (cached && Date.now() < cached.expiresAt) {
      return cached.value;
    }

    // Concurrent callers share one request. finally clears it on success and on failure, so a failed request is retried.
    inFlight ??= fetchToken().finally(() => {
      inFlight = undefined;
    });
    return inFlight;
  }

  async function fetchToken(): Promise<string> {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        scope: 'ais',
      }),
    });
    if (!res.ok) {
      await res.body?.cancel();
      throw new Error(`BarentsWatch token request failed with status ${res.status}`);
    }

    const token = (await res.json()) as { access_token: string; expires_in: number };
    cached = { value: token.access_token, expiresAt: Date.now() + token.expires_in * 1000 };
    return cached.value;
  }

  async function fetchLatestPositions(): Promise<VesselPosition[]> {
    const res = await fetch(LATEST_POSITIONS_URL, {
      headers: { authorization: `Bearer ${await accessToken()}` },
    });
    if (!res.ok) {
      await res.body?.cancel();
      throw new Error(`BarentsWatch latest positions request failed with status ${res.status}`);
    }

    const items: unknown = await res.json();
    if (!Array.isArray(items)) {
      throw new Error('BarentsWatch latest positions response is not an array');
    }
    const value = items.map(toVesselPosition);
    cachedPositions = { value, expiresAt: Date.now() + LATEST_POSITIONS_TTL_MS };
    return value;
  }

  return {
    async latestPositions(): Promise<VesselPosition[]> {
      if (cachedPositions && Date.now() < cachedPositions.expiresAt) {
        return cachedPositions.value;
      }

      // Concurrent callers share one request. finally clears it on success and on failure, so a failed request is retried.
      // An expired copy is never served, even when the refresh fails.
      positionsInFlight ??= fetchLatestPositions().finally(() => {
        positionsInFlight = undefined;
      });
      return positionsInFlight;
    },
  };
}

// Keeps only the three fields the page needs. Upstream items carry more.
function toVesselPosition(item: unknown): VesselPosition {
  const { mmsi, latitude, longitude } = item as Record<string, unknown>;
  if (typeof mmsi !== 'number' || typeof latitude !== 'number' || typeof longitude !== 'number') {
    throw new Error('BarentsWatch latest positions item has an unexpected shape');
  }
  return { mmsi, latitude, longitude };
}
