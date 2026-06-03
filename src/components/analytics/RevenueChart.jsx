import { useState } from 'react'
import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { useLang } from '../../context/LanguageContext'

const RANGES = [
  { label: '6M',  months: 6 },
  { label: '12M', months: 12 },
  { label: '18M', months: 18 },
]

function CustomTooltip({ active, payload, label, t }) {
  if (!active || !payload?.length) return null
  const rev = payload.find(p => p.dataKey === 'revenue')
  const tgt = payload.find(p => p.dataKey === 'target')
  const deals = payload.find(p => p.dataKey === 'deals')
  const aboveTarget = rev && tgt && rev.value >= tgt.value
  return (
    <div className="bg-navy-800 border border-white/10 rounded-xl px-3 py-2.5 shadow-xl text-xs">
      <p className="text-slate-400 mb-1.5 font-medium">{label}</p>
      {rev && (
        <p className={`font-bold ${aboveTarget ? 'text-emerald-400' : 'text-red-400'}`}>
          ${(rev.value ?? 0).toFixed(1)}{t('ui.revenueMUnit')}
        </p>
      )}
      {tgt && <p className="text-slate-500">${tgt.value.toFixed(1)}{t('ui.targetMUnit')}</p>}
      {deals && <p className="text-blue-300 mt-0.5">{deals.value} {t('ui.revenueDealsClosedUnit')}</p>}
    </div>
  )
}

export default function RevenueChart({ data }) {
  const { t } = useLang()
  const [range, setRange] = useState(12)
  const sliced = data.slice(-range)

  return (
    <div className="bg-card card-border rounded-2xl p-4 glow-blue">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-white font-semibold text-xs">{t('ui.revenueTrendTitle')}</p>
          <p className="text-slate-500 text-[10px] mt-0.5">{t('ui.revenueVsTarget')}</p>
        </div>
        <div className="flex gap-1">
          {RANGES.map(r => (
            <button
              key={r.label}
              onClick={() => setRange(r.months)}
              className={`px-3 py-1 rounded-lg text-[10px] font-medium transition-all ${
                range === r.months
                  ? 'bg-blue-500 text-white'
                  : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4 mb-3">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-blue-500 rounded" />
          <span className="text-[10px] text-slate-500">{t('ui.revenueLegend')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-slate-600 rounded border-dashed" style={{ borderTop: '1px dashed #475569' }} />
          <span className="text-[10px] text-slate-500">{t('ui.targetLegend')}</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={sliced} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fill: '#64748b', fontSize: 9 }}
            axisLine={false}
            tickLine={false}
            interval={range <= 6 ? 0 : range <= 12 ? 1 : 2}
          />
          <YAxis
            tick={{ fill: '#64748b', fontSize: 9 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `$${v}M`}
            domain={['auto', 'auto']}
          />
          <Tooltip content={<CustomTooltip t={t} />} cursor={{ stroke: 'rgba(255,255,255,0.06)', strokeWidth: 1 }} />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="url(#revenueGrad)"
            dot={false}
            activeDot={{ r: 4, fill: '#3b82f6', stroke: '#1e3a5f', strokeWidth: 2 }}
          />
          <Line
            type="monotone"
            dataKey="target"
            stroke="#475569"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
            activeDot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
