import { useState, useMemo, useEffect, useCallback } from 'react'
import { Search, X, Flame, AlertTriangle, CheckCircle, Plus, FileSpreadsheet, Download, SquareCheck, Trash2, UserCheck, LayoutGrid, List } from 'lucide-react'
import { useLang } from '../context/LanguageContext'
import * as XLSX from 'xlsx'
import LeadFunnelBar from '../components/leads/LeadFunnelBar'
import SourcePanel from '../components/leads/SourcePanel'
import LeadCard from '../components/leads/LeadCard'
import LeadDrawer from '../components/leads/LeadDrawer'
import LeadImportModal from '../components/leads/LeadImportModal'
import LeadCommentsModal from '../components/leads/LeadCommentsModal'
import { leadSources } from '../data/leadsData'
import api from '../lib/api'
import { mapLead } from '../lib/mappers'
import { useAuth } from '../context/AuthContext'

const STAGES = ['All', 'freshLead', 'qualified', 'callBack', 'followUp', 'notInterested', 'lowBudget', 'reservation']
const STAGE_LABELS = {
  All: 'All', freshLead: 'Fresh Leads', qualified: 'Qualified', callBack: 'Call Back',
  followUp: 'Follow Up', notInterested: 'Not Interested', lowBudget: 'Low Budget', reservation: 'Reservation',
}
const SORTS = ['Score: High', 'Score: Low', 'Last Contact', 'Timeline', 'Readiness']

const SOURCES = ['Referral', 'Website', 'Social Media', 'Cold Call', 'Portal (Zillow)']
const INTERESTS = ['Apartment', 'Villa', 'Commercial', 'Townhouse', 'Land']
const TYPES = ['Individual', 'Family', 'Investor', 'Corporate']
const API_STAGES = ['freshLead', 'qualified', 'callBack', 'followUp', 'notInterested', 'lowBudget', 'reservation']

