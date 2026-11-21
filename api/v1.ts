import solarEstimateHandler from './_v1/solar-estimate.js';
import subsidyCheckHandler from './_v1/subsidy-check.js';
import validateRoofHandler from './_v1/validate-roof.js';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url, 'http://localhost');
  const routeParam = url.searchParams.get('_route') || '';
  const pathname = url.pathname;

  if (routeParam === 'solar-estimate' || pathname.endsWith('/solar-estimate')) {
    return solarEstimateHandler(req);
  }
  if (routeParam === 'subsidy-check' || pathname.endsWith('/subsidy-check')) {
    return subsidyCheckHandler(req);
  }
  if (routeParam === 'validate-roof' || pathname.endsWith('/validate-roof')) {
    return validateRoofHandler(req);
  }

  return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  });
}
