import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../context/LanguageContext'

export default function PortfolioHero({ value, returnPct, returnAbs, onRangeChange }) {
  const { t } = useLang()
  const navigate = useNavigate()
  const [activeRange, setActiveRange] = useState('6M')

  const handleRange = (r) => {
    setActiveRange(r)
    onRangeChange?.(r)
  }

  const formattedValue = value
    ? `$ ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '$ 0.00'

  const formattedReturn = returnAbs
    ? `$${Math.abs(returnAbs).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
    : '$0'

  return (
    <div className="bg-card card-border rounded-2xl p-6 glow-blue h-full flex flex-col">
      {/* Header row */}
      <div className="flex items-start justify-between mb-7">
        <p style={{ color: 'rgba(255,255,255,0.52)', fontSize: 13, fontWeight: 500 }}>
          Total Portfolio Value
        </p>

        {/* 6M / 1Y pills */}
        <div className="flex gap-1.5 flex-shrink-0">
          {['6M', '1Y'].map(r => (
            <button
              key={r}
              onClick={() => handleRange(r)}
              className="rounded-full text-xs font-medium transition-all"
              style={{
                padding: '4px 12px',
                background: activeRange === r
                  ? 'rgba(255,255,255,0.14)'
                  : 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.10)',
                color: activeRange === r
                  ? '#ffffff'
                  : 'rgba(255,255,255,0.45)',
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Value */}
      <div
        className="cursor-pointer group flex-1"
        onClick={() => navigate('/analytics')}
      >
        <p
          className="text-white font-bold leading-none mb-3"
          style={{ fontSize: 30, letterSpacing: '-0.02em' }}
        >
          {formattedValue}
        </p>

        {/* Growth line */}
        <p style={{ color: 'rgba(255,255,255,0.42)', fontSize: 13 }}>
          Growth{' '}
          <span style={{ color: '#6FBFA0', fontWeight: 600 }}>
            +{returnPct}% ({formattedReturn})
          </span>
        </p>
      </div>
    </div>
  )
}
