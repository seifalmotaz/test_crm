import { Clock, AlertCircle } from 'lucide-react'
import { useLang } from '../../context/LanguageContext'
import { tierConfig } from '../../data/clientsData'

function fmt(v) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v}`
}

const engagementColors = {
  'very high': 'text-emerald-400',
  high:        'text-blue-400',
  medium:      'text-amber-400',
  low:         'text-orange-400',
  dormant:     'text-red-400',
}

function CLVBar({ value, max = 10000000 }) {
  const pct = Math.min((value / max) * 100, 100)
  const color = value >= 5000000 ? '#f59e0b' : value >= 1000000 ? '#3b82f6' : '#64748b'
  return (
    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  )
}

export default function ClientCard({ client, onClick }) {
  const { t } = useLang()
  const tier = tierConfig[client.tier]
  const isDormant = client.status === 'dormant'
  const isUrgentContact = client.daysSinceContact > 30 && client.tier !== 'regular'
  const typeLabels = {
    buyer: t('leads.form.type') === 'النوع' ? 'مشتري' : 'Buyer',
    seller: t('leads.form.type') === 'النوع' ? 'بائع' : 'Seller',
    investor: t('leads.form.type') === 'النوع' ? 'مستثمر' : 'Investor',
    mixed: t('leads.form.type') === 'النوع' ? 'متعدد' : 'Mixed',
  }
  const typeStr = (client.type || []).map(tp => typeLabels[tp] || tp).join(' / ')
  const engagementLabels = {
    'very high': t('ui.engagementVeryHigh'),
    high:        t('ui.engagementHigh'),
    medium:      t('ui.engagementMedium'),
    low:         t('ui.engagementLow'),
    dormant:     t('ui.engagementDormant'),
  }

  return (
    <div
      onClick={() => onClick(client)}
      className={`bg-card rounded-2xl border cursor-pointer transition-all hover:shadow-lg hover:shadow-blue-500/5 p-4 ${
        isDormant ? 'border-red-500/25 hover:border-red-500/40' : 'card-border hover:border-blue-500/30'
      }`}
    >
      <div className="flex items-start gap-3 mb-3">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
          style={{ backgroundColor: `${client.color}20`, border: `1px solid ${client.color}40`, color: client.color }}
        >
          {client.avatar}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold truncate">{client.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full border ${tier.color}`}>
              {tier.label}
            </span>
            <span className="text-slate-500 text-[10px]">{typeStr}</span>
            {isDormant && (
              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/25">
                {t('ui.dormantLabel')}
              </span>
            )}
          </div>
        </div>
        {client.npsScore && (
          <div className="flex-shrink-0 text-right">
            <p className="text-white text-sm font-bold">{client.npsScore}</p>
            <p className="text-slate-500 text-[9px]">NPS</p>
          </div>
        )}
      </div>

      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <p className="text-slate-500 text-[10px] uppercase tracking-wider">{t('ui.lifetimeValue')}</p>
          <p className="text-white font-bold text-sm">{fmt(client.lifetimeValue)}</p>
        </div>
        <CLVBar value={client.lifetimeValue} />
      </div>

      <div className="grid grid-cols-3 gap-1.5 mb-3 text-center">
        <div className="bg-white/4 border border-white/6 rounded-lg py-1.5">
          <p className="text-white text-xs font-bold">{client.transactionCount}</p>
          <p className="text-slate-500 text-[9px]">{t('ui.transactions')}</p>
        </div>
        <div className="bg-white/4 border border-white/6 rounded-lg py-1.5">
          <p className="text-white text-xs font-bold">{client.referralCount}</p>
          <p className="text-slate-500 text-[9px]">{t('ui.referrals')}</p>
        </div>
        <div className="bg-white/4 border border-white/6 rounded-lg py-1.5">
          <p className={`text-xs font-bold ${client.repeatLikelihood >= 75 ? 'text-emerald-400' : client.repeatLikelihood >= 50 ? 'text-blue-400' : 'text-amber-400'}`}>
            {client.repeatLikelihood}%
          </p>
          <p className="text-slate-500 text-[9px]">{t('ui.repeatLikelihood')}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 mb-3">
        {client.tags.slice(0, 3).map(tag => (
          <span key={tag} className="text-[9px] text-slate-400 bg-white/5 border border-white/8 px-1.5 py-0.5 rounded-md">{tag}</span>
        ))}
      </div>

      <div className="flex items-center justify-between pt-2.5 border-t border-white/5 text-[10px]">
        <div className={`flex items-center gap-1 font-medium ${engagementColors[client.engagementLevel] ?? 'text-slate-400'}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          <span>{engagementLabels[client.engagementLevel] || client.engagementLevel}</span>
        </div>
        <div className="flex items-center gap-1 text-slate-500">
          <Clock size={9} />
          {client.daysSinceContact === 0 ? t('ui.today') : `${client.daysSinceContact}${t('ui.daysAgo')}`}
          {isUrgentContact && <AlertCircle size={9} className="text-amber-400 ms-1" />}
        </div>
      </div>

      {isDormant && (
        <div className="mt-2 pt-2 border-t border-red-500/15">
          <p className="text-red-400 text-[9px] flex items-center gap-1">
            <AlertCircle size={9} /> {client.daysSinceContact}{t('ui.urgentReengagement')}
          </p>
        </div>
      )}
    </div>
  )
}
