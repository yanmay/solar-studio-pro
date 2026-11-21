import type { IncomingMessage, ServerResponse } from 'node:http';

export type WebHandler = (req: Request) => Promise<Response> | Response;

/**
 * Adapts a Web Fetch API handler `(req: Request) => Promise<Response>` to
 * Vercel's Node.js Serverless Function signature `(req: IncomingMessage, res: ServerResponse)`.
 * Also transparently passes through direct Web `Request` calls (e.g. from unit tests).
 */
export function toNodeHandler(webHandler: WebHandler) {
  return async function vercelNodeHandler(
    req: IncomingMessage & { body?: unknown },
    res?: ServerResponse
  ): Promise<Response | void> {
    // Direct Web Request invocation (unit tests)
    if (!res && typeof (req as unknown as Request)?.headers?.get === 'function') {
      return webHandler(req as unknown as Request);
    }

    if (!res) {
      throw new Error('Missing ServerResponse in Node handler invocation');
    }

    try {
      const protoHeader = req.headers['x-forwarded-proto'];
      const proto = Array.isArray(protoHeader) ? protoHeader[0] : (protoHeader || 'https');
      const hostHeader = req.headers['x-forwarded-host'] || req.headers.host;
      const host = Array.isArray(hostHeader) ? hostHeader[0] : (hostHeader || 'localhost');
      const url = new URL(req.url || '/', `${proto}://${host}`);

      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value === undefined) continue;
        if (Array.isArray(value)) {
          for (const v of value) headers.append(key, v);
        } else {
          headers.set(key, value);
        }
      }

      const method = (req.method || 'GET').toUpperCase();
      let body: BodyInit | undefined;
      if (method !== 'GET' && method !== 'HEAD') {
        if (req.body !== undefined && req.body !== null) {
          if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) {
            body = req.body;
          } else {
            body = JSON.stringify(req.body);
          }
        } else {
          const chunks: Buffer[] = [];
          for await (const chunk of req) {
            chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
          }
          if (chunks.length > 0) {
            body = Buffer.concat(chunks);
          }
        }
      }

      const webReq = new Request(url.toString(), {
        method,
        headers,
        body,
      });

      const webRes = await webHandler(webReq);

      res.statusCode = webRes.status;
      webRes.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });

      const arrayBuf = await webRes.arrayBuffer();
      res.end(Buffer.from(arrayBuf));
    } catch (err) {
      console.error('[vercel-node] Unhandled handler error:', err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    }
  };
}
