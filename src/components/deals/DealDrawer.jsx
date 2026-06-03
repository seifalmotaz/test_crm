import { useState, useEffect } from 'react'
import { X, CheckCircle, Circle, Clock, AlertTriangle, TrendingUp, DollarSign, Star, Phone, Calendar, FileText } from 'lucide-react'
import FileUploader from '../shared/FileUploader'
import api from '../../lib/api'
import { useLang } from '../../context/LanguageContext'

function fmt(v) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(3)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v}`
}

const riskBadge = {
  low: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  medium: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  high: 'bg-red-500/15 text-red-400 border-red-500/25',
}

function fmtBytes(b) {
  if (b < 1024)        return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

export default function DealDrawer({ deal, onClose }) {
  const { t } = useLang()
  const [files,       setFiles]       = useState([])
  const [filesLoading, setFilesLoading] = useState(false)

  const milestoneStatus = {
    done:        { icon: CheckCircle, color: 'text-emerald-400', label: t('deals.drawer.milestoneComplete') },
    pending:     { icon: Clock,       color: 'text-blue-400',    label: t('deals.drawer.milestoneInProgress') },
    overdue:     { icon: AlertTriangle, color: 'text-red-400',   label: t('deals.drawer.milestoneOverdue') },
    not_started: { icon: Circle,      color: 'text-slate-600',   label: t('deals.drawer.milestoneNotStarted') },
  }

  const progressLabels = [
    t('deals.drawer.progressStep1'),
    t('deals.drawer.progressStep2'),
    t('deals.drawer.progressStep3'),
    t('deals.drawer.progressStep4'),
    t('deals.drawer.progressStep5'),
    t('deals.drawer.progressStep6'),
  ]

  useEffect(() => {
    if (!deal?.id) { setFiles([]); return }
    setFilesLoading(true)
    setFiles([])
    api.get(`/api/files?entityType=deal&entityId=${deal.id}`)
      .then(res => setFiles(res.data || []))
      .catch(() => {})
      .finally(() => setFilesLoading(false))
  }, [deal?.id])

  if (!deal) return null
  const commission = (deal.value * deal.commissionRate) / 100
  const agentCommission = commission / 2
  const progressPct = Math.round((Object.values(deal.progress).filter(Boolean).length / Object.keys(deal.progress).length) * 100)

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[500px] bg-navy-800 border-l border-blue-500/15 z-50 overflow-y-auto shadow-2xl">

        <div className="sticky top-0 bg-navy-800/95 backdrop-blur-sm border-b border-white/5 px-6 py-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{deal.icon}</span>
            <div>
              <p className="text-white font-bold">{deal.property}</p>
              <p className="text-slate-400 text-xs">{deal.address}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/4 border border-white/8 rounded-2xl p-4 text-center">
              <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">{t('deals.drawer.dealValue')}</p>
              <p className="text-white text-2xl font-bold">{fmt(deal.value)}</p>
              <p className="text-slate-500 text-xs mt-1">{deal.type} · {deal.commissionRate}% {t('deals.drawer.comm')}</p>
            </div>
            <div className="bg-white/4 border border-white/8 rounded-2xl p-4 text-center">
              <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">{t('deals.drawer.closeProbability')}</p>
              <p className={`text-2xl font-bold ${deal.closingProbability >= 85 ? 'text-emerald-400' : deal.closingProbability >= 70 ? 'text-blue-400' : deal.closingProbability >= 55 ? 'text-amber-400' : 'text-red-400'}`}>
                {deal.closingProbability}%
              </p>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${riskBadge[deal.risk]}`}>
                {deal.risk} {t('deals.drawer.risk')}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: t('deals.drawer.daysLeft'),    value: deal.daysUntilClose, urgent: deal.daysUntilClose <= 14, icon: Calendar },
              { label: t('deals.drawer.daysElapsed'), value: deal.daysElapsed,    icon: Clock },
              { label: t('deals.drawer.progress'),    value: `${progressPct}%`,   icon: TrendingUp },
            ].map(({ label, value, urgent, icon: Icon }) => (
              <div key={label} className="bg-white/4 border border-white/8 rounded-xl p-3 text-center">
                <Icon size={12} className={`mx-auto mb-1 ${urgent ? 'text-amber-400' : 'text-blue-400'}`} />
                <p className={`text-sm font-bold ${urgent ? 'text-amber-400' : 'text-white'}`}>{value}</p>
                <p className="text-slate-500 text-[9px]">{label}</p>
              </div>
            ))}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5 text-[10px]">
              <span className="text-slate-400 uppercase tracking-wider">{t('deals.drawer.dealProgress')}</span>
              <span className="text-white font-medium">{progressPct}%</span>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-3">
              <div
                className={`h-full rounded-full transition-all ${progressPct >= 80 ? 'bg-emerald-400' : progressPct >= 50 ? 'bg-blue-400' : 'bg-amber-400'}`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="grid grid-cols-6 gap-1">
              {progressLabels.map((label, i) => {
                const val = Object.values(deal.progress)[i]
                return (
                  <div key={label} className="text-center">
                    <div className={`w-4 h-4 rounded-full mx-auto mb-1 flex items-center justify-center ${val ? 'bg-emerald-400' : 'bg-white/8'}`}>
                      {val && <CheckCircle size={10} className="text-white" />}
                    </div>
                    <p className="text-[8px] text-slate-600 leading-tight">{label}</p>
                  </div>
                )
              })}
            </div>
          </div>

          <div>
            <p className="text-white font-semibold text-xs mb-3">{t('deals.drawer.criticalPath')}</p>
            <div className="space-y-2">
              {deal.milestones.map((m, i) => {
                const { icon: Icon, color, label } = milestoneStatus[m.status]
                return (
                  <div key={i} className={`flex items-center gap-3 p-2.5 rounded-xl ${m.status === 'overdue' ? 'bg-red-500/8 border border-red-500/20' : 'bg-white/3 border border-white/6'}`}>
                    <Icon size={14} className={`${color} flex-shrink-0`} />
                    <div className="flex-1">
                      <p className={`text-xs font-medium ${m.status === 'overdue' ? 'text-red-300' : 'text-white'}`}>{m.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-400 text-[10px]">{m.due}</p>
                      <p className={`text-[9px] font-medium ${color}`}>{label}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-2xl p-4">
            <p className="text-emerald-300 text-xs font-semibold uppercase tracking-wider mb-2">{t('deals.drawer.positiveFactors')}</p>
            <ul className="space-y-1">
              {deal.positives.map((p, i) => (
                <li key={i} className="text-slate-300 text-xs flex items-start gap-2">
                  <CheckCircle size={11} className="text-emerald-400 flex-shrink-0 mt-0.5" /> {p}
                </li>
              ))}
            </ul>
          </div>

          {deal.risks.length > 0 && (
            <div className={`rounded-2xl p-4 border ${deal.risk === 'high' ? 'bg-red-500/8 border-red-500/20' : 'bg-amber-500/8 border-amber-500/20'}`}>
              <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${deal.risk === 'high' ? 'text-red-300' : 'text-amber-300'}`}>
                {t('deals.drawer.riskFactors')}
              </p>
              <ul className="space-y-1">
                {deal.risks.map((r, i) => (
                  <li key={i} className="text-slate-300 text-xs flex items-start gap-2">
                    <AlertTriangle size={11} className={`flex-shrink-0 mt-0.5 ${deal.risk === 'high' ? 'text-red-400' : 'text-amber-400'}`} /> {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="bg-blue-500/8 border border-blue-500/20 rounded-2xl p-4">
            <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-2">
              <Star size={12} /> {t('deals.drawer.nextActions')}
            </p>
            <ol className="space-y-1.5">
              {deal.nextActions.map((a, i) => (
                <li key={i} className="text-slate-200 text-xs flex items-start gap-2">
                  <span className="text-blue-400 font-bold flex-shrink-0">{i + 1}.</span> {a}
                </li>
              ))}
            </ol>
          </div>

          <div>
            <p className="text-white font-semibold text-xs mb-2">{t('deals.drawer.riskAssessment')}</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: t('deals.drawer.financialRisk'), value: deal.financialRisk },
                { label: t('deals.drawer.timelineRisk'),  value: deal.timelineRisk },
                { label: t('deals.drawer.partyRisk'),     value: deal.partyRisk },
              ].map(({ label, value }) => (
                <div key={label} className="bg-white/4 border border-white/8 rounded-xl p-2.5 text-center">
                  <p className="text-slate-500 text-[9px] mb-1">{label}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${riskBadge[value]}`}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-purple-500/8 border border-purple-500/20 rounded-2xl p-4">
            <p className="text-purple-300 text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
              <DollarSign size={12} /> {t('deals.drawer.commissionBreakdown')}
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: t('deals.drawer.totalCommission'), value: fmt(commission),      sub: `${deal.commissionRate}%` },
                { label: t('deals.drawer.listingAgent'),    value: fmt(agentCommission), sub: deal.agent },
                { label: t('deals.drawer.sellingAgent'),    value: fmt(agentCommission), sub: t('deals.drawer.split') },
              ].map(({ label, value, sub }) => (
                <div key={label}>
                  <p className="text-slate-400 text-[9px] mb-1">{label}</p>
                  <p className="text-white font-bold text-sm">{value}</p>
                  <p className="text-slate-500 text-[9px]">{sub}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-white/3 border border-white/6 rounded-xl">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-300 text-xs font-bold">
              {deal.agent.split(' ').map(w => w[0]).join('')}
            </div>
            <div className="flex-1">
              <p className="text-white text-xs font-medium">{deal.agent}</p>
              <p className="text-slate-500 text-[10px]">{t('deals.drawer.listingAgent')}</p>
            </div>
            <button className="px-3 py-1.5 bg-blue-500 rounded-lg text-xs text-white font-medium hover:bg-blue-600 transition-all">
              <Phone size={12} className="inline mr-1" />{t('deals.drawer.call')}
            </button>
          </div>

          <div className="bg-white/3 border border-white/6 rounded-xl p-3 pb-4">
            <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">{t('deals.drawer.notes')}</p>
            <p className="text-slate-300 text-xs leading-relaxed">{deal.notes}</p>
          </div>

          <div>
            <p className="text-white font-semibold text-xs mb-3">{t('deals.drawer.documents')}</p>
            {filesLoading ? (
              <div className="flex justify-center py-3">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : files.length > 0 && (
              <div className="space-y-1.5 mb-3">
                {files.map(f => (
                  <div key={f.id} className="flex items-center gap-2 p-2.5 bg-white/3 border border-white/6 rounded-xl">
                    <FileText size={13} className="text-blue-400 flex-shrink-0" />
                    <span className="text-slate-300 text-xs flex-1 truncate">{f.originalName}</span>
                    <span className="text-slate-600 text-[10px] flex-shrink-0">{fmtBytes(f.size)}</span>
                    <a href={f.url} target="_blank" rel="noreferrer"
                      className="text-blue-400 text-[10px] hover:text-blue-300 transition-colors flex-shrink-0">
                      {t('deals.drawer.download')}
                    </a>
                  </div>
                ))}
              </div>
            )}
            <FileUploader
              entityType="deal"
              entityId={deal.id}
              accept="application/pdf,image/*"
              hint={t('deals.drawer.pdfHint')}
              onUploadSuccess={file => setFiles(prev => [file, ...prev])}
            />
          </div>
        </div>
      </div>
    </>
  )
}
