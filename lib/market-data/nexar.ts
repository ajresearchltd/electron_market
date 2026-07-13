type NexarTokenCache = {
  accessToken: string;
  expiresAt: number;
};

export type NexarOffer = {
  seller: string | null;
  available_quantity: number | null;
  unit_price: number | null;
  currency: string | null;
  lead_time_days: number | null;
  product_url: string | null;
  raw_offer_json?: unknown;
};

export type NexarSearchResult = {
  part_number: string;
  manufacturer: string | null;
  description: string | null;
  datasheet_url: string | null;
  octopart_url: string | null;
  source_url: string | null;
  offers: NexarOffer[];
  raw_response_json: unknown;
};

let tokenCache: NexarTokenCache | null = null;

const getString = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);
const getNumber = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

export async function getNexarAccessToken() {
  const clientId = process.env.NEXAR_CLIENT_ID;
  const clientSecret = process.env.NEXAR_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Nexar API credentials are not configured. Please set NEXAR_CLIENT_ID and NEXAR_CLIENT_SECRET.');
  }

  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.accessToken;
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'supply.domain',
  });

  const response = await fetch('https://identity.nexar.com/connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error_description || payload.error || 'Nexar access token request failed.');
  }

  const accessToken = getString(payload.access_token);
  if (!accessToken) throw new Error('Nexar access token response did not include an access token.');

  const expiresIn = Number(payload.expires_in || 3600);
  tokenCache = {
    accessToken,
    expiresAt: Date.now() + Math.max(60, expiresIn - 60) * 1000,
  };

  return accessToken;
}

export async function nexarGraphqlRequest(query: string, variables: Record<string, unknown>) {
  const accessToken = await getNexarAccessToken();
  const response = await fetch('https://api.nexar.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || payload.message || 'Nexar GraphQL request failed.');
  }
  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    const message = payload.errors.map((error: any) => error?.message).filter(Boolean).join('; ');
    throw new Error(message || 'Nexar GraphQL returned errors.');
  }
  return payload.data;
}

const getFirstPrice = (offer: any) => {
  const prices = Array.isArray(offer?.prices) ? offer.prices : [];
  const firstPrice = prices.find((price: any) => price?.price || price?.convertedPrice || price?.amount);
  return {
    price: getNumber(firstPrice?.price ?? firstPrice?.convertedPrice ?? firstPrice?.amount),
    currency: getString(firstPrice?.currency ?? firstPrice?.convertedCurrency) || 'USD',
  };
};

const getLeadTimeDays = (offer: any) => {
  const leadTime = offer?.factoryLeadDays ?? offer?.leadTimeDays ?? offer?.leadTime;
  if (typeof leadTime === 'number') return leadTime;
  if (typeof leadTime === 'string') {
    const match = leadTime.match(/\d+/);
    return match ? Number(match[0]) : null;
  }
  return null;
};

const normalizePart = (part: any, requestedPartNumber: string, rawResponse: unknown): NexarSearchResult => {
  const sellers = Array.isArray(part?.sellers) ? part.sellers : [];
  const offers = sellers.flatMap((seller: any) => {
    const sellerName = getString(seller?.company?.name ?? seller?.name);
    const sellerOffers = Array.isArray(seller?.offers) ? seller.offers : [];
    return sellerOffers.map((offer: any) => {
      const price = getFirstPrice(offer);
      return {
        seller: sellerName,
        available_quantity: getNumber(offer?.inventoryLevel ?? offer?.moq ?? offer?.packaging?.minimumOrderQuantity),
        unit_price: price.price,
        currency: price.currency,
        lead_time_days: getLeadTimeDays(offer),
        product_url: getString(offer?.clickUrl ?? offer?.productUrl ?? offer?.url),
        raw_offer_json: offer,
      };
    });
  });

  const description = getString(part?.shortDescription)
    || getString(part?.description)
    || getString(Array.isArray(part?.descriptions) ? part.descriptions[0]?.text : null);

  const sourceUrl = getString(part?.octopartUrl ?? part?.referenceUrl ?? part?.url);

  return {
    part_number: getString(part?.mpn) || requestedPartNumber,
    manufacturer: getString(part?.manufacturer?.name ?? part?.manufacturer),
    description,
    datasheet_url: getString(part?.bestDatasheet?.url ?? part?.datasheetUrl),
    octopart_url: sourceUrl,
    source_url: sourceUrl,
    offers,
    raw_response_json: rawResponse,
  };
};

export async function searchNexarByPartNumber(partNumber: string): Promise<NexarSearchResult> {
  const normalizedPartNumber = partNumber.trim();
  if (!normalizedPartNumber) throw new Error('Part number is required.');

  const richQuery = `
    query SearchPart($mpn: String!) {
      supSearchMpn(q: $mpn, limit: 1) {
        results {
          part {
            mpn
            shortDescription
            descriptions {
              text
            }
            manufacturer {
              name
            }
            bestDatasheet {
              url
            }
            octopartUrl
            sellers {
              company {
                name
              }
              offers {
                inventoryLevel
                factoryLeadDays
                clickUrl
                prices {
                  quantity
                  price
                  currency
                }
              }
            }
          }
        }
      }
    }
  `;

  try {
    const data = await nexarGraphqlRequest(richQuery, { mpn: normalizedPartNumber });
    const part = data?.supSearchMpn?.results?.[0]?.part;
    return normalizePart(part ?? {}, normalizedPartNumber, data);
  } catch (error) {
    const fallbackQuery = `
      query SearchPart($mpn: String!) {
        supSearchMpn(q: $mpn, limit: 1) {
          results {
            part {
              mpn
              shortDescription
              manufacturer {
                name
              }
              bestDatasheet {
                url
              }
            }
          }
        }
      }
    `;
    const data = await nexarGraphqlRequest(fallbackQuery, { mpn: normalizedPartNumber });
    const part = data?.supSearchMpn?.results?.[0]?.part;
    return normalizePart(part ?? {}, normalizedPartNumber, {
      fallback_reason: error instanceof Error ? error.message : 'Rich Nexar query failed.',
      data,
    });
  }
}
