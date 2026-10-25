// Endpoints as documented by BarentsWatch. The client secret is sent only to the token endpoint.
const TOKEN_URL = 'https://id.barentswatch.no/connect/token';
const LATEST_POSITIONS_URL = 'https://live.ais.barentswatch.no/v1/latest/combined';

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

export function createBarentsWatchClient(credentials: BarentsWatchCredentials) {
  let cached: CachedToken | undefined;

  async function accessToken(): Promise<string> {
    if (cached && Date.now() < cached.expiresAt) {
      return cached.value;
    }

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

  return {
    async latestPositions(): Promise<VesselPosition[]> {
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
      return items.map(toVesselPosition);
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
