export const SOURCING_CONTEXT_COOKIE='em_homepage_sourcing';
const lifetimeSeconds=30*60;
const bytes=(value:string)=>new TextEncoder().encode(value);
const encode=(value:string)=>btoa(value).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const decode=(value:string)=>atob(value.replace(/-/g,'+').replace(/_/g,'/'));
const secret=()=>process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SMTP_PASSWORD||'';
async function signature(payload:string){const key=await crypto.subtle.importKey('raw',bytes(secret()),{name:'HMAC',hash:'SHA-256'},false,['sign']),signed=new Uint8Array(await crypto.subtle.sign('HMAC',key,bytes(payload)));return btoa(String.fromCharCode(...signed)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
export async function createSourcingContext(userId:string){const payload=encode(JSON.stringify({sub:userId,intent:'homepage_sourcing',exp:Math.floor(Date.now()/1000)+lifetimeSeconds}));return`${payload}.${await signature(payload)}`}
export async function validSourcingContext(token:string|undefined,userId:string){if(!token||!secret())return false;const[payload,supplied]=token.split('.');if(!payload||!supplied||await signature(payload)!==supplied)return false;try{const value=JSON.parse(decode(payload));return value.sub===userId&&value.intent==='homepage_sourcing'&&Number(value.exp)>Math.floor(Date.now()/1000)}catch{return false}}
export const sourcingContextCookieOptions={httpOnly:true,sameSite:'lax' as const,secure:process.env.NODE_ENV==='production',path:'/',maxAge:lifetimeSeconds};
