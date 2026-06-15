export const config = {
  runtime: 'edge',
};

// Helper to parse cookies from header
function getCookie(cookieHeader: string, name: string): string | null {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';');
  for (let cookie of cookies) {
    const [cName, cVal] = cookie.trim().split('=');
    if (cName === name) return decodeURIComponent(cVal);
  }
  return null;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { searchParams } = new URL(req.url);
  const scanId = searchParams.get('scanId') || 'default';
  
  const cookieHeader = req.headers.get('cookie') || '';
  const cookieName = `scan_unlocked_${scanId}`;
  const isUnlocked = getCookie(cookieHeader, cookieName) === 'true';

  return new Response(JSON.stringify({ unlocked: isUnlocked }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
