import type { VercelRequest, VercelResponse } from "@vercel/node";

export function json(res: VercelResponse, status: number, body: unknown) {
  res.status(status).json(body);
}

export function bearer(req: VercelRequest): string | null {
  const header = req.headers.authorization;
  return header?.startsWith("Bearer ") ? header.slice(7) : null;
}

/**
 * Webhook signature verification needs the RAW bytes, not `req.body` (which
 * Vercel may have parsed). Consume the request stream before any JSON parsing.
 */
export async function readRawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}
