import { Eye, Clock, TrendingUp, Bed, Bath, Maximize2 } from 'lucide-react'
import { useLang } from '../../context/LanguageContext'

function fmt(v) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v}`
}

const statusColors = {
  Active:  'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  Pending: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  Sold:    'bg-slate-500/15 text-slate-400 border-slate-500/25',
}

function ScoreRing({ score }) {
  const color = score >= 90 ? '#10b981' : score >= 80 ? '#3b82f6' : score >= 70 ? '#f59e0b' : '#ef4444'
  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold border-2 flex-shrink-0"
      style={{ borderColor: color, color, background: `${color}15` }}
    >
      {score}
    </div>
  )
}

export default function PropertyCard({ property, onClick }) {
  const { t } = useLang()
  const ppsf = Math.round(property.price / property.sqft)
  const statusLabels = {
    Active:  t('ui.propStatusActive'),
    Pending: t('ui.propStatusPending'),
    Sold:    t('ui.propStatusSold'),
  }

  return (
    <div
      onClick={() => onClick(property)}
      className="bg-card card-border rounded-2xl overflow-hidden cursor-pointer hover:border-blue-500/30 hover:shadow-lg hover:shadow-blue-500/5 transition-all group"
    >
      <div className="h-36 bg-gradient-to-br from-navy-700 to-navy-600 flex items-center justify-center relative overflow-hidden">
        {property.coverUrl
          ? <img src={property.coverUrl} alt={property.address} className="w-full h-full object-cover" />
          : <span className="text-5xl">{property.images[0]}</span>
        }
        <div className="absolute top-3 start-3">
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${statusColors[property.status]}`}>
            {statusLabels[property.status] || property.status}
          </span>
        </div>
        <div className="absolute top-3 end-3">
          <ScoreRing score={property.matchScore} />
        </div>
        {property.daysOnMarket <= 7 && (
          <div className="absolute bottom-3 start-3 bg-blue-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
            {t('ui.propNew')}
          </div>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between mb-1">
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm truncate">{property.address}</p>
            <p className="text-slate-500 text-xs">{property.neighborhood} · {property.type}</p>
          </div>
        </div>

        <p className="text-white text-lg font-bold mt-2 mb-1">{fmt(property.price)}</p>

        <div className="flex items-center gap-3 text-slate-400 text-xs mb-3">
          {property.beds > 0 && (
            <span className="flex items-center gap-1"><Bed size={11} />{property.beds} {t('ui.propBd')}</span>
          )}
          <span className="flex items-center gap-1"><Bath size={11} />{property.baths} {t('ui.propBa')}</span>
          <span className="flex items-center gap-1"><Maximize2 size={11} />{(property.sqft ?? 0).toLocaleString()} {t('ui.propSqft')}</span>
          <span className="text-slate-600">·</span>
          <span>${ppsf}/{t('ui.propSqft')}</span>
        </div>

        <div className="flex flex-wrap gap-1 mb-3">
          {property.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="text-[9px] text-slate-400 bg-white/5 border border-white/8 px-1.5 py-0.5 rounded-md">
              {tag}
            </span>
          ))}
          {property.tags.length > 3 && (
            <span className="text-[9px] text-slate-500">+{property.tags.length - 3}</span>
          )}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-white/5 text-[10px]">
          <div className="flex items-center gap-3 text-slate-500">
            <span className="flex items-center gap-1"><Eye size={10} /> {property.views}</span>
            <span className="flex items-center gap-1"><Clock size={10} /> {property.daysOnMarket}d</span>
          </div>
          <div className={`flex items-center gap-1 font-medium ${property.appreciationYoY >= 4 ? 'text-emerald-400' : 'text-blue-400'}`}>
            <TrendingUp size={10} />
            +{property.appreciationYoY}% {t('ui.propYoY')}
          </div>
        </div>

        {property.concerns.length > 0 && (
          <div className="mt-2 pt-2 border-t border-white/5">
            <p className="text-amber-400 text-[9px]">⚠ {property.concerns[0]}</p>
          </div>
        )}
      </div>
    </div>
  )
}
