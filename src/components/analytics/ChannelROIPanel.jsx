import { Megaphone, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useLang } from '../../context/LanguageContext'

function fmt(n) {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`
  return `$${(n / 1000).toFixed(0)}K`
}

export default function ChannelROIPanel({ channels }) {
  const { t } = useLang()

  const recommendedConfig = {
    increase:  { label: t('ui.channelIncrease'), color: 'text-emerald-400 bg-emerald-500/10', icon: TrendingUp },
    maintain:  { label: t('ui.channelMaintain'), color: 'text-blue-400 bg-blue-500/10',       icon: Minus },
    decrease:  { label: t('ui.channelDecrease'), color: 'text-amber-400 bg-amber-500/10',     icon: TrendingDown },
    eliminate: { label: t('ui.channelCut'),      color: 'text-red-400 bg-red-500/10',         icon: TrendingDown },
  }

  if (!channels.length) return null
  const sorted = [...channels].sort((a, b) => b.roi - a.roi)
  const maxROI = sorted[0].roi

  return (
    <div className="bg-card card-border rounded-2xl p-4 glow-blue">
      <div className="flex items-center justify-between mb-3">
        <p className="text-white font-semibold text-xs">{t('ui.channelROITitle')}</p>
        <Megaphone size={13} className="text-slate-500" />
      </div>
      <p className="text-slate-500 text-[9px] mb-3">{t('ui.channelROIDesc')}</p>

      <div className="space-y-2.5">
        {sorted.map(ch => {
          const cfg = recommendedConfig[ch.recommended]
          const RecIcon = cfg.icon
          const roiPct = (ch.roi / maxROI) * 100
          const isLosing = ch.roi < 1

          return (
            <div key={ch.channel} className={`${isLosing ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <p className="text-white text-[10px] font-medium truncate">{ch.channel}</p>
                    <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-0.5 ${cfg.color}`}>
                      <RecIcon size={7} />
                      {cfg.label}
                    </span>
                  </div>
                  <p className="text-slate-600 text-[9px]">{fmt(ch.spend)} {t('ui.channelSpendUnit')} · {ch.leads} {t('ui.channelLeadsUnit')} · {ch.conversion}% {t('ui.channelConvUnit')}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-xs font-bold ${isLosing ? 'text-red-400' : 'text-emerald-400'}`}>{ch.roi}x</p>
                  <p className="text-[9px] text-slate-500">{fmt(ch.revenue)}</p>
                </div>
              </div>
              <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${isLosing ? 'bg-red-500' : 'bg-blue-500'}`}
                  style={{ width: `${roiPct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-3 pt-3 border-t border-white/5">
        <div className="flex items-center justify-between text-[9px]">
          <span className="text-slate-500">{t('ui.channelTotalSpend')}</span>
          <span className="text-white font-bold">$600K → {fmt(channels.reduce((s, c) => s + c.revenue, 0))}</span>
        </div>
        <div className="flex items-center justify-between text-[9px] mt-0.5">
          <span className="text-slate-500">{t('ui.channelBlendedROI')}</span>
          <span className="text-emerald-400 font-bold">
            {(() => { const s = channels.reduce((a, c) => a + c.spend, 0); return s > 0 ? (channels.reduce((a, c) => a + c.revenue, 0) / s).toFixed(0) + 'x' : '—' })()}
          </span>
        </div>
      </div>
    </div>
  )
}
