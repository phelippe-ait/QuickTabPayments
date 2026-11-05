/**
 * Local API runner for development.
 *
 * The Vite SPA does not execute the Vercel functions. Instead of requiring a
 * Vercel login/link just to test payments, this tiny server mounts the same
 * handlers from `api/` on http://127.0.0.1:3001. Production still uses Vercel.
 *
 * Run with: npm run dev:api
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import createPaymentIntent from "../api/create-payment-intent.js";
import stripeWebhook from "../api/webhooks/stripe.js";
import refunds from "../api/refunds.js";

const PORT = Number(process.env.API_PORT ?? 3001);
const HOST = "127.0.0.1";

type Handler = (req: never, res: never) => Promise<unknown> | unknown;

const routes: Record<string, Handler> = {
  "/api/create-payment-intent": createPaymentIntent as unknown as Handler,
  "/api/refunds": refunds as unknown as Handler,
  "/api/webhooks/stripe": stripeWebhook as unknown as Handler,
};

/** Minimal dotenv loader: local values never override exported shell values. */
function loadLocalEnv() {
  const file = path.resolve(process.cwd(), ".env.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    const value = rawValue.replace(/^(['"])(.*)\1$/, "$2");
    process.env[key] = value;
  }
}

loadLocalEnv();

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? HOST}`);
    const pathname = url.pathname.replace(/\/+$/, "") || "/";
    const handler = routes[pathname];

    if (!handler) {
      res.statusCode = 404;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ error: "not_found" }));
      return;
    }

    // Webhook signature verification consumes the raw stream inside the
    // handler, so do not pre-read/parse the body for that route.
    if (pathname !== "/api/webhooks/stripe") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const raw = Buffer.concat(chunks).toString("utf8");
      let body: unknown;
      if (raw.trim()) {
        try {
          body = JSON.parse(raw);
        } catch {
          body = raw;
        }
      }
      (req as IncomingMessage & { body?: unknown }).body = body;
    }

    const apiRes = res as ServerResponse & {
      status: (code: number) => unknown;
      json: (payload: unknown) => unknown;
    };
    apiRes.status = (code: number) => {
      res.statusCode = code;
      return apiRes;
    };
    apiRes.json = (payload: unknown) => {
      if (!res.headersSent) res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(payload));
      return apiRes;
    };

    await handler(req as never, apiRes as never);
  } catch (error) {
    console.error("Local API error:", error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ error: "local_api_error" }));
    } else {
      res.end();
    }
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Local API ready at http://${HOST}:${PORT}`);
  console.log("Routes: /api/create-payment-intent, /api/refunds, /api/webhooks/stripe");
});
