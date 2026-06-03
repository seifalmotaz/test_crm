import { TrendingUp, Home, Clock, Activity, BarChart2, Package } from 'lucide-react'
import { useLang } from '../../context/LanguageContext'

function Stat({ icon: Icon, label, value, sub, positive }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white/3 rounded-xl border border-white/6">
      <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center flex-shrink-0">
        <Icon size={15} className="text-blue-400" />
      </div>
      <div>
        <p className="text-slate-500 text-[10px] font-medium uppercase tracking-wider">{label}</p>
        <p className="text-white text-sm font-bold">{value}</p>
        {sub && (
          <p className={`text-[10px] font-medium ${positive ? 'text-emerald-400' : 'text-red-400'}`}>{sub}</p>
        )}
      </div>
    </div>
  )
}

export default function MarketStrip({ data }) {
  const { t } = useLang()
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
      <Stat icon={Package} label={t('ui.marketTotalInventory')} value={(data.totalInventory ?? 0).toLocaleString()} sub={`${data.inventoryChange ?? 0}% ${t('common.vsLastMonth')}`} positive={false} />
      <Stat icon={Home} label={t('ui.marketActiveListings')} value={(data.activeListings ?? 0).toLocaleString()} />
      <Stat icon={Activity} label={t('ui.marketPendingSales')} value={data.pendingSales} />
      <Stat icon={BarChart2} label={t('ui.marketSoldThisMonth')} value={data.soldThisMonth} sub={`+4 ${t('ui.marketVsTarget')}`} positive={true} />
      <Stat icon={Clock} label={t('ui.marketAvgDaysOnMarket')} value={`${data.avgDaysOnMarket} ${t('ui.marketDays')}`} sub={`-2 ${t('ui.marketDays')} ${t('ui.marketVsLastMo')}`} positive={true} />
      <Stat icon={TrendingUp} label={t('ui.marketPriceTrend')} value={`+${data.priceTrend}%`} sub={t('common.vsLastMonth')} positive={true} />
    </div>
  )
}
