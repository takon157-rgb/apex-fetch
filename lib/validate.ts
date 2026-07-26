export function assertString(val: unknown, maxLen = 2000): string {
  if (typeof val !== 'string' || val.length > maxLen) return '';
  return val;
}

export function assertArray(val: unknown, maxLen = 100): unknown[] {
  if (!Array.isArray(val) || val.length > maxLen) return [];
  return val;
}

export function assertNumber(val: unknown, min = 0, max = 100000): number {
  if (typeof val !== 'number' || isNaN(val) || val < min || val > max) return min;
  return val;
}

export function assertEnum<T extends string>(val: unknown, allowed: readonly T[], defaultVal: T): T {
  if (allowed.includes(val as T)) return val as T;
  return defaultVal;
}

export function sanitizeStr(val: string): string {
  return val.replace(/[<>"'&]/g, '').trim().substring(0, 2000);
}
