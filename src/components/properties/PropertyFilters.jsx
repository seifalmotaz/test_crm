import { useState } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { useLang } from '../../context/LanguageContext'

const neighborhoods  = ['All', 'Downtown', 'North Hills', 'Westside', 'East End', 'Midtown', 'Harbor View']
const propertyTypes  = ['All', 'Apartment', 'Villa', 'Commercial', 'Townhouse', 'Land']
const bedroomOptions = ['Any', '1+', '2+', '3+', '4+', '5+']
const priceRanges    = ['Any', 'Under $500K', '$500K–$1M', '$1M–$2M', '$2M–$5M', '$5M+']

function FilterChip({ label, options, value, onChange }) {
  return (
    <div className="relative group">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 pe-7 focus:outline-none focus:border-blue-500/50 cursor-pointer hover:bg-white/8 transition-all"
      >
        {options.map((o) => (
          <option key={o} value={o} className="bg-navy-800 text-slate-200">
            {label}: {o}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 text-slate-500 text-[10px]">▾</span>
    </div>
  )
}

export default function PropertyFilters({ filters, onChange, resultCount }) {
  const { t } = useLang()
  const [showAdvanced, setShowAdvanced] = useState(false)

  const hasActive = Object.values(filters).some((v) => v !== 'All' && v !== 'Any' && v !== '')

  const reset = () =>
    onChange({ neighborhood: 'All', type: 'All', beds: 'Any', price: 'Any', query: '' })

  return (
    <div className="bg-card card-border rounded-2xl p-5 glow-blue mb-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={t('ui.filterSearchPlaceholder')}
            value={filters.query}
            onChange={(e) => onChange({ ...filters, query: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded-xl ps-9 pe-4 py-2.5 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-all"
          />
          {filters.query && (
            <button
              onClick={() => onChange({ ...filters, query: '' })}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowAdvanced((p) => !p)}
          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium transition-all ${
            showAdvanced
              ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
              : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/8'
          }`}
        >
          <SlidersHorizontal size={14} />
          {t('ui.filterFilters')}
        </button>
        {hasActive && (
          <button
            onClick={reset}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs text-red-400 border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 transition-all"
          >
            <X size={12} />
            {t('ui.filterClear')}
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <FilterChip label={t('ui.filterArea')} options={neighborhoods} value={filters.neighborhood} onChange={(v) => onChange({ ...filters, neighborhood: v })} />
        <FilterChip label={t('ui.filterType')} options={propertyTypes} value={filters.type} onChange={(v) => onChange({ ...filters, type: v })} />
        <FilterChip label={t('ui.filterBeds')} options={bedroomOptions} value={filters.beds} onChange={(v) => onChange({ ...filters, beds: v })} />
        <FilterChip label={t('ui.filterPrice')} options={priceRanges} value={filters.price} onChange={(v) => onChange({ ...filters, price: v })} />

        <div className="ms-auto text-slate-400 text-xs">
          <span className="text-white font-semibold">{resultCount}</span> {t('ui.propertiesFound')}
        </div>
      </div>

      {showAdvanced && (
        <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: t('ui.filterStatus'),    options: ['Any', 'Active', 'Pending', 'Sold'] },
            { label: t('ui.filterYearBuilt'), options: ['Any', 'After 2020', 'After 2015', 'After 2010', 'Before 2010'] },
            { label: t('ui.filterMatchScore'),options: ['Any', '90+', '80+', '70+'] },
            { label: t('ui.filterSortBy'),    options: ['Match Score', 'Price: Low', 'Price: High', 'Newest', 'Days on Market'] },
          ].map(({ label, options }) => (
            <FilterChip key={label} label={label} options={options} value={options[0]} onChange={() => {}} />
          ))}
        </div>
      )}
    </div>
  )
}
