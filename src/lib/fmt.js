// All functions handle null / undefined / NaN / Infinity safely and return '—' for invalid input.

export function fmtCurrency(v) {
  const n = Number(v)
  if (!isFinite(n)) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

export function fmtPercent(v, decimals = 1) {
  const n = Number(v)
  if (!isFinite(n)) return '—'
  return `${n.toFixed(decimals)}%`
}

export function fmtNumber(v) {
  const n = Number(v)
  if (!isFinite(n)) return '—'
  return n.toLocaleString()
}

export function fmtBytes(b) {
  const n = Number(b)
  if (!isFinite(n) || n < 0) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}
