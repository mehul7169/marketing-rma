/**
 * Serialize unknown thrown values (Error, PostgREST/Supabase error objects,
 * Responses) into a human-readable string. Avoids `[object Object]` from
 * string-concatenation of plain error objects.
 */
export function formatUnknownError(err: unknown): string {
  if (err == null) return "unknown error";
  if (typeof err === "string") return err;

  if (err instanceof Error) {
    const extra = err as Error & {
      code?: unknown;
      details?: unknown;
      hint?: unknown;
      status?: unknown;
      statusCode?: unknown;
    };
    return joinParts({
      message: extra.message,
      code: extra.code,
      details: extra.details,
      hint: extra.hint,
      status: extra.status ?? extra.statusCode
    });
  }

  if (typeof err === "object") {
    const o = err as Record<string, unknown>;

    // Fetch Response-like
    if (typeof o.status === "number" && typeof o.statusText === "string") {
      return joinParts({
        message: o.statusText,
        status: o.status,
        details: typeof o.url === "string" ? o.url : undefined
      });
    }

    // PostgREST / Supabase client error shape: { message, code, details, hint }
    if (
      "message" in o ||
      "code" in o ||
      "details" in o ||
      "hint" in o ||
      "error" in o
    ) {
      return joinParts({
        message: o.message ?? o.error,
        code: o.code,
        details: o.details,
        hint: o.hint,
        status: o.status ?? o.statusCode
      });
    }

    try {
      return JSON.stringify(o);
    } catch {
      return Object.prototype.toString.call(err);
    }
  }

  return String(err);
}

function joinParts(parts: {
  message?: unknown;
  code?: unknown;
  details?: unknown;
  hint?: unknown;
  status?: unknown;
}): string {
  const out: string[] = [];
  if (parts.message != null && String(parts.message).length) {
    out.push(String(parts.message));
  }
  if (parts.code != null && String(parts.code).length) {
    out.push(`code=${String(parts.code)}`);
  }
  if (parts.status != null && String(parts.status).length) {
    out.push(`status=${String(parts.status)}`);
  }
  if (parts.details != null && String(parts.details).length) {
    out.push(`details=${String(parts.details)}`);
  }
  if (parts.hint != null && String(parts.hint).length) {
    out.push(`hint=${String(parts.hint)}`);
  }
  return out.length ? out.join(" | ") : "unknown error";
}
