/**
 * Format dates for UI; bad DB rows / epoch confusion / invalid ISO → "N/A".
 * (e.g. approved_date showing as 25/11/1922)
 */
export function formatSafeDateTime(
  value: string | number | Date | undefined | null,
  locale?: Intl.LocalesArgument,
  options?: Intl.DateTimeFormatOptions
): string {
  if (value == null) return "N/A"
  if (typeof value === "string" && value.trim() === "") return "N/A"
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return "N/A"
  const y = d.getFullYear()
  if (y < 1970) return "N/A"
  return d.toLocaleString(locale, options)
}

export function formatSafeDate(
  value: string | number | Date | undefined | null,
  locale?: Intl.LocalesArgument,
  options?: Intl.DateTimeFormatOptions
): string {
  if (value == null) return "N/A"
  if (typeof value === "string" && value.trim() === "") return "N/A"
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return "N/A"
  const y = d.getFullYear()
  if (y < 1970) return "N/A"
  return d.toLocaleDateString(locale, options)
}
