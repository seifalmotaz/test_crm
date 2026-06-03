import { TrendingUp, Target } from 'lucide-react'
import { useLang } from '../../context/LanguageContext'

function fmt(n) {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`
  return `$${(n / 1000).toFixed(0)}K`
}

export default function ForecastPanel({ forecast }) {
  const { t } = useLang()
  const { days30, days90, scenarios } = forecast

  return (
    <div className="bg-card card-border rounded-2xl p-4 glow-blue space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-white font-semibold text-xs">{t('ui.forecastTitle')}</p>
        <TrendingUp size={13} className="text-blue-400" />
      </div>

      <div className="space-y-3">
        {[
          { label: t('ui.forecast30Day'), value: days30.value, deals: days30.deals, confidence: days30.confidence, color: 'bg-blue-500',   max: days90.value },
          { label: t('ui.forecast90Day'), value: days90.value, deals: days90.deals, confidence: days90.confidence, color: 'bg-purple-500', max: days90.value },
        ].map(({ label, value, deals, confidence, color, max }) => (
          <div key={label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-slate-400">{label}</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] text-slate-600">{confidence}{t('ui.forecastConfidence')}</span>
                <span className="text-xs text-white font-bold">{fmt(value)}</span>
              </div>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${color}`} style={{ width: `${(value / max) * 100}%` }} />
            </div>
            <p className="text-[9px] text-slate-600 mt-0.5">{deals} {t('ui.forecastDealsToClose')}</p>
          </div>
        ))}
      </div>

      <div>
        <p className="text-slate-500 text-[9px] font-semibold uppercase tracking-widest mb-2">{t('ui.forecast30DayPipeline')}</p>
        <div className="space-y-1.5">
          {days30.breakdown.map(deal => (
            <div key={deal.deal} className="flex items-center gap-2 p-2 bg-white/3 border border-white/5 rounded-lg">
              <div
                className="w-1 h-6 rounded-full flex-shrink-0"
                style={{ backgroundColor: deal.probability >= 80 ? '#10b981' : deal.probability >= 70 ? '#3b82f6' : '#f59e0b' }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-white text-[9px] font-medium truncate">{deal.deal}</p>
                <p className="text-slate-600 text-[8px]">{deal.daysToClose}{t('ui.forecastDToClose')}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-white text-[9px] font-bold">{fmt(deal.value)}</p>
                <p className="text-emerald-400 text-[8px]">{deal.probability}%</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-slate-500 text-[9px] font-semibold uppercase tracking-widest mb-2">{t('ui.forecastFullYear')}</p>
        <div className="space-y-1.5">
          {Object.values(scenarios).map(s => (
            <div key={s.label} className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
              <span className="text-[10px] text-slate-400 flex-1">{s.label}</span>
              <span className="text-[9px] text-slate-600">{s.probability}%</span>
              <span className="text-[10px] font-bold" style={{ color: s.color }}>{fmt(s.fullYear)}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 p-2 bg-blue-500/8 border border-blue-500/15 rounded-lg">
          <p className="text-[9px] text-blue-300">Base case implies <span className="font-bold">+24.9% growth</span> vs 2025 ($43.4M → $54.2M) driven by Downtown expansion and referral program scaling.</p>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <Target size={11} className="text-blue-400" />
            <span className="text-[10px] text-slate-400">{t('ui.forecastAnnualTarget')}</span>
          </div>
          <span className="text-[10px] text-white font-bold">$54.2M</span>
        </div>
        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-blue-500" style={{ width: `${(15800000 / 54200000) * 100}%` }} />
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[9px] text-slate-600">{t('ui.forecastYTD')} $15.8M (29%)</span>
          <span className="text-[9px] text-slate-600">$38.4M {t('ui.forecastRemaining')}</span>
        </div>
      </div>
    </div>
  )
}
