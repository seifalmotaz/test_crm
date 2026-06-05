import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Phone, Mail, Star, AlertTriangle, CheckCircle, Clock, Eye, TrendingUp, User, Flame, Calendar, MessageCircle, Zap, Send, ArrowRightCircle, UserCheck, Pencil, Trash2, Building2, UserPlus, ExternalLink } from 'lucide-react'
import api from '../../lib/api'
import { useLang } from '../../context/LanguageContext'
import { useAuth } from '../../context/AuthContext'

const stageColors = {
  freshLead:     'bg-slate-500/20 text-slate-300',
  qualified:     'bg-blue-500/20 text-blue-300',
  callBack:      'bg-amber-500/20 text-amber-300',
  followUp:      'bg-purple-500/20 text-purple-300',
  notInterested: 'bg-red-500/20 text-red-300',
  lowBudget:     'bg-orange-500/20 text-orange-300',
  reservation:   'bg-emerald-500/20 text-emerald-300',
}

const stageBorder = {
  freshLead:     'border-slate-500/50 bg-slate-500/10 text-slate-200',
  qualified:     'border-blue-500/50 bg-blue-500/10 text-blue-200',
  callBack:      'border-amber-500/50 bg-amber-500/10 text-amber-200',
  followUp:      'border-purple-500/50 bg-purple-500/10 text-purple-200',
  notInterested: 'border-red-500/50 bg-red-500/10 text-red-200',
  lowBudget:     'border-orange-500/50 bg-orange-500/10 text-orange-200',
  reservation:   'border-emerald-500/50 bg-emerald-500/10 text-emerald-200',
}

const historyIcons = {
  view: Eye, call: Phone, request: Star, form: User, action: MessageCircle, email: Mail, meeting: Calendar,
}

function fmt(v) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v}`
}

function ScoreBreakdown({ breakdown, scoreLabels }) {
  const max = { budget_confirmed: 25, timeline_urgency: 20, engagement: 20, recent_activity: 15, property_match: 20 }
  return (
    <div className="space-y-2">
      {Object.entries(breakdown).map(([k, v]) => {
        const m = max[k] ?? 25
        return (
          <div key={k}>
            <div className="flex items-center justify-between mb-1 text-[10px]">
              <span className="text-slate-400">{scoreLabels[k]}</span>
              <span className="text-white font-medium">{v}/{m}</span>
            </div>
            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-blue-400 rounded-full" style={{ width: `${(v / m) * 100}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

const TYPES     = ['Individual', 'Family', 'Investor', 'Corporate']
const SOURCES   = ['Referral', 'Website', 'Social Media', 'Cold Call', 'Portal (Zillow)']
const INTERESTS = ['Apartment', 'Villa', 'Commercial', 'Townhouse', 'Land']

