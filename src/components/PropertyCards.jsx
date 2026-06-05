import { Home, ArrowUpRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const ICON_PALETTE = [
  { icon: '#3b82f6', bg: 'rgba(59,130,246,0.15)'  },
  { icon: '#f97316', bg: 'rgba(249,115,22,0.15)'  },
  { icon: '#22c55e', bg: 'rgba(34,197,94,0.15)'   },
  { icon: '#ef4444', bg: 'rgba(239,68,68,0.15)'   },
  { icon: '#3b82f6', bg: 'rgba(59,130,246,0.15)'  },
]

function fmt(v) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`
  return `$${v}`
}

export default function PropertyCards({ properties }) {
  const navigate = useNavigate()
  const items = (properties ?? []).slice(0, 5)

  return (
    <div className="bg-card card-border rounded-2xl p-5 glow-blue h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <p className="text-white font-semibold text-sm">Featured Properties</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/properties')}
            className="rounded-full text-xs font-medium transition-all hover:brightness-125"
            style={{
              padding: '5px 14px',
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.10)',
              color: 'rgba(255,255,255,0.58)',
            }}
          >
            See all
          </button>
          <button
            onClick={() => navigate('/properties')}
            className="flex items-center justify-center rounded-lg transition-all hover:brightness-125"
            style={{
              width: 28, height: 28,
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.10)',
              color: 'rgba(255,255,255,0.50)',
            }}
          >
            <ArrowUpRight size={13} />
          </button>
        </div>
      </div>

      {/* Property mini-cards */}
      <div className="flex gap-3 flex-1">
        {items.map((p, i) => {
          const c    = ICON_PALETTE[i % ICON_PALETTE.length]
          const name = p.address || p.name || 'Property'
          const price = fmt(p.value ?? p.price ?? 0)

          return (
            <div
              key={p.id ?? i}
              onClick={() => navigate('/properties')}
              className="flex-1 rounded-xl p-3 cursor-pointer transition-all hover:brightness-110 flex flex-col"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              {/* Colored house icon */}
              <div
                className="rounded-xl mb-3 flex items-center justify-center flex-shrink-0"
                style={{ width: 36, height: 36, background: c.bg }}
              >
                <Home size={16} style={{ color: c.icon }} />
              </div>

              {/* Name — 2 lines, truncated */}
              <p
                className="leading-snug mb-1.5 flex-1"
                style={{
                  color: 'rgba(255,255,255,0.38)',
                  fontSize: 10,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {name}
              </p>

              {/* Price */}
              <p className="text-white font-semibold" style={{ fontSize: 13 }}>
                {price}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
