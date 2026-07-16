/** Joins class names, dropping falsy values. Deliberately tiny — no clsx dep. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
