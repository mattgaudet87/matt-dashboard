// Small helpers for consistent JSON responses and Zod-validated request bodies.
import { NextResponse } from "next/server";
import type { z } from "zod";

export function jsonOk(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonError(message: string, status = 400, extra?: unknown) {
  return NextResponse.json({ error: message, ...(extra ? { details: extra } : {}) }, { status });
}

type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse };

// Read + Zod-validate a JSON request body. On failure returns a ready-to-send
// 400 response so routes can early-return.
export async function parseBody<T>(
  req: Request,
  schema: z.ZodType<T>,
): Promise<ParseResult<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { ok: false, response: jsonError("Invalid or empty JSON body", 400) };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: jsonError("Validation failed", 400, parsed.error.flatten()),
    };
  }
  return { ok: true, data: parsed.data };
}
