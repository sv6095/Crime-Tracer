// src/lib/utils.ts

/**
 * Basic classnames combiner.
 * Example:
 *   cn("px-4", condition && "bg-red-500")
 */
export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

/**
 * Format a date string or Date into a human-friendly timestamp.
 * If parsing fails, returns the original input as string.
 */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "";
  try {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString();
  } catch {
    return String(value);
  }
}

/**
 * Safely parse JSON with a default fallback.
 */
export function safeJsonParse<T = any>(
  value: string | null | undefined,
  fallback: T
): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
