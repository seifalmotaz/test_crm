/**
 * Format integer cents to a human-readable dollar string.
 * Examples: 45000000 → "$45M", 2500000 → "$2.5M", 500000 → "$500K", 50000 → "$50K", 500 → "$500"
 */
export function fmtCents(cents: number): string {
  if (cents >= 1_000_000) return `$${(cents / 1_000_000).toFixed(2)}M`;
  if (cents >= 1_000) return `$${(cents / 1_000).toFixed(0)}K`;
  return `$${cents.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

/**
 * Format a decimal rate (0-1) to a percentage string.
 * Example: 0.05 → "5%"
 */
export function fmtRate(rate: number | null | undefined): string {
  if (rate == null) return '—';
  return `${(rate * 100).toFixed(1)}%`;
}

/**
 * Format a date string to a short human-readable format.
 */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
