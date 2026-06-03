import { Clock, Eye, AlertTriangle, Flame, CheckCircle, MessageSquare } from 'lucide-react'
import { useLang } from '../../context/LanguageContext'

const stageColorMap = {
  freshLead:     'bg-slate-500/15 text-slate-300 border-slate-500/25',
  qualified:     'bg-blue-500/15 text-blue-300 border-blue-500/25',
  callBack:      'bg-amber-500/15 text-amber-300 border-amber-500/25',
  followUp:      'bg-purple-500/15 text-purple-300 border-purple-500/25',
  notInterested: 'bg-red-500/15 text-red-300 border-red-500/25',
  lowBudget:     'bg-orange-500/15 text-orange-300 border-orange-500/25',
  reservation:   'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
}

const stageLabelKey = {
  freshLead:     'ui.stageFreshLead',
  qualified:     'ui.stageQualified',
  callBack:      'ui.stageCallBack',
  followUp:      'ui.stageFollowUp',
  notInterested: 'ui.stageNotInterested',
  lowBudget:     'ui.stageLowBudget',
  reservation:   'ui.stageReservation',
}

function ScoreBar({ score }) {
  const color = score >= 85 ? 'bg-emerald-400' : score >= 70 ? 'bg-blue-400' : score >= 55 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-xs font-bold tabular-nums ${color.replace('bg-', 'text-')}`}>{score}</span>
    </div>
  )
}

function ReadinessDot({ value }) {
  const color = value >= 80 ? '#10b981' : value >= 60 ? '#3b82f6' : value >= 40 ? '#f59e0b' : '#ef4444'
  return (
    <div className="relative w-8 h-8 flex-shrink-0">
      <svg width="32" height="32" viewBox="0 0 32 32">
        <circle cx="16" cy="16" r="13" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
        <circle cx="16" cy="16" r="13" fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={`${(value / 100) * 81.7} 81.7`} strokeLinecap="round" transform="rotate(-90 16 16)" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold" style={{ color }}>{value}</span>
    </div>
  )
}

export default function LeadCard({ lead, onClick, selectable = false, selected = false, onSelect, onComments, viewMode = 'card' }) {
  const { t } = useLang()
  const isNeglected = lead.lastContact >= 7
  const isHot = lead.score >= 85
  const stageColor = stageColorMap[lead.stage] ?? stageColorMap.freshLead
  const stageLbl   = t(stageLabelKey[lead.stage] ?? 'ui.stageFreshLead')

  function handleClick() {
    if (selectable) { onSelect?.(lead.id); return }
    onClick(lead)
  }

  if (viewMode === 'list') {
    return (
      <div
        onClick={handleClick}
        className={`bg-card card-border rounded-xl px-3 py-2.5 cursor-pointer transition-all hover:border-blue-500/30 flex items-center gap-3 relative overflow-hidden
          ${isNeglected && !selected ? 'border-red-500/25' : ''}
          ${selected ? 'border-blue-500/60 ring-1 ring-blue-500/30 shadow-md shadow-blue-500/10' : ''}`}
      >
        {selectable && (
          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all
            ${selected ? 'bg-blue-500 border-blue-500' : 'bg-white/5 border-white/20'}`}>
            {selected && <svg width="8" height="6" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </div>
        )}

        {/* Avatar */}
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0"
          style={{ backgroundColor: `${lead.color}20`, border: `1px solid ${lead.color}40`, color: lead.color }}
        >
          {lead.avatar}
        </div>

        {/* Name + badges */}
        <div className="w-40 flex-shrink-0 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="text-white text-xs font-semibold truncate">{lead.name}</p>
            {isHot && <Flame size={10} className="text-amber-400 flex-shrink-0" />}
            {lead.preApproved && <CheckCircle size={10} className="text-emerald-400 flex-shrink-0" />}
            {isNeglected && <AlertTriangle size={10} className="text-red-400 flex-shrink-0" />}
          </div>
          <span className="text-slate-500 text-[9px] truncate block">{lead.type} · {lead.source}</span>
        </div>

        {/* Stage */}
        <span className={`flex-shrink-0 text-[9px] font-medium px-1.5 py-0.5 rounded-full border ${stageColor} hidden sm:inline-flex`}>
          {stageLbl}
        </span>

        {/* Budget */}
        <div className="flex-shrink-0 w-16 hidden md:block">
          <span className="text-white text-[10px] font-medium">{lead.budget ? `$${(lead.budget / 1_000_000).toFixed(1)}M` : '—'}</span>
        </div>

        {/* Interest · Location */}
        <div className="flex-1 min-w-0 hidden lg:block">
          <span className="text-slate-400 text-[10px] truncate block">{lead.interest} · {lead.location}</span>
        </div>

        {/* Score bar */}
        <div className="w-24 flex-shrink-0 hidden md:block">
          <ScoreBar score={lead.score} />
        </div>

        {/* Last contact */}
        <span className={`flex-shrink-0 flex items-center gap-1 text-[10px] w-20 hidden sm:flex ${isNeglected ? 'text-red-400 font-medium' : 'text-slate-500'}`}>
          <Clock size={9} />
          {lead.lastContact === 0 ? t('ui.today') : `${lead.lastContact}d ago`}
        </span>

        {/* Agent */}
        <span className="shrink-0 text-slate-400 text-[10px] min-w-0 truncate hidden xl:block text-right">{lead.agent}</span>
      </div>
    )
  }

  return (
    <div
      onClick={handleClick}
      className={`bg-card card-border rounded-2xl p-4 cursor-pointer transition-all hover:border-blue-500/30 hover:shadow-lg hover:shadow-blue-500/5 relative
        ${isNeglected && !selected ? 'border-red-500/25' : ''}
        ${selected ? 'border-blue-500/60 ring-1 ring-blue-500/30 shadow-lg shadow-blue-500/10' : ''}`}
    >
      {selectable && (
        <div className={`absolute top-3 end-3 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all z-10
          ${selected ? 'bg-blue-500 border-blue-500' : 'bg-white/5 border-white/20'}`}>
          {selected && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        </div>
      )}

      <div className="flex items-start gap-3 mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
          style={{ backgroundColor: `${lead.color}20`, border: `1px solid ${lead.color}40`, color: lead.color }}
        >
          {lead.avatar}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-white text-sm font-semibold truncate">{lead.name}</p>
            {isHot && <Flame size={12} className="text-amber-400 flex-shrink-0" />}
            {lead.preApproved && <CheckCircle size={11} className="text-emerald-400 flex-shrink-0" />}
            {isNeglected && <AlertTriangle size={11} className="text-red-400 flex-shrink-0" />}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${stageColor}`}>
              {stageLbl}
            </span>
            <span className="text-slate-500 text-[10px]">{lead.type} · {lead.source}</span>
          </div>
        </div>
        <ReadinessDot value={lead.readiness} />
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-3 text-xs">
        <div><span className="text-slate-500">{t('ui.budget')}: </span><span className="text-white font-medium">{lead.budget ? `$${(lead.budget / 1_000_000).toFixed(1)}M` : '—'}</span></div>
        <div><span className="text-slate-500">{t('ui.interest')}: </span><span className="text-slate-300">{lead.interest}</span></div>
        <div><span className="text-slate-500">{t('ui.location')}: </span><span className="text-slate-300">{lead.location}</span></div>
        <div>
          <span className="text-slate-500">{t('ui.timeline')}: </span>
          <span className={`font-medium ${lead.timeline <= 30 ? 'text-amber-400' : lead.timeline <= 60 ? 'text-blue-300' : 'text-slate-400'}`}>
            {lead.timeline}d
          </span>
        </div>
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-slate-500 text-[10px] uppercase tracking-wider">{t('ui.leadScore')}</span>
          <span className="text-slate-500 text-[10px]">{t('ui.conv')}: {lead.conversionProbability}%</span>
        </div>
        <ScoreBar score={lead.score} />
      </div>

      <div className="flex flex-wrap gap-1 mb-3">
        {lead.tags.slice(0, 3).map((tag) => (
          <span key={tag} className="text-[9px] text-slate-400 bg-white/5 border border-white/8 px-1.5 py-0.5 rounded-md">{tag}</span>
        ))}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-white/5 text-[10px]">
        <div className="flex items-center gap-3 text-slate-500">
          <span className="flex items-center gap-1"><Eye size={10} /> {lead.propertiesViewed} {t('ui.viewed')}</span>
          <span className={`flex items-center gap-1 ${isNeglected ? 'text-red-400 font-medium' : ''}`}>
            <Clock size={10} />
            {lead.lastContact === 0 ? t('ui.today') : `${lead.lastContact} ${t('ui.daysAgo')}`}
          </span>
        </div>
        <span className="text-slate-400">{lead.agent}</span>
      </div>

      {isNeglected && (
        <div className="mt-2 pt-2 border-t border-red-500/15">
          <p className="text-red-400 text-[9px] flex items-center gap-1">
            <AlertTriangle size={9} /> {t('ui.noContact')} {lead.lastContact} {t('ui.daysUrgent')}
          </p>
        </div>
      )}

      {selectable && (
        <div className="mt-2 pt-2 border-t border-white/5">
          <button
            onClick={e => { e.stopPropagation(); onComments?.(lead) }}
            className="flex items-center gap-1.5 w-full justify-center py-1.5 rounded-lg bg-white/5 border border-white/8 text-slate-400 hover:text-blue-300 hover:bg-blue-500/10 hover:border-blue-500/25 transition-all text-[10px] font-medium"
          >
            <MessageSquare size={10} /> {t('ui.comments')}
          </button>
        </div>
      )}
    </div>
  )
}
