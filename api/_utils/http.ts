/**
 * HTTP response utilities
 */

import type { ServerResponse } from 'http';

export function sendJSON(res: ServerResponse, data: any, status: number = 200): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

export function sendError(res: ServerResponse, message: string, status: number = 400): void {
  sendJSON(res, { error: message }, status);
}