function AddLeadModal({ agents, onClose, onSaved }) {
  const { user } = useAuth()
  const isAgent = user?.role === 'agent'
  const [form, setForm] = useState({
    name: '', email: '', phone: '', type: 'Individual', source: 'Website',
    budget: '', interest: 'Apartment', location: '', timeline: 30,
    stage: 'freshLead', agentId: agents[0]?.id || '', notes: '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function set(k, v) { setForm(p => ({ ...p, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await api.post('/api/leads', {
        ...form,
        budget:   parseFloat(form.budget) || 0,
        timeline: parseInt(form.timeline) || 30,
        avatar:   form.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
        color:    '#3b82f6',
        readiness: 0,
      })
      onSaved()
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to add lead')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card card-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-white/8">
          <h2 className="text-white font-semibold">Add Lead</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-slate-400 text-xs mb-1 block">Full Name *</label>
              <input required value={form.name} onChange={e => set('name', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50"
                placeholder="Jane Smith" />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Email *</label>
              <input required type="email" value={form.email} onChange={e => set('email', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50"
                placeholder="jane@email.com" />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Phone *</label>
              <input required value={form.phone} onChange={e => set('phone', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50"
                placeholder="+1 (555) 000-0000" />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Type</label>
              <select value={form.type} onChange={e => set('type', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50">
                {TYPES.map(t => <option key={t} value={t} className="bg-slate-800">{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Source</label>
              <select value={form.source} onChange={e => set('source', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50">
                {SOURCES.map(s => <option key={s} value={s} className="bg-slate-800">{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Budget ($) *</label>
              <input required type="number" value={form.budget} onChange={e => set('budget', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50"
                placeholder="1000000" min="0" />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Interest</label>
              <select value={form.interest} onChange={e => set('interest', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50">
                {INTERESTS.map(i => <option key={i} value={i} className="bg-slate-800">{i}</option>)}
              </select>
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Location *</label>
              <input required value={form.location} onChange={e => set('location', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50"
                placeholder="Downtown" />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Timeline (days)</label>
              <input type="number" value={form.timeline} onChange={e => set('timeline', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
                min="1" />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Stage</label>
              <select value={form.stage} onChange={e => set('stage', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50">
                {API_STAGES.map(s => <option key={s} value={s} className="bg-slate-800">{STAGE_LABELS[s]}</option>)}
              </select>
            </div>
            {!isAgent && agents.length > 0 && (
              <div className="col-span-2">
                <label className="text-slate-400 text-xs mb-1 block">Assign to Agent *</label>
                <select value={form.agentId} onChange={e => set('agentId', e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50">
                  {agents.map(a => <option key={a.id} value={a.id} className="bg-slate-800">{a.name}</option>)}
                </select>
              </div>
            )}
            <div className="col-span-2">
              <label className="text-slate-400 text-xs mb-1 block">Notes</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 resize-none"
                placeholder="Any relevant notes about this lead…" />
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/8 transition-all">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-60 rounded-xl text-sm font-semibold text-white transition-all">
              {saving ? 'Saving…' : 'Add Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function LeadsPage() {
  const { t } = useLang()
  const [leads,      setLeads]      = useState([])
  const [agents,     setAgents]     = useState([])
  const [loading,    setLoading]    = useState(true)
  const [stage,      setStage]      = useState('All')
  const [query,      setQuery]      = useState('')
  const [sort,       setSort]       = useState('Score: High')
  const [showOnly,   setShowOnly]   = useState({ hot: false, neglected: false, preApproved: false })
  const [selected,     setSelected]     = useState(null)
  const [showAdd,      setShowAdd]      = useState(false)
  const [showImport,   setShowImport]   = useState(false)
  // bulk selection
  const [selectMode,   setSelectMode]   = useState(false)
  const [selectedIds,  setSelectedIds]  = useState(new Set())
  const [bulkAgentId,  setBulkAgentId]  = useState('')
  const [bulkWorking,  setBulkWorking]  = useState(false)
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [bulkDuplicateWarn, setBulkDuplicateWarn] = useState(null) // { agentName, dupIds, skipIds }
  const [bulkPreviousWarn,  setBulkPreviousWarn]  = useState(null) // { agentName, prevIds, otherIds }
  const [commentsLead,     setCommentsLead]     = useState(null)
  const [viewMode,         setViewMode]         = useState('card')

  const fetchLeads = useCallback(() => {
    setLoading(true)
    api.get('/api/leads?per_page=100')
      .then(res => setLeads((res.data || []).map(mapLead)))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchLeads()
    api.get('/api/agents?per_page=50')
      .then(res => setAgents(res.data || []))
      .catch(console.error)
  }, [fetchLeads])

  const filtered = useMemo(() => {
    let list = leads.filter((l) => {
      if (stage !== 'All' && l.stage !== stage) return false
      if (query && !`${l.name} ${l.type} ${l.interest} ${l.location} ${l.source} ${l.agent}`.toLowerCase().includes(query.toLowerCase())) return false
      if (showOnly.hot && l.score < 85) return false
      if (showOnly.neglected && l.lastContact < 7) return false
      if (showOnly.preApproved && !l.preApproved) return false
      return true
    })
    return [...list].sort((a, b) => {
      if (sort === 'Score: High') return b.score - a.score
      if (sort === 'Score: Low') return a.score - b.score
      if (sort === 'Last Contact') return a.lastContact - b.lastContact
      if (sort === 'Timeline') return a.timeline - b.timeline
      if (sort === 'Readiness') return b.readiness - a.readiness
      return 0
    })
  }, [leads, stage, query, sort, showOnly])

  const hotCount      = leads.filter(l => l.score >= 85).length
  const neglectedCount = leads.filter(l => l.lastContact >= 7).length

  function exportLeads() {
    const rows = filtered.map(l => ({
      Name:              l.name,
      Email:             l.email,
      Phone:             l.phone,
      Type:              l.type,
      Source:            l.source,
      Stage:             STAGE_LABELS[l.stage] ?? l.stage,
      Budget:            l.budget,
      Interest:          l.interest,
      Location:          l.location,
      'Timeline (days)': l.timeline,
      Score:             l.score,
      'Conversion %':    l.conversionProbability,
      'Last Contact (days)': l.lastContact,
      'Properties Viewed':   l.propertiesViewed,
      'Pre-Approved':    l.preApproved ? 'Yes' : 'No',
      Agent:             l.agent,
      Notes:             l.notes || '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Leads')
    const label = stage !== 'All' ? `_${STAGE_LABELS[stage]?.replace(/\s+/g, '_')}` : ''
    XLSX.writeFile(wb, `leads${label}_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map(l => l.id)))
    }
  }

  function exitSelectMode() {
    setSelectMode(false)
    setSelectedIds(new Set())
    setConfirmBulkDelete(false)
    setBulkDuplicateWarn(null)
    setBulkPreviousWarn(null)
    setBulkAgentId('')
  }

  async function handleBulkAssign() {
    if (!bulkAgentId || bulkWorking) return
    const ids = [...selectedIds]
    const agentName = agents.find(a => a.id === bulkAgentId)?.name ?? 'this agent'

    // Check 1: currently assigned to this agent
    const dupIds  = ids.filter(id => leads.find(l => l.id === id)?.agentId === bulkAgentId)
    const skipIds = ids.filter(id => !dupIds.includes(id))
    if (dupIds.length > 0) {
      setBulkDuplicateWarn({ agentName, dupIds, skipIds })
      return
    }

    // Check 2: previously assigned to this agent (no current duplicates)
    const prevIds  = ids.filter(id => leads.find(l => l.id === id)?.previousAgentIds?.includes(bulkAgentId))
    const otherIds = ids.filter(id => !prevIds.includes(id))
    if (prevIds.length > 0) {
      setBulkPreviousWarn({ agentName, prevIds, otherIds })
      return
    }

    await _doBulkAssign(ids)
  }

  async function _doBulkAssign(ids) {
    setBulkWorking(true)
    for (const id of ids) {
      const lead = leads.find(l => l.id === id)
      if (!lead) continue
      try { await api.patch(`/api/leads/${id}`, { agentId: bulkAgentId, version: lead.version }) } catch {}
    }
    setBulkWorking(false)
    exitSelectMode()
    fetchLeads()
  }

  async function handleBulkDelete() {
    if (bulkWorking) return
    setBulkWorking(true)
    const ids = [...selectedIds]
    for (const id of ids) {
      try { await api.delete(`/api/leads/${id}`) } catch {}
    }
    setBulkWorking(false)
    exitSelectMode()
    fetchLeads()
  }

  const stageCounts = useMemo(() => {
    const c = { All: leads.length }
    API_STAGES.forEach(s => { c[s] = leads.filter(l => l.stage === s).length })
    return c
  }, [leads])

  const funnelStats = {
    totalLeads:          leads.length,
    freshLeads:          leads.filter(l => l.stage === 'freshLead').length,
    qualified:           leads.filter(l => l.stage === 'qualified').length,
    followUp:            leads.filter(l => l.stage === 'followUp' || l.stage === 'callBack').length,
    reservation:         leads.filter(l => l.stage === 'reservation').length,
    conversionRate:      0,
    targetConversionRate: 12,
    avgResponseTime:     leads.length ? (leads.reduce((s, l) => s + (l.responseTime || 0), 0) / leads.length).toFixed(1) : 0,
    targetResponseTime:  0.5,
    avgLeadScore:        leads.length ? Math.round(leads.reduce((s, l) => s + l.score, 0) / leads.length) : 0,
    hotLeads:            hotCount,
    neglectedLeads:      neglectedCount,
    closedThisMonth:     0,
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-white text-xl font-bold tracking-tight">{t('leads.title')}</h1>
          <p className="text-slate-400 text-sm mt-0.5">{t('leads.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => { setSelectMode(s => !s); setSelectedIds(new Set()) }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium border transition-all ${
              selectMode
                ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <SquareCheck size={13} /> {selectMode ? t('leads.assignSelected') : t('common.all')}
          </button>
          <button
            onClick={exportLeads}
            disabled={filtered.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download size={13} className="text-blue-400" /> {t('leads.exportLeads')}
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-all"
          >
            <FileSpreadsheet size={13} className="text-emerald-400" /> {t('leads.importLeads')}
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 rounded-xl text-xs font-medium text-white hover:bg-blue-600 transition-all"
          >
            <Plus size={13} /> {t('leads.addLead')}
          </button>
        </div>
      </div>

      <LeadFunnelBar data={funnelStats} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <div className="bg-card card-border rounded-2xl p-4 mb-4 glow-blue">
            <div className="relative mb-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('leads.searchPlaceholder')}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-all"
              />
              {query && (
                <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap mb-3">
              {STAGES.map((s) => {
                const stageKey = s === 'All' ? 'all' : s
                const count    = stageCounts[s] ?? 0
                const active   = stage === s
                return (
                  <button
                    key={s}
                    onClick={() => setStage(s)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all border ${
                      active
                        ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/8 hover:border-white/20'
                    }`}
                  >
                    {t(`leads.stages.${stageKey}`)}
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded min-w-[18px] text-center leading-none ${
                      active ? 'bg-blue-500/40 text-blue-100' : 'bg-white/10 text-slate-500'
                    }`}>
                      {count}
                    </span>
                  </button>
                )
              })}
              <div className="ms-auto flex items-center gap-2">
                <select value={sort} onChange={e => setSort(e.target.value)}
                  className="appearance-none bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500/50 cursor-pointer">
                  {SORTS.map(s => {
                    const sortKeyMap = { 'Score: High': 'scoreHigh', 'Score: Low': 'scoreLow', 'Last Contact': 'lastContact', 'Timeline': 'timeline', 'Readiness': 'readiness' }
                    return <option key={s} value={s} className="bg-navy-800">{t(`leads.sorts.${sortKeyMap[s]}`)}</option>
                  })}
                </select>
                <div className="flex items-center bg-white/5 border border-white/10 rounded-lg p-0.5">
                  <button
                    onClick={() => setViewMode('card')}
                    title="Card view"
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'card' ? 'bg-blue-500/25 text-blue-300' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    <LayoutGrid size={13} />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    title="List view"
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-blue-500/25 text-blue-300' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    <List size={13} />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-500 text-[10px] uppercase tracking-wider mr-1">Quick:</span>
              {[
                { key: 'hot',        label: `Hot (${hotCount})`,         icon: Flame,         activeColor: 'bg-amber-500/20 border-amber-500/40 text-amber-300' },
                { key: 'neglected',  label: `Neglected (${neglectedCount})`, icon: AlertTriangle, activeColor: 'bg-red-500/20 border-red-500/40 text-red-300' },
                { key: 'preApproved', label: 'Pre-approved',            icon: CheckCircle,   activeColor: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' },
              ].map(({ key, label, icon: Icon, activeColor }) => (
                <button key={key}
                  onClick={() => setShowOnly(p => ({ ...p, [key]: !p[key] }))}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${showOnly[key] ? activeColor : 'bg-white/4 border-white/8 text-slate-400 hover:text-white hover:bg-white/8'}`}>
                  <Icon size={11} />
                  {label}
                </button>
              ))}
              <span className="ml-auto text-slate-500 text-xs">
                <span className="text-white font-semibold">{filtered.length}</span> leads
              </span>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-card card-border rounded-2xl">
              <span className="text-4xl mb-3">🎯</span>
              <p className="text-white font-semibold mb-1">No leads match your filters</p>
              <p className="text-slate-400 text-sm">Try adjusting the stage or search query</p>
            </div>
          ) : (
            <div className={viewMode === 'list' ? 'flex flex-col gap-1.5' : 'grid grid-cols-1 sm:grid-cols-2 gap-3'}>
              {filtered.map((l) => (
                <LeadCard
                  key={l.id}
                  lead={l}
                  onClick={setSelected}
                  selectable={selectMode}
                  selected={selectedIds.has(l.id)}
                  onSelect={toggleSelect}
                  onComments={setCommentsLead}
                  viewMode={viewMode}
                />
              ))}
            </div>
          )}
        </div>

        <div>
          <SourcePanel sources={leadSources} />
          <div className="mt-4 bg-card card-border rounded-2xl p-4 glow-blue">
            <p className="text-white font-semibold text-xs mb-3 flex items-center gap-2">
              <AlertTriangle size={13} className="text-amber-400" /> Conversion Diagnostics
            </p>
            <div className="space-y-2.5">
              {[
                { pct: 40, label: 'Lead Quality Issues', detail: '40% casual browsers — tighten intake', color: 'bg-red-400' },
                { pct: 35, label: 'Response Time Issues', detail: 'Avg 4.2h — target under 1h for score >70', color: 'bg-amber-400' },
                { pct: 25, label: 'Agent Utilization', detail: 'Top 3 agents closing 60% of deals', color: 'bg-blue-400' },
              ].map(({ pct, label, detail, color }) => (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1 text-[10px]">
                    <span className="text-slate-300 font-medium">{label}</span>
                    <span className="text-slate-500">{pct}% of problem</span>
                  </div>
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden mb-1">
                    <div className={`h-full rounded-full ${color}`} style={{ width: `${pct * 2}%` }} />
                  </div>
                  <p className="text-slate-500 text-[9px]">{detail}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-white/5">
              <p className="text-slate-400 text-[10px] mb-1">Expected improvement with fixes:</p>
              <p className="text-emerald-400 text-xs font-semibold">7.6% → 11% conversion in 45 days</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectMode && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4">
          <div className="bg-navy-800 border border-blue-500/30 rounded-2xl shadow-2xl shadow-blue-500/10 px-5 py-4">
            {/* Top row: count + select all + cancel */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-white font-semibold text-sm">
                  {selectedIds.size} <span className="text-slate-400 font-normal">selected</span>
                </span>
                <button
                  onClick={toggleSelectAll}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {selectedIds.size === filtered.length ? 'Deselect all' : `Select all ${filtered.length}`}
                </button>
              </div>
              <button onClick={exitSelectMode} className="text-slate-500 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Actions row */}
            {selectedIds.size > 0 && (
              bulkPreviousWarn ? (
                /* Previously assigned to this agent */
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 space-y-3">
                  <p className="text-blue-200 text-sm">
                    <span className="font-bold">{bulkPreviousWarn.prevIds.length}</span> of{' '}
                    <span className="font-bold">{selectedIds.size}</span> leads were previously with{' '}
                    <span className="font-bold">{bulkPreviousWarn.agentName}</span>.
                    Return them?
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => _doBulkAssign([...selectedIds])}
                      disabled={bulkWorking}
                      className="flex-1 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 disabled:opacity-50 rounded-xl text-blue-300 text-xs font-semibold transition-all whitespace-nowrap"
                    >
                      {bulkWorking ? 'Assigning…' : 'Yes, Return All'}
                    </button>
                    {bulkPreviousWarn.otherIds.length > 0 && (
                      <button
                        onClick={() => _doBulkAssign(bulkPreviousWarn.otherIds)}
                        disabled={bulkWorking}
                        className="flex-1 px-3 py-2 bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-50 rounded-xl text-slate-300 text-xs font-semibold transition-all whitespace-nowrap"
                      >
                        {bulkWorking ? 'Assigning…' : `Skip Previous (${bulkPreviousWarn.prevIds.length})`}
                      </button>
                    )}
                    <button
                      onClick={() => setBulkPreviousWarn(null)}
                      className="px-3 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-slate-400 text-xs transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : bulkDuplicateWarn ? (
                /* Duplicate assignment warning */
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 space-y-3">
                  <p className="text-amber-300 text-sm">
                    <span className="font-bold">{bulkDuplicateWarn.dupIds.length}</span> of{' '}
                    <span className="font-bold">{selectedIds.size}</span> selected leads are already assigned to{' '}
                    <span className="font-bold">{bulkDuplicateWarn.agentName}</span>.
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => _doBulkAssign([...selectedIds])}
                      disabled={bulkWorking}
                      className="flex-1 px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 disabled:opacity-50 rounded-xl text-amber-300 text-xs font-semibold transition-all whitespace-nowrap"
                    >
                      {bulkWorking ? 'Assigning…' : 'Reassign All'}
                    </button>
                    {bulkDuplicateWarn.skipIds.length > 0 && (
                      <button
                        onClick={() => _doBulkAssign(bulkDuplicateWarn.skipIds)}
                        disabled={bulkWorking}
                        className="flex-1 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 disabled:opacity-50 rounded-xl text-blue-300 text-xs font-semibold transition-all whitespace-nowrap"
                      >
                        {bulkWorking ? 'Assigning…' : `Skip Already Assigned (${bulkDuplicateWarn.skipIds.length})`}
                      </button>
                    )}
                    <button
                      onClick={() => setBulkDuplicateWarn(null)}
                      className="px-3 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-slate-400 text-xs transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : !confirmBulkDelete ? (
                <div className="flex items-center gap-2">
                  {/* Assign agent — hidden for agents */}
                  {!isAgent && (
                    <>
                      <select
                        value={bulkAgentId}
                        onChange={e => { setBulkAgentId(e.target.value); setBulkPreviousWarn(null); setBulkDuplicateWarn(null) }}
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50"
                      >
                        <option value="" className="bg-slate-800">Assign to agent…</option>
                        {agents.map(a => (
                          <option key={a.id} value={a.id} className="bg-slate-800">{a.name}</option>
                        ))}
                      </select>
                      <button
                        onClick={handleBulkAssign}
                        disabled={!bulkAgentId || bulkWorking}
                        className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-white text-xs font-semibold transition-all whitespace-nowrap"
                      >
                        <UserCheck size={13} />
                        {bulkWorking ? 'Assigning…' : 'Assign'}
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setConfirmBulkDelete(true)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-red-500/15 border border-red-500/30 hover:bg-red-500/25 rounded-xl text-red-400 text-xs font-semibold transition-all whitespace-nowrap"
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="flex-1 text-sm text-red-300">
                    Delete <span className="font-bold">{selectedIds.size}</span> leads? This cannot be undone.
                  </p>
                  <button onClick={() => setConfirmBulkDelete(false)} className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-slate-400 text-xs hover:text-white transition-all">
                    Cancel
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    disabled={bulkWorking}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 rounded-xl text-white text-xs font-semibold transition-all"
                  >
                    {bulkWorking ? 'Deleting…' : `Yes, Delete ${selectedIds.size}`}
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      )}

      <LeadDrawer lead={selected} onClose={() => setSelected(null)} onUpdate={fetchLeads} agents={agents} />

      {showAdd && (
        <AddLeadModal
          agents={agents}
          onClose={() => setShowAdd(false)}
          onSaved={fetchLeads}
        />
      )}

      {showImport && (
        <LeadImportModal
          agents={agents}
          onClose={() => setShowImport(false)}
          onDone={() => { setShowImport(false); fetchLeads() }}
        />
      )}

      {commentsLead && (
        <LeadCommentsModal
          lead={commentsLead}
          onClose={() => setCommentsLead(null)}
        />
      )}
    </div>
  )
}
