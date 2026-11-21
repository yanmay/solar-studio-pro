import { describe, it, expect } from "vitest";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { toNodeHandler } from "../../api/_utils/vercel-node";

function makeMockRes() {
  const headers: Record<string, string | string[]> = {};
  let statusCode = 200;
  let endedBody = Buffer.alloc(0);
  const res = {
    get statusCode() {
      return statusCode;
    },
    set statusCode(code: number) {
      statusCode = code;
    },
    headersSent: false,
    setHeader(name: string, value: string | string[]) {
      headers[name.toLowerCase()] = value;
    },
    end(chunk?: Buffer | string) {
      res.headersSent = true;
      if (chunk) {
        endedBody = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      }
    },
  } as unknown as ServerResponse;

  return {
    res,
    getStatus: () => statusCode,
    getHeaders: () => headers,
    getText: () => endedBody.toString("utf8"),
  };
}

describe("toNodeHandler Vercel Node.js adapter", () => {
  it("adapts Node.js GET IncomingMessage to Web Request and writes Web Response", async () => {
    const handler = toNodeHandler(async (req: Request) => {
      const url = new URL(req.url);
      return new Response(
        JSON.stringify({ q: url.searchParams.get("q"), ip: req.headers.get("x-forwarded-for") }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    const req = Object.assign(Readable.from([]), {
      method: "GET",
      url: "/api/geocode?q=Pune",
      headers: { host: "solar-studio-pro.vercel.app", "x-forwarded-for": "1.2.3.4" },
    }) as unknown as IncomingMessage;

    const mock = makeMockRes();
    await handler(req, mock.res);

    expect(mock.getStatus()).toBe(200);
    expect(mock.getHeaders()["content-type"]).toBe("application/json");
    expect(JSON.parse(mock.getText())).toEqual({ q: "Pune", ip: "1.2.3.4" });
  });

  it("adapts Node.js POST with Vercel pre-parsed req.body object", async () => {
    const handler = toNodeHandler(async (req: Request) => {
      const body = await req.json();
      return Response.json({ received: body.input });
    });

    const req = Object.assign(Readable.from([]), {
      method: "POST",
      url: "/api/places-autocomplete",
      headers: { host: "solar-studio-pro.vercel.app", "content-type": "application/json" },
      body: { input: "army institute of technology" },
    }) as unknown as IncomingMessage & { body: unknown };

    const mock = makeMockRes();
    await handler(req, mock.res);

    expect(mock.getStatus()).toBe(200);
    expect(JSON.parse(mock.getText())).toEqual({ received: "army institute of technology" });
  });
});
