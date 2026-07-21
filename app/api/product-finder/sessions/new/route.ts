export async function POST() {
  return new Response('Product Finder sessions are disabled. Send the message directly to /api/product-finder/sessions.', {
    status: 410,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'private, no-store' },
  });
}