export default function LeadDrawer({ lead, onClose, onUpdate, agents = [] }) {
  const { t } = useLang()
  const { user } = useAuth()
  const isAgent = user?.role === 'agent'

  const stageLabels = {
    freshLead: t('leads.stages.freshLead'), qualified: t('leads.stages.qualified'), callBack: t('leads.stages.callBack'),
    followUp: t('leads.stages.followUp'), notInterested: t('leads.stages.notInterested'), lowBudget: t('leads.stages.lowBudget'), reservation: t('leads.stages.reservation'),
  }

  const scoreLabels = t('leads.drawer.scoreLabels')

  const [tab, setTab]               = useState('overview')
  const [currentStage, setCurrentStage] = useState(lead?.stage)
  const [currentVersion, setCurrentVersion] = useState(lead?.version ?? 1)
  const [stageError, setStageError] = useState('')
  const [interactions, setInteractions] = useState([])
  const [showConvert, setShowConvert]   = useState(false)
  const [properties, setProperties]     = useState([])
  const [selectedProp, setSelectedProp] = useState('')
  const [commissionRate, setCommissionRate] = useState('')
  const [converting, setConverting]     = useState(false)
  const [convertError, setConvertError] = useState('')
  const navigate = useNavigate()
  const [loadingIA, setLoadingIA]   = useState(false)
  const [comment, setComment]       = useState('')
  const [actionDate, setActionDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [posting, setPosting]       = useState(false)
  const [stageSaving, setStageSaving] = useState(false)

  // agent assignment
  const [selectedAgent, setSelectedAgent] = useState(lead?.agentId || '')
  const [agentSaving, setAgentSaving]     = useState(false)
  const [agentError, setAgentError]       = useState('')
  const [agentSuccess, setAgentSuccess]   = useState(false)
  const [duplicateWarn, setDuplicateWarn] = useState(false)
  const [previousWarn,  setPreviousWarn]  = useState(false) // true = was previously with this agent

  // edit lead
  const [showEdit, setShowEdit]   = useState(false)
  const [editForm, setEditForm]   = useState({})
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError]   = useState('')

  // delete
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting]           = useState(false)

  useEffect(() => {
    if (!lead) return
    setTab('overview')
    setCurrentStage(lead.stage)
    setCurrentVersion(lead.version ?? 1)
    setStageError('')
    setComment('')
    setInteractions([])
    setShowConvert(false)
    setSelectedProp('')
    setCommissionRate('')
    setConvertError('')
    setSelectedAgent(lead.agentId || '')
    setAgentError('')
    setAgentSuccess(false)
    setDuplicateWarn(false)
    setShowEdit(false)
    setEditForm({})
    setEditError('')
    setConfirmDelete(false)
  }, [lead?.id])

  useEffect(() => {
    if (tab === 'actions' && lead?.id && interactions.length === 0) {
      loadInteractions()
    }
  }, [tab])

  async function loadInteractions() {
    setLoadingIA(true)
    try {
      const res = await api.get(`/api/leads/${lead.id}/interactions`)
      setInteractions(res.data || [])
    } catch {}
    finally { setLoadingIA(false) }
  }

  async function handleStageChange(stage) {
    if (stage === currentStage || stageSaving) return
    setStageSaving(true)
    setStageError('')
    try {
      await api.patch(`/api/leads/${lead.id}`, { stage, version: currentVersion })
      setCurrentStage(stage)
      setCurrentVersion(v => v + 1)
      onUpdate?.()
    } catch (err) {
      setStageError(err.message || 'Failed to update stage')
    } finally { setStageSaving(false) }
  }

  async function handleAddComment() {
    if (!comment.trim() || posting) return
    setPosting(true)
    try {
      const res = await api.post(`/api/leads/${lead.id}/interactions`, {
        action: comment.trim(),
        type: 'action',
        date: actionDate ? new Date(actionDate).toISOString() : undefined,
      })
      setInteractions(prev => [res.data, ...prev])
      setComment('')
      setActionDate(new Date().toISOString().slice(0, 10))
    } catch {}
    finally { setPosting(false) }
  }

  function handleCall() {
    window.location.href = `tel:${lead.phone}`
    api.post(`/api/leads/${lead.id}/interactions`, {
      action: `Called ${lead.name}`,
      type: 'call',
      date: new Date().toISOString(),
    }).catch(() => {})
  }

  function handleMessage() {
    window.location.href = `mailto:${lead.email}`
  }

  async function handleAssignAgent(force = false) {
    if (!selectedAgent || agentSaving) return
    if (!force && selectedAgent === lead.agentId) {
      setDuplicateWarn(true)
      return
    }
    if (!force && lead.previousAgentIds?.includes(selectedAgent)) {
      setPreviousWarn(true)
      return
    }
    setDuplicateWarn(false)
    setAgentSaving(true)
    setAgentError('')
    setAgentSuccess(false)
    try {
      await api.patch(`/api/leads/${lead.id}`, { agentId: selectedAgent, version: currentVersion })
      setCurrentVersion(v => v + 1)
      setAgentSuccess(true)
      onUpdate?.()
      setTimeout(() => setAgentSuccess(false), 2500)
    } catch (err) {
      setAgentError(err.message || 'Failed to assign agent')
    } finally { setAgentSaving(false) }
  }

  async function handleDuplicateDelete() {
    setDuplicateWarn(false)
    setDeleting(true)
    try {
      await api.delete(`/api/leads/${lead.id}`)
      onUpdate?.()
      onClose()
    } catch {
      setDeleting(false)
    }
  }

  function openEdit() {
    setEditForm({
      name: lead.name, email: lead.email, phone: lead.phone,
      type: lead.type, source: lead.source,
      budget: lead.budget || '', interest: lead.interest,
      location: lead.location, timeline: lead.timeline,
      notes: lead.notes || '', project: lead.project || '',
    })
    setEditError('')
    setShowEdit(true)
  }

  async function handleSaveEdit() {
    if (editSaving) return
    setEditSaving(true)
    setEditError('')
    try {
      await api.patch(`/api/leads/${lead.id}`, {
        ...editForm,
        budget:   parseFloat(editForm.budget) || 0,
        timeline: parseInt(editForm.timeline) || 30,
        version:  currentVersion,
      })
      setCurrentVersion(v => v + 1)
      setShowEdit(false)
      onUpdate?.()
    } catch (err) {
      setEditError(err.message || 'Failed to save changes')
    } finally { setEditSaving(false) }
  }

  async function handleDelete() {
    if (deleting) return
    setDeleting(true)
    try {
      await api.delete(`/api/leads/${lead.id}`)
      onUpdate?.()
      onClose()
    } catch (err) {
      setConfirmDelete(false)
      setDeleting(false)
    }
  }

  async function openConvertForm() {
    setShowConvert(true)
    if (properties.length === 0) {
      try {
        const res = await api.get('/api/properties?per_page=100&status=Active')
        const list = res.data || []
        setProperties(list)
        if (list.length > 0) setSelectedProp(list[0].id)
      } catch {}
    }
  }

  async function handleConvert() {
    if (!selectedProp || converting) return
    setConverting(true)
    setConvertError('')
    try {
      await api.post(`/api/leads/${lead.id}/convert`, {
        propertyId:     selectedProp,
        agentId:        lead.agentId,
        commissionRate: commissionRate ? parseFloat(commissionRate) : undefined,
      })
      onUpdate?.()
      navigate('/deals')
    } catch (err) {
      setConvertError(err.message || 'Conversion failed')
      setConverting(false)
    }
  }

  if (!lead) return null
  const isHot = lead.score >= 85
  const displayStage = currentStage || lead.stage

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[500px] bg-navy-800 border-l border-blue-500/15 z-50 flex flex-col shadow-2xl">

        {/* Header */}
        <div className="bg-navy-800/95 backdrop-blur-sm border-b border-white/5 px-6 py-4 flex items-start justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
              style={{ backgroundColor: `${lead.color}20`, border: `1px solid ${lead.color}40`, color: lead.color }}
            >
              {lead.avatar}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-white font-bold">{lead.name}</p>
                {isHot && <Flame size={14} className="text-amber-400" />}
              </div>
              <p className="text-slate-400 text-xs">{lead.type} · {lead.source}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all">
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/5 flex-shrink-0 px-6">
          {[
            { key: 'overview', label: t('leads.drawer.tabOverview') },
            { key: 'actions',  label: t('leads.drawer.tabActions'), icon: Zap },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-1 py-3 mr-6 text-xs font-medium border-b-2 transition-all ${
                tab === key
                  ? 'border-blue-400 text-white'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {Icon && <Icon size={11} />}
              {label}
            </button>
          ))}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── OVERVIEW TAB ── */}
          {tab === 'overview' && (
            <div className="px-6 py-5 space-y-5">

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/4 border border-white/8 rounded-2xl p-4 text-center">
                  <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-2">{t('leads.drawer.leadScore')}</p>
                  <p className={`text-4xl font-bold ${lead.score >= 85 ? 'text-emerald-400' : lead.score >= 70 ? 'text-blue-400' : lead.score >= 55 ? 'text-amber-400' : 'text-red-400'}`}>
                    {lead.score}
                  </p>
                  <p className="text-slate-500 text-xs mt-1">{t('leads.drawer.outOf100')}</p>
                </div>
                <div className="bg-white/4 border border-white/8 rounded-2xl p-4 text-center">
                  <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-2">{t('leads.drawer.conversionProbability')}</p>
                  <p className="text-4xl font-bold text-white">{lead.conversionProbability}<span className="text-lg text-slate-400">%</span></p>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full mt-1 inline-block ${stageColors[displayStage] ?? stageColors.freshLead}`}>
                    {stageLabels[displayStage] ?? displayStage}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <a href={`mailto:${lead.email}`} className="flex items-center gap-2 p-2.5 bg-white/4 border border-white/8 rounded-xl hover:bg-white/8 transition-all">
                  <Mail size={13} className="text-blue-400 flex-shrink-0" />
                  <p className="text-slate-300 text-xs truncate">{lead.email}</p>
                </a>
                <a href={`tel:${lead.phone}`} className="flex items-center gap-2 p-2.5 bg-white/4 border border-white/8 rounded-xl hover:bg-white/8 transition-all">
                  <Phone size={13} className="text-emerald-400 flex-shrink-0" />
                  <p className="text-slate-300 text-xs">{lead.phone}</p>
                </a>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {[
                  { icon: Eye,       label: t('leads.drawer.viewed'),      value: lead.propertiesViewed },
                  { icon: Clock,     label: t('leads.drawer.lastContact'), value: lead.lastContact === 0 ? t('leads.drawer.today') : `${lead.lastContact}d` },
                  { icon: Calendar,  label: t('leads.drawer.timeline'),    value: `${lead.timeline}d` },
                  { icon: TrendingUp,label: t('leads.drawer.respTime'),    value: `${lead.responseTime}h` },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="bg-white/4 border border-white/8 rounded-xl p-2.5 text-center">
                    <Icon size={12} className="text-blue-400 mx-auto mb-1" />
                    <p className="text-white text-sm font-bold">{value}</p>
                    <p className="text-slate-500 text-[9px]">{label}</p>
                  </div>
                ))}
              </div>

              {lead.readinessFactors.length > 0 && (
                <div className="bg-white/3 border border-white/6 rounded-2xl p-4">
                  <p className="text-white font-semibold text-xs mb-3 flex items-center gap-2">
                    <CheckCircle size={13} className="text-emerald-400" /> {t('leads.drawer.buyerReadiness')}
                  </p>
                  <div className="space-y-1.5">
                    {lead.readinessFactors.map((f, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
                        <span className="text-emerald-400 flex-shrink-0 mt-0.5">✓</span>
                        {f}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {Object.keys(lead.scoreBreakdown).length > 0 && (
                <div>
                  <p className="text-white font-semibold text-xs mb-3">{t('leads.drawer.scoreBreakdown')}</p>
                  <ScoreBreakdown breakdown={lead.scoreBreakdown} scoreLabels={scoreLabels} />
                </div>
              )}

              {lead.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {lead.tags.map((t) => (
                    <span key={t} className="text-xs text-blue-300 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-lg">
                      {t}
                    </span>
                  ))}
                </div>
              )}

              {lead.nextAction && (
                <div className="bg-blue-500/8 border border-blue-500/20 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Star size={13} className="text-blue-400" />
                    <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider">{t('leads.drawer.recommendedAction')}</p>
                  </div>
                  <p className="text-slate-200 text-sm leading-relaxed mb-2">{lead.nextAction}</p>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                    <User size={10} />
                    {t('leads.drawer.assignTo')} <span className="text-white font-medium">{lead.recommendedAgent}</span>
                  </div>
                </div>
              )}

              {lead.suggestedProperties.length > 0 && (
                <div>
                  <p className="text-white font-semibold text-xs mb-2">{t('leads.drawer.suggestedProperties')}</p>
                  <div className="space-y-1.5">
                    {lead.suggestedProperties.map((p, i) => (
                      <div key={i} className="flex items-center gap-2 p-2.5 bg-white/3 border border-white/6 rounded-xl text-xs text-slate-300 hover:bg-white/6 cursor-pointer transition-all">
                        <span className="text-blue-400 font-bold text-[10px] w-4">#{i + 1}</span>
                        <span>🏠</span>
                        {p}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {lead.opportunities.length > 0 && (
                <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp size={13} className="text-emerald-400" />
                    <p className="text-emerald-300 text-xs font-semibold uppercase tracking-wider">{t('leads.drawer.opportunities')}</p>
                  </div>
                  <ul className="space-y-1">
                    {lead.opportunities.map((o, i) => (
                      <li key={i} className="text-slate-300 text-xs flex items-start gap-2">
                        <span className="text-emerald-400">·</span> {o}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {lead.concerns.length > 0 && (
                <div className="bg-amber-500/8 border border-amber-500/20 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={13} className="text-amber-400" />
                    <p className="text-amber-300 text-xs font-semibold uppercase tracking-wider">{t('leads.drawer.watchPoints')}</p>
                  </div>
                  <ul className="space-y-1">
                    {lead.concerns.map((c, i) => (
                      <li key={i} className="text-slate-300 text-xs flex items-start gap-2">
                        <span className="text-amber-400">·</span> {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {lead.history.length > 0 && (
                <div>
                  <p className="text-white font-semibold text-xs mb-3">{t('leads.drawer.activityHistory')}</p>
                  <div className="space-y-2 relative pl-4">
                    <div className="absolute left-1.5 top-0 bottom-0 w-px bg-white/8" />
                    {lead.history.map((h, i) => {
                      const Icon = historyIcons[h.type] ?? Clock
                      return (
                        <div key={i} className="relative flex items-start gap-3">
                          <div className="absolute -left-2.5 mt-0.5 w-4 h-4 rounded-full bg-navy-700 border border-blue-500/30 flex items-center justify-center">
                            <Icon size={8} className="text-blue-400" />
                          </div>
                          <div className="ml-2">
                            <p className="text-slate-300 text-xs">{h.action}</p>
                            <p className="text-slate-600 text-[10px]">{h.date}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {lead.notes && (
                <div className="bg-white/3 border border-white/6 rounded-xl p-3">
                  <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">{t('leads.drawer.agentNotes')}</p>
                  <p className="text-slate-300 text-xs leading-relaxed">{lead.notes}</p>
                </div>
              )}

              {!isAgent && (
                <div className="bg-white/3 border border-white/6 rounded-xl p-3 space-y-2.5">
                  <p className="text-slate-400 text-[10px] uppercase tracking-wider">Lead Info</p>
                  <div className="flex items-center gap-2">
                    <Building2 size={11} className="text-blue-400 flex-shrink-0" />
                    <span className="text-slate-400 text-[10px] w-16 flex-shrink-0">Project</span>
                    <span className={`text-xs font-medium ${lead.project ? 'text-slate-200' : 'text-slate-500'}`}>
                      {lead.project || '—'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <UserPlus size={11} className="text-emerald-400 flex-shrink-0" />
                    <span className="text-slate-400 text-[10px] w-16 flex-shrink-0">Added by</span>
                    {lead.createdByName ? (
                      lead.createdByAgentId ? (
                        <button
                          onClick={() => { navigate('/agents'); onClose() }}
                          className="flex items-center gap-1 text-xs text-emerald-300 hover:text-emerald-200 transition-colors"
                        >
                          {lead.createdByName}
                          <ExternalLink size={9} />
                        </button>
                      ) : (
                        <span className="text-slate-200 text-xs">{lead.createdByName}</span>
                      )
                    ) : (
                      <span className="text-slate-500 text-xs">—</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar size={11} className="text-amber-400 flex-shrink-0" />
                    <span className="text-slate-400 text-[10px] w-16 flex-shrink-0">Added on</span>
                    <span className="text-slate-200 text-xs">
                      {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pb-2">
                <button
                  onClick={handleMessage}
                  className="flex items-center justify-center gap-2 py-2.5 bg-white/5 border border-white/10 rounded-xl text-slate-300 text-xs font-medium hover:bg-white/10 transition-all"
                >
                  <MessageCircle size={13} /> {t('leads.drawer.sendMessage')}
                </button>
                <button
                  onClick={handleCall}
                  className="flex items-center justify-center gap-2 py-2.5 bg-blue-500 rounded-xl text-white text-xs font-medium hover:bg-blue-600 transition-all"
                >
                  <Phone size={13} /> {t('leads.drawer.callNow')}
                </button>
              </div>
            </div>
          )}

          {/* ── ACTIONS TAB ── */}
          {tab === 'actions' && (
            <div className="px-6 py-5 space-y-6">

              {/* Stage selector */}
              <div>
                <p className="text-white font-semibold text-xs mb-1">{t('leads.drawer.changeStage')}</p>
                <p className="text-slate-500 text-[10px] mb-3">{t('leads.drawer.current')}: <span className={`font-medium px-1.5 py-0.5 rounded ${stageColors[displayStage]}`}>{stageLabels[displayStage]}</span></p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(stageLabels).map(([key, label]) => {
                    const isActive = key === displayStage
                    return (
                      <button
                        key={key}
                        onClick={() => handleStageChange(key)}
                        disabled={isActive || stageSaving}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium transition-all text-left ${
                          isActive
                            ? `${stageBorder[key]} border-2`
                            : 'border-white/10 bg-white/3 text-slate-400 hover:bg-white/8 hover:text-white hover:border-white/20'
                        } disabled:cursor-not-allowed`}
                      >
                        {isActive && <CheckCircle size={11} className="flex-shrink-0 opacity-70" />}
                        {label}
                        {isActive && <span className="ml-auto text-[9px] opacity-60">{t('leads.drawer.current')}</span>}
                      </button>
                    )
                  })}
                </div>
                {stageError && (
                  <p className="mt-2 text-red-400 text-xs flex items-center gap-1">
                    <AlertTriangle size={11} /> {stageError}
                  </p>
                )}
              </div>

              {/* Assign Agent — hidden for agents */}
              {!isAgent && <div className="border-t border-white/5 pt-6">
                <p className="text-white font-semibold text-xs mb-1 flex items-center gap-2">
                  <UserCheck size={13} className="text-blue-400" /> {t('leads.drawer.assignAgent')}
                </p>
                <p className="text-slate-500 text-[10px] mb-3">
                  {t('leads.drawer.current')}: <span className="text-slate-300 font-medium">{lead.agent || '—'}</span>
                  <span className="ml-2 text-slate-600">· {t('leads.drawer.adminsView')}</span>
                </p>

                {!duplicateWarn && !previousWarn ? (
                  <>
                    <div className="flex gap-2">
                      <select
                        value={selectedAgent}
                        onChange={e => { setSelectedAgent(e.target.value); setAgentSuccess(false); setDuplicateWarn(false); setPreviousWarn(false) }}
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50"
                      >
                        <option value="" className="bg-slate-800">{t('leads.drawer.selectAgent')}</option>
                        {agents.map(a => (
                          <option key={a.id} value={a.id} className="bg-slate-800">{a.name}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleAssignAgent(false)}
                        disabled={!selectedAgent || agentSaving}
                        className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-white text-xs font-medium transition-all"
                      >
                        {agentSaving ? '…' : agentSuccess ? t('leads.drawer.saved') : t('leads.drawer.assign')}
                      </button>
                    </div>
                    {agentError && (
                      <p className="mt-2 text-red-400 text-xs flex items-center gap-1">
                        <AlertTriangle size={11} /> {agentError}
                      </p>
                    )}
                  </>
                ) : duplicateWarn ? (
                  /* Already assigned to this agent */
                  <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
                      <p className="text-amber-200 text-xs leading-relaxed">
                        {t('leads.drawer.alreadyAssigned')} <span className="font-semibold">{lead.agent}</span>. {t('leads.drawer.whatToDo')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setDuplicateWarn(false)}
                        className="flex-1 py-2 bg-white/5 border border-white/10 rounded-xl text-slate-400 text-xs hover:text-white transition-all"
                      >
                        {t('leads.drawer.cancel')}
                      </button>
                      <button
                        onClick={() => handleAssignAgent(true)}
                        disabled={agentSaving}
                        className="flex-1 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 rounded-xl text-white text-xs font-semibold transition-all"
                      >
                        {agentSaving ? '…' : t('leads.drawer.reassignAnyway')}
                      </button>
                      <button
                        onClick={handleDuplicateDelete}
                        disabled={deleting}
                        className="flex-1 py-2 bg-red-500/15 border border-red-500/30 hover:bg-red-500/25 rounded-xl text-red-400 text-xs font-semibold transition-all"
                      >
                        {deleting ? '…' : t('leads.drawer.deleteLead')}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Previously assigned to this agent */
                  <div className="bg-blue-500/10 border border-blue-500/25 rounded-xl p-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle size={14} className="text-blue-400 flex-shrink-0 mt-0.5" />
                      <p className="text-blue-200 text-xs leading-relaxed">
                        {t('leads.drawer.previouslyWith')}{' '}
                        <span className="font-semibold">
                          {agents.find(a => a.id === selectedAgent)?.name ?? 'this agent'}
                        </span>
                        . {t('leads.drawer.returnToThem')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPreviousWarn(false)}
                        className="flex-1 py-2 bg-white/5 border border-white/10 rounded-xl text-slate-400 text-xs hover:text-white transition-all"
                      >
                        {t('leads.drawer.cancel')}
                      </button>
                      <button
                        onClick={() => handleAssignAgent(true)}
                        disabled={agentSaving}
                        className="flex-1 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 rounded-xl text-white text-xs font-semibold transition-all"
                      >
                        {agentSaving ? '…' : t('leads.drawer.yesReturn')}
                      </button>
                    </div>
                  </div>
                )}
              </div>}

              <div className="border-t border-white/5" />

              {/* Add comment */}
              <div>
                <p className="text-white font-semibold text-xs mb-3 flex items-center gap-2">
                  <MessageCircle size={13} className="text-blue-400" /> {t('leads.drawer.addComment')}
                </p>
                <div className="mb-2">
                  <label className="text-slate-500 text-[10px] uppercase tracking-wider mb-1 block">{t('leads.drawer.date')}</label>
                  <input
                    type="date"
                    value={actionDate}
                    onChange={e => setActionDate(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 transition-all [color-scheme:dark]"
                  />
                </div>
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAddComment() }}
                  placeholder={t('leads.drawer.writeComment')}
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-all resize-none"
                />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-slate-600 text-[10px]">{t('leads.drawer.ctrlEnter')}</span>
                  <button
                    onClick={handleAddComment}
                    disabled={!comment.trim() || posting}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-white text-xs font-medium transition-all"
                  >
                    <Send size={11} /> {posting ? t('leads.drawer.posting') : t('leads.drawer.post')}
                  </button>
                </div>
              </div>

              {/* Convert to Deal — only shown when stage is Reservation */}
              {currentStage !== 'reservation' && (
                <div className="border-t border-white/5 pt-4">
                  <p className="text-slate-600 text-[10px] text-center flex items-center justify-center gap-1.5">
                    <ArrowRightCircle size={11} />
                    {t('leads.drawer.moveToReservation')}
                  </p>
                </div>
              )}
              {currentStage === 'reservation' && (
              <div className="border-t border-white/5 pt-6">
                <p className="text-white font-semibold text-xs mb-1 flex items-center gap-2">
                  <ArrowRightCircle size={13} className="text-emerald-400" /> {t('leads.drawer.convertToDeal')}
                </p>
                <p className="text-slate-500 text-[10px] mb-3">{t('leads.drawer.moveToPipeline')}</p>

                {!showConvert ? (
                  <button
                    onClick={openConvertForm}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs font-medium hover:bg-emerald-500/25 transition-all"
                  >
                    <ArrowRightCircle size={13} /> {t('leads.drawer.convertToDeal')}
                  </button>
                ) : (
                  <div className="space-y-3 bg-white/3 border border-white/8 rounded-xl p-4">
                    <div>
                      <label className="text-slate-500 text-[10px] uppercase tracking-wider mb-1 block">{t('leads.drawer.property')}</label>
                      {properties.length === 0 ? (
                        <div className="flex items-center gap-2 text-slate-500 text-xs py-2">
                          <div className="w-3 h-3 border border-slate-500 border-t-transparent rounded-full animate-spin" />
                          {t('leads.drawer.loadingProperties')}
                        </div>
                      ) : (
                        <select
                          value={selectedProp}
                          onChange={e => setSelectedProp(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50"
                        >
                          {properties.map(p => (
                            <option key={p.id} value={p.id} className="bg-slate-800">
                              {p.address} — {p.type}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div>
                      <label className="text-slate-500 text-[10px] uppercase tracking-wider mb-1 block">{t('leads.drawer.commissionRate')}</label>
                      <input
                        type="number"
                        value={commissionRate}
                        onChange={e => setCommissionRate(e.target.value)}
                        placeholder="e.g. 2.5"
                        min="0" max="100" step="0.1"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50"
                      />
                    </div>
                    {convertError && (
                      <p className="text-red-400 text-xs flex items-center gap-1">
                        <AlertTriangle size={11} /> {convertError}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setShowConvert(false); setConvertError('') }}
                        className="flex-1 py-2 bg-white/5 border border-white/10 rounded-xl text-slate-400 text-xs hover:text-white hover:bg-white/8 transition-all"
                      >
                        {t('leads.drawer.cancel')}
                      </button>
                      <button
                        onClick={handleConvert}
                        disabled={!selectedProp || converting}
                        className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-white text-xs font-semibold transition-all"
                      >
                        {converting ? t('leads.drawer.converting') : t('leads.drawer.convertAndGo')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              )}

              {/* Edit Lead */}
              <div className="border-t border-white/5 pt-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-white font-semibold text-xs flex items-center gap-2">
                    <Pencil size={13} className="text-blue-400" /> {t('leads.drawer.editLead')}
                  </p>
                  <button
                    onClick={() => showEdit ? setShowEdit(false) : openEdit()}
                    className="text-xs text-slate-400 hover:text-white transition-colors"
                  >
                    {showEdit ? t('leads.drawer.cancel') : t('leads.drawer.edit')}
                  </button>
                </div>
                {showEdit && (
                  <div className="space-y-3 bg-white/3 border border-white/8 rounded-xl p-4">
                    {[
                      { label: t('leads.drawer.name'),        key: 'name',     type: 'text' },
                      { label: t('leads.drawer.email'),       key: 'email',    type: 'email' },
                      { label: t('leads.drawer.phone'),       key: 'phone',    type: 'text' },
                      { label: t('leads.drawer.location'),    key: 'location', type: 'text' },
                      { label: t('leads.drawer.budget'),      key: 'budget',   type: 'number' },
                      { label: t('leads.drawer.timelineDays'), key: 'timeline', type: 'number' },
                    ].map(({ label, key, type }) => (
                      <div key={key}>
                        <label className="text-slate-500 text-[10px] uppercase tracking-wider mb-1 block">{label}</label>
                        <input
                          type={type}
                          value={editForm[key] ?? ''}
                          onChange={e => setEditForm(p => ({ ...p, [key]: e.target.value }))}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 transition-all"
                        />
                      </div>
                    ))}
                    {[
                      { label: t('leads.drawer.type'),     key: 'type',     options: TYPES },
                      { label: t('leads.drawer.source'),   key: 'source',   options: SOURCES },
                      { label: t('leads.drawer.interest'), key: 'interest', options: INTERESTS },
                    ].map(({ label, key, options }) => (
                      <div key={key}>
                        <label className="text-slate-500 text-[10px] uppercase tracking-wider mb-1 block">{label}</label>
                        <select
                          value={editForm[key] ?? ''}
                          onChange={e => setEditForm(p => ({ ...p, [key]: e.target.value }))}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50"
                        >
                          {options.map(o => <option key={o} value={o} className="bg-slate-800">{o}</option>)}
                        </select>
                      </div>
                    ))}
                    <div>
                      <label className="text-slate-500 text-[10px] uppercase tracking-wider mb-1 block">Project</label>
                      <input
                        type="text"
                        value={editForm.project ?? ''}
                        onChange={e => setEditForm(p => ({ ...p, project: e.target.value }))}
                        placeholder="e.g. Marina Heights…"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 text-[10px] uppercase tracking-wider mb-1 block">{t('leads.drawer.notes')}</label>
                      <textarea
                        value={editForm.notes ?? ''}
                        onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))}
                        rows={2}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 resize-none"
                      />
                    </div>
                    {editError && (
                      <p className="text-red-400 text-xs flex items-center gap-1">
                        <AlertTriangle size={11} /> {editError}
                      </p>
                    )}
                    <button
                      onClick={handleSaveEdit}
                      disabled={editSaving}
                      className="w-full py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 rounded-xl text-white text-xs font-semibold transition-all"
                    >
                      {editSaving ? t('leads.drawer.saving') : t('leads.drawer.saveChanges')}
                    </button>
                  </div>
                )}
              </div>

              {/* Delete Lead */}
              <div className="border-t border-red-500/10 pt-6 pb-2">
                <p className="text-white font-semibold text-xs mb-1 flex items-center gap-2">
                  <Trash2 size={13} className="text-red-400" /> {t('leads.drawer.deleteLeadTitle')}
                </p>
                <p className="text-slate-500 text-[10px] mb-3">{t('leads.drawer.deleteLeadDesc')}</p>
                {!confirmDelete ? (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-500/10 border border-red-500/25 rounded-xl text-red-400 text-xs font-medium hover:bg-red-500/20 transition-all"
                  >
                    <Trash2 size={13} /> {t('leads.drawer.deleteLead')}
                  </button>
                ) : (
                  <div className="bg-red-500/10 border border-red-500/25 rounded-xl p-4 space-y-3">
                    <p className="text-red-300 text-xs font-medium text-center">{t('leads.drawer.confirmDelete')}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setConfirmDelete(false)}
                        className="flex-1 py-2 bg-white/5 border border-white/10 rounded-xl text-slate-400 text-xs hover:text-white transition-all"
                      >
                        {t('leads.drawer.cancel')}
                      </button>
                      <button
                        onClick={handleDelete}
                        disabled={deleting}
                        className="flex-1 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 rounded-xl text-white text-xs font-semibold transition-all"
                      >
                        {deleting ? t('leads.drawer.deleting') : t('leads.drawer.yesDelete')}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Comment history */}
              <div>
                <p className="text-white font-semibold text-xs mb-3">Comment History</p>
                {loadingIA ? (
                  <div className="flex justify-center py-6">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : interactions.length === 0 ? (
                  <div className="text-center py-6">
                    <MessageCircle size={20} className="text-slate-600 mx-auto mb-2" />
                    <p className="text-slate-500 text-xs">No comments yet</p>
                  </div>
                ) : (
                  <div className="space-y-2 relative pl-4">
                    <div className="absolute left-1.5 top-0 bottom-0 w-px bg-white/8" />
                    {interactions.map((item, i) => {
                      const Icon = historyIcons[item.type] ?? Clock
                      const isComment = item.type === 'action'
                      return (
                        <div key={item.id ?? i} className="relative flex items-start gap-3">
                          <div className={`absolute -left-2.5 mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center ${isComment ? 'bg-blue-500/20 border-blue-500/40' : 'bg-navy-700 border-white/10'}`}>
                            <Icon size={8} className={isComment ? 'text-blue-400' : 'text-slate-400'} />
                          </div>
                          <div className="ml-2 flex-1">
                            <p className="text-slate-300 text-xs leading-relaxed">{item.action}</p>
                            {item.notes && <p className="text-slate-500 text-[10px] mt-0.5 italic">{item.notes}</p>}
                            <p className="text-slate-600 text-[10px] mt-0.5">
                              {item.date ? new Date(item.date).toLocaleString() : ''}
                              {!isComment && <span className="ml-2 text-slate-700 capitalize">{item.type}</span>}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      </div>
    </>
  )
}
