import createOrderHandler from './_payment/create-order.js';
import verifyHandler from './_payment/verify.js';
import statusHandler from './_payment/status.js';
import restoreHandler from './_payment/restore.js';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url, 'http://localhost');
  const routeParam = url.searchParams.get('_route') || '';
  const pathname = url.pathname;

  if (routeParam === 'create-order' || pathname.endsWith('/create-order')) {
    return createOrderHandler(req);
  }
  if (routeParam === 'verify' || pathname.endsWith('/verify')) {
    return verifyHandler(req);
  }
  if (routeParam === 'status' || pathname.endsWith('/status')) {
    return statusHandler(req);
  }
  if (routeParam === 'restore' || pathname.endsWith('/restore')) {
    return restoreHandler(req);
  }

  return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  });
}
