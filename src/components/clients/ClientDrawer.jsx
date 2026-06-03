import { X, Star, TrendingUp, Clock, Phone, Mail, AlertCircle, CheckCircle, Calendar, DollarSign } from 'lucide-react'
import { tierConfig } from '../../data/clientsData'
import { useLang } from '../../context/LanguageContext'

function fmt(v) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(3)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v}`
}

const txTypeColors = {
  bought: 'bg-blue-500/15 text-blue-300',
  sold: 'bg-emerald-500/15 text-emerald-300',
}

const nextTransactionColors = {
  high: '#10b981', medium: '#3b82f6', low: '#f59e0b',
}

export default function ClientDrawer({ client, onClose }) {
  const { t } = useLang()
  if (!client) return null

  const tier = tierConfig[client.tier]
  const isDormant = client.status === 'dormant'
  const nextColor = client.nextTransactionLikelihood >= 75 ? nextTransactionColors.high
    : client.nextTransactionLikelihood >= 50 ? nextTransactionColors.medium
    : nextTransactionColors.low

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[520px] bg-navy-800 border-l border-blue-500/15 z-50 overflow-y-auto shadow-2xl">

        <div className="sticky top-0 bg-navy-800/95 backdrop-blur-sm border-b border-white/5 px-6 py-4 flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-base font-bold flex-shrink-0"
            style={{ backgroundColor: `${client.color}20`, border: `1px solid ${client.color}40`, color: client.color }}
          >
            {client.avatar}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-white font-bold">{client.name}</p>
              {isDormant && <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full">{t('clients.drawer.dormant')}</span>}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${tier.color}`}>{tier.label}</span>
              <span className="text-slate-400 text-xs">{client.type.join(' / ')} · {client.location}</span>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/4 border border-white/8 rounded-2xl p-4 text-center">
              <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">{t('clients.drawer.lifetimeValue')}</p>
              <p className="text-white text-2xl font-bold">{fmt(client.lifetimeValue)}</p>
              <p className="text-slate-500 text-xs mt-1">{client.transactionCount} {t('clients.drawer.transactions')} · {tier.desc}</p>
            </div>
            <div className="bg-white/4 border border-white/8 rounded-2xl p-4 text-center">
              <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">{t('clients.drawer.referralValue')}</p>
              <p className="text-white text-2xl font-bold">{fmt(client.referralValue)}</p>
              <p className="text-slate-500 text-xs mt-1">{client.referralCount} {t('clients.drawer.referralsGenerated')}</p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {[
              { label: t('clients.drawer.repeatPct'),    value: `${client.repeatLikelihood}%`,                                                         icon: TrendingUp },
              { label: t('clients.drawer.satisfaction'), value: client.npsScore ?? '—',                                                                 icon: Star },
              { label: t('clients.drawer.lastContact'),  value: client.daysSinceContact === 0 ? t('clients.drawer.today') : `${client.daysSinceContact}d`, icon: Clock },
              { label: t('clients.drawer.agent'),        value: client.agent.split(' ')[0],                                                             icon: CheckCircle },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="bg-white/4 border border-white/8 rounded-xl p-3 text-center">
                <Icon size={12} className="text-blue-400 mx-auto mb-1" />
                <p className="text-white text-sm font-bold">{value}</p>
                <p className="text-slate-500 text-[9px]">{label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <a href={`mailto:${client.email}`} className="flex items-center gap-2 p-2.5 bg-white/4 border border-white/8 rounded-xl hover:bg-white/8 transition-all">
              <Mail size={13} className="text-blue-400 flex-shrink-0" />
              <p className="text-slate-300 text-xs truncate">{client.email}</p>
            </a>
            <a href={`tel:${client.phone}`} className="flex items-center gap-2 p-2.5 bg-white/4 border border-white/8 rounded-xl hover:bg-white/8 transition-all">
              <Phone size={13} className="text-emerald-400 flex-shrink-0" />
              <p className="text-slate-300 text-xs">{client.phone}</p>
            </a>
          </div>

          <div className="bg-white/3 border border-white/8 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={14} className="text-blue-400" />
              <p className="text-white font-semibold text-xs">{t('clients.drawer.nextTransactionPrediction')}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <p className="text-slate-500 text-[10px] mb-0.5">{t('clients.drawer.likelihood')}</p>
                <p className="text-lg font-bold" style={{ color: nextColor }}>{client.nextTransactionLikelihood}%</p>
              </div>
              <div>
                <p className="text-slate-500 text-[10px] mb-0.5">{t('clients.drawer.expectedValue')}</p>
                <p className="text-white font-bold">{fmt(client.nextTransactionValue)}</p>
              </div>
              <div>
                <p className="text-slate-500 text-[10px] mb-0.5">{t('clients.drawer.timeline')}</p>
                <p className="text-slate-200 text-xs font-medium">{client.nextTransactionTimeline}</p>
              </div>
              <div>
                <p className="text-slate-500 text-[10px] mb-0.5">{t('clients.drawer.type')}</p>
                <p className="text-slate-200 text-xs font-medium">{client.nextTransactionType}</p>
              </div>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${client.nextTransactionLikelihood}%`, backgroundColor: nextColor }} />
            </div>
          </div>

          {client.transactions.length > 0 && (
            <div>
              <p className="text-white font-semibold text-xs mb-3">{t('clients.drawer.transactionHistory')}</p>
              <div className="space-y-2">
                {client.transactions.map((tx, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-white/3 border border-white/6 rounded-xl">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${txTypeColors[tx.type]}`}>
                      {tx.type === 'bought' ? t('clients.drawer.bought') : t('clients.drawer.sold')}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-medium truncate">{tx.property}</p>
                      <p className="text-slate-500 text-[10px]">{tx.date}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-white text-xs font-bold">{fmt(tx.value)}</p>
                      {tx.profit && (
                        <p className="text-emerald-400 text-[9px]">+{fmt(tx.profit)} {t('clients.drawer.profit')}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-2xl p-4">
            <p className="text-emerald-300 text-xs font-semibold uppercase tracking-wider mb-2">
              <CheckCircle size={12} className="inline mr-1.5" />{t('clients.drawer.keyValueDrivers')}
            </p>
            <ul className="space-y-1.5">
              {client.strengths.map((s, i) => (
                <li key={i} className="text-slate-300 text-xs flex items-start gap-2">
                  <span className="text-emerald-400 flex-shrink-0">·</span>{s}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-blue-500/8 border border-blue-500/20 rounded-2xl p-4">
            <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider mb-2">
              <Star size={12} className="inline mr-1.5" />{t('clients.drawer.engagementStrategy')}
            </p>
            <p className="text-slate-200 text-sm leading-relaxed">{client.engagementStrategy}</p>
          </div>

          {isDormant && (
            <div className="bg-red-500/10 border border-red-500/25 rounded-2xl p-4">
              <p className="text-red-300 text-xs font-semibold uppercase tracking-wider mb-2">
                <AlertCircle size={12} className="inline mr-1.5" />{t('clients.drawer.urgentReEngagement')}
              </p>
              <p className="text-slate-300 text-sm">
                {client.daysSinceContact} {t('clients.drawer.urgentMsgPt1')} {client.referralCount} {t('clients.drawer.urgentMsgPt2')} {fmt(client.referralValue)} {t('clients.drawer.urgentMsgPt3')}
              </p>
            </div>
          )}

          <div className="bg-white/3 border border-white/6 rounded-xl p-4">
            <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-2">{t('clients.drawer.preferencesAndBudget')}</p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-slate-500 text-[10px]">{t('clients.drawer.propertyType')}</p>
                <p className="text-white font-medium">{client.preferredPropertyType}</p>
              </div>
              <div>
                <p className="text-slate-500 text-[10px]">{t('clients.drawer.location')}</p>
                <p className="text-white font-medium">{client.preferredLocation}</p>
              </div>
              <div>
                <p className="text-slate-500 text-[10px]">{t('clients.drawer.budgetRange')}</p>
                <p className="text-white font-medium">{fmt(client.budgetRange[0])} – {fmt(client.budgetRange[1])}</p>
              </div>
              <div>
                <p className="text-slate-500 text-[10px]">{t('clients.drawer.agent')}</p>
                <p className="text-white font-medium">{client.agent}</p>
              </div>
            </div>
          </div>

          <div className="bg-white/3 border border-white/6 rounded-xl p-3">
            <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">{t('clients.drawer.notes')}</p>
            <p className="text-slate-300 text-xs leading-relaxed">{client.notes}</p>
          </div>

          <div className="grid grid-cols-3 gap-2 pb-2">
            <button className="flex items-center justify-center gap-1.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-slate-300 text-xs font-medium hover:bg-white/10 transition-all">
              <Mail size={12} /> {t('clients.drawer.email')}
            </button>
            <button className="flex items-center justify-center gap-1.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-slate-300 text-xs font-medium hover:bg-white/10 transition-all">
              <Phone size={12} /> {t('clients.drawer.call')}
            </button>
            <button className="flex items-center justify-center gap-1.5 py-2.5 bg-blue-500 rounded-xl text-white text-xs font-medium hover:bg-blue-600 transition-all">
              <Calendar size={12} /> {t('clients.drawer.schedule')}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
