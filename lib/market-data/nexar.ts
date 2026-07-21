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
let tokenRefresh: Promise<string> | null = null;
export type NexarTokenSource = 'client_credentials';
export class NexarQuotaError extends Error { readonly code='NEXAR_PART_LIMIT_EXCEEDED'; constructor(){super('Nexar product quota is temporarily unavailable.');this.name='NexarQuotaError'} }
export class NexarAuthorizationError extends Error { readonly code='NEXAR_AUTHORIZATION_FAILED'; constructor(){super('Nexar authorization is unavailable.');this.name='NexarAuthorizationError'} }
export class NexarApplicationError extends Error { readonly code='NEXAR_APPLICATION_NOT_FOUND'; constructor(){super('Nexar could not resolve the application associated with the access token.');this.name='NexarApplicationError'} }
export class NexarSchemaError extends Error { readonly code='NEXAR_GRAPHQL_SCHEMA_ERROR'; constructor(){super('Nexar rejected the product query schema.');this.name='NexarSchemaError'} }
type ResolvedNexarToken={accessToken:string;source:NexarTokenSource};
const nexarFetch=async(url:string,init:RequestInit,maxAttempts=2)=>{let last:unknown;for(let attempt=0;attempt<maxAttempts;attempt++){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);try{const response=await fetch(url,{...init,signal:controller.signal});if(response.ok||response.status<500&&response.status!==429)return response;last=new Error(`Nexar request returned ${response.status}.`)}catch(error){last=error}finally{clearTimeout(timer)}}throw last instanceof Error?last:new Error('Nexar request failed.')};

const getString = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);
const getNumber = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

async function requestNexarAccessToken() {
  const clientId = process.env.NEXAR_CLIENT_ID;
  const clientSecret = process.env.NEXAR_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Nexar product data service is not configured.');
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'supply.domain',
  });

  const response = await nexarFetch('https://identity.nexar.com/connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error('Nexar authentication is temporarily unavailable.');
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

async function getOAuthAccessToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.accessToken;
  if (!tokenRefresh) tokenRefresh = requestNexarAccessToken().finally(() => { tokenRefresh = null; });
  return tokenRefresh;
}

const hasOAuthCredentials=()=>Boolean(getString(process.env.NEXAR_CLIENT_ID)&&getString(process.env.NEXAR_CLIENT_SECRET));

async function resolveNexarAccessToken():Promise<ResolvedNexarToken>{
  return{accessToken:await getOAuthAccessToken(),source:'client_credentials'};
}

export async function getNexarAccessToken() {
  return (await resolveNexarAccessToken()).accessToken;
}

export function getNexarRuntimeTokenStatus(){
  const clientIdPresent=Boolean(getString(process.env.NEXAR_CLIENT_ID));
  const clientSecretPresent=Boolean(getString(process.env.NEXAR_CLIENT_SECRET));
  return{clientIdPresent,clientSecretPresent,tokenSource:'client_credentials' as NexarTokenSource};
}

export function resetNexarAuthenticationForTests(){tokenCache=null;tokenRefresh=null}

const nexarErrorCodes=(payload:any)=>Array.isArray(payload?.errors)?payload.errors.map((error:any)=>getString(error?.extensions?.code)||getString(error?.code)||'').filter(Boolean):[];
const nexarErrorMessages=(payload:any)=>Array.isArray(payload?.errors)?payload.errors.map((error:any)=>String(error?.message??'')):[];
const isNexarQuotaFailure=(payload:any)=>nexarErrorCodes(payload).includes('PART_LIMIT_EXCEEDED')||(Array.isArray(payload?.errors)&&payload.errors.some((error:any)=>/part limit|quota|exceeded.*limit/i.test(String(error?.message))));
const isNexarAuthFailure=(response:Response,payload:any)=>response.status===401||response.status===403||nexarErrorCodes(payload).some((code)=>code==='AuthExpiredToken'||code==='AuthInvalidToken')||(Array.isArray(payload?.errors)&&payload.errors.some((error:any)=>/auth|token|unauthor/i.test(String(error?.message))));
const isNexarApplicationFailure=(payload:any)=>nexarErrorMessages(payload).some(message=>/app fetching error:\s*not found/i.test(message));
const isNexarSchemaFailure=(payload:any)=>nexarErrorMessages(payload).some(message=>/cannot query field|unknown argument|validation error|variable .* is not defined/i.test(message));
const hasUsableGraphqlData=(payload:any)=>payload?.data!==null&&payload?.data!==undefined&&Object.values(payload.data).some(value=>value!==null&&value!==undefined);
const executeGraphql=async(token:ResolvedNexarToken,query:string,variables:Record<string,unknown>)=>{
  const response=await nexarFetch('https://api.nexar.com/graphql',{method:'POST',headers:{Authorization:`Bearer ${token.accessToken}`,'Content-Type':'application/json'},body:JSON.stringify({query,variables})},1);
  const payload=await response.json().catch(()=>({}));
  return{response,payload};
};

export async function nexarGraphqlRequest(query: string, variables: Record<string, unknown>) {
  const initialToken=await resolveNexarAccessToken();
  let {response,payload}=await executeGraphql(initialToken,query,variables);
  if(isNexarQuotaFailure(payload))throw new NexarQuotaError();
  if(isNexarAuthFailure(response,payload)){
    tokenCache=null;
    if(!hasOAuthCredentials())throw new NexarAuthorizationError();
    const oauthToken=await resolveNexarAccessToken();
    ({response,payload}=await executeGraphql(oauthToken,query,variables));
    if(isNexarQuotaFailure(payload))throw new NexarQuotaError();
    if(isNexarAuthFailure(response,payload))throw new NexarAuthorizationError();
  }
  if(isNexarApplicationFailure(payload))throw new NexarApplicationError();
  if(isNexarSchemaFailure(payload)&&!hasUsableGraphqlData(payload))throw new NexarSchemaError();
  if (!response.ok || Array.isArray(payload.errors) && payload.errors.length&&!hasUsableGraphqlData(payload)) throw new Error('Nexar product data request failed.');
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
