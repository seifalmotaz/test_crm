import { useState } from 'react'
import { ChevronDown, TrendingUp, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../context/LanguageContext'

const ranges = ['1D', '1W', '1M', '6M', '1Y']

export default function PortfolioHero({ value, returnPct, returnAbs, onRangeChange }) {
  const { t } = useLang()
  const navigate = useNavigate()
  const [activeRange, setActiveRange] = useState('6M')

  const handleRange = (r) => {
    setActiveRange(r)
    onRangeChange?.(r)
  }

  return (
    <div className="bg-card card-border rounded-2xl p-6 glow-blue">
      <div className="flex items-start justify-between mb-6">
        <div
          className="cursor-pointer group"
          onClick={() => navigate('/analytics')}
        >
          <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1 flex items-center gap-1">
            {t('ui.totalPortfolioValue')}
            <ArrowRight size={11} className="opacity-0 group-hover:opacity-100 group-hover:text-[#E53935] transition-all" />
          </p>
          <p className="text-white text-4xl font-bold tracking-tight">
            ${(value / 1_000_000).toFixed(2)}M
          </p>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex items-center gap-1 bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full text-xs font-medium">
              <TrendingUp size={11} />
              +{returnPct}% (+${(returnAbs / 1000).toFixed(0)}K)
            </div>
            <span className="text-slate-500 text-xs">{t('common.vsLastMonth')}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-300 cursor-pointer hover:bg-white/10 transition-all">
            <span className="font-medium">{activeRange}</span>
            <ChevronDown size={14} className="text-slate-400" />
          </div>
        </div>
      </div>

      {/* Range selector */}
      <div className="flex gap-1">
        {ranges.map((r) => (
          <button
            key={r}
            onClick={() => handleRange(r)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeRange === r
                ? 'bg-blue-500 text-white'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  )
}
