export type RetryOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  label?: string;
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 1000;
  const label = options.label ?? "request";

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) break;

      const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `${label}: attempt ${attempt}/${maxAttempts} failed (${message}). Retrying in ${delayMs}ms…`
      );
      await sleep(delayMs);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`${label}: failed after ${maxAttempts} attempts`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
