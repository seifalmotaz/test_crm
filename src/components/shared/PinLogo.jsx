/**
 * PIN CRM shield mark — hexagonal red frame, dark inner, angular P-pin.
 * Matches the brand identity: bold boxy P with map-pin tail.
 */
export default function PinLogo({ size = 40, className = '' }) {
  const g1 = `plo-${size}`
  const g2 = `pli-${size}`
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id={g1} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#FF4542" />
          <stop offset="100%" stopColor="#BA1A1A" />
        </linearGradient>
        <linearGradient id={g2} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%"   stopColor="#182030" />
          <stop offset="100%" stopColor="#0B1320" />
        </linearGradient>
      </defs>

      {/* ── Outer shield frame (red, pointed bottom) ── */}
      <path d="M32 3 L56 16 L56 50 L32 62 L8 50 L8 16 Z" fill={`url(#${g1})`} />

      {/* ── Inner shield (dark, flat bottom so P-pin has room) ── */}
      <path d="M32 10 L50 20 L50 47 L40 58 L24 58 L14 47 L14 20 Z" fill={`url(#${g2})`} />

      {/* ── P letterform — angular/boxy, brand style ── */}

      {/* Stem (left vertical bar — runs full P height + pin tail base) */}
      <rect x="18" y="25" width="10" height="25" fill="#E53935" />

      {/* Top bar (horizontal, connects stem to right side) */}
      <rect x="28" y="25" width="19" height="5" fill="#E53935" />

      {/* Right vertical (outer right edge of P bowl) */}
      <rect x="42" y="25" width="5" height="20" fill="#E53935" />

      {/* Bottom bar (closes the P bowl at mid-height) */}
      <rect x="28" y="40" width="19" height="5" fill="#E53935" />

      {/* Counter — dark cutout inside P bowl */}
      <rect x="28" y="30" width="14" height="10" fill="#0B1320" />

      {/* Pin tail — stem tapers to point below bowl */}
      <polygon points="18,50 23,56 28,50" fill="#E53935" />
    </svg>
  )
}

/**
 * Full sidebar wordmark: shield icon + "pin" text + CRM + by Triple Shield.
 */
export function PinWordmark({ iconSize = 42, className = '' }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <PinLogo size={iconSize} />

      <div className="flex flex-col leading-none select-none">
        {/* "pin" — white bold, red diamond replaces i-dot */}
        <div className="relative inline-block">
          <span
            className="font-extrabold text-white"
            style={{
              fontSize: 20,
              fontFamily: "'Sora', sans-serif",
              lineHeight: 1,
              letterSpacing: '-0.02em',
            }}
          >
            pin
          </span>
          <span
            className="absolute"
            style={{
              width: 5, height: 5,
              background: '#E53935',
              transform: 'rotate(45deg)',
              borderRadius: 1,
              top: 0,
              left: '0.62em',
            }}
          />
        </div>

        {/* — CRM — */}
        <div className="flex items-center gap-1.5 mt-[5px]">
          <span style={{ height: 1.5, width: 8, background: '#E53935', display: 'block' }} />
          <span
            className="font-bold"
            style={{
              fontSize: 8,
              color: '#E53935',
              fontFamily: "'Sora', sans-serif",
              letterSpacing: '0.28em',
            }}
          >
            CRM
          </span>
          <span style={{ height: 1.5, width: 8, background: '#E53935', display: 'block' }} />
        </div>

        {/* by Triple Shield */}
        <span
          style={{
            fontSize: 6.5,
            marginTop: 3,
            color: '#4B5563',
            fontFamily: "'Sora', sans-serif",
            letterSpacing: '0.15em',
          }}
        >
          BY TRIPLE SHIELD
        </span>
      </div>
    </div>
  )
}
