import { logger } from './logger.js';

const MAX_RETRIES = 7;
const BASE_DELAY_MS = 1_000;

interface RateLimitError {
  status?: number;
  retryAfter?: number;
  message?: string;
}

export async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  retries = 0
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const e = err as RateLimitError;
    if (e.status === 429 && retries < MAX_RETRIES) {
      const retryAfter = (e.retryAfter ?? 1);
      const delay = Math.max(retryAfter * 1_000, BASE_DELAY_MS * 2 ** retries);
      logger.warn(`[${label}] 429 rate limit — retry ${retries + 1}/${MAX_RETRIES} in ${delay}ms`);
      await sleep(delay);
      return withRetry(label, fn, retries + 1);
    }
    if (e.status === 403) {
      logger.warn(`[${label}] 403 Forbidden — canal ignoré`);
      throw err;
    }
    if (e.status === 50001) {
      logger.warn(`[${label}] Missing Access — canal ignoré`);
      throw err;
    }
    throw err;
  }
}

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
