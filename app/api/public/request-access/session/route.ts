import{NextResponse}from'next/server';import{currentRequestIdentity}from'../../../../../lib/public-request/access';
export async function GET(){return NextResponse.json(await currentRequestIdentity(),{headers:{'cache-control':'private, no-store'}})}
