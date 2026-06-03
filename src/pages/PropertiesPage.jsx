import { useState, useMemo, useEffect, useCallback } from 'react'
import { useLang } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'
import PropertyFilters from '../components/properties/PropertyFilters'
import MarketStrip from '../components/properties/MarketStrip'
import PropertyCard from '../components/properties/PropertyCard'
import PropertyDrawer from '../components/properties/PropertyDrawer'
import { LayoutGrid, List, Plus, X, ImagePlus } from 'lucide-react'
import api, { upload } from '../lib/api'
import { mapProperty } from '../lib/mappers'

const defaultFilters = { neighborhood: 'All', type: 'All', beds: 'Any', price: 'Any', query: '' }

const NEIGHBORHOODS = ['Downtown', 'Harbor View', 'Midtown', 'North Hills', 'Westside', 'East End']
const PROPERTY_TYPES = ['Apartment', 'Villa', 'Commercial', 'Townhouse', 'Land']

function parsePriceRange(label) {
  if (label === 'Any') return [0, Infinity]
  if (label === 'Under $500K') return [0, 500_000]
  if (label === '$500K–$1M') return [500_000, 1_000_000]
  if (label === '$1M–$2M') return [1_000_000, 2_000_000]
  if (label === '$2M–$5M') return [2_000_000, 5_000_000]
  if (label === '$5M+') return [5_000_000, Infinity]
  return [0, Infinity]
}

function parseBeds(label) {
  if (label === 'Any') return 0
  return parseInt(label)
}

function AddPropertyModal({ agents, isAgent, onClose, onSaved }) {
  const { t } = useLang()
  const [form, setForm] = useState({
    address: '', neighborhood: 'Downtown', type: 'Apartment',
    price: '', beds: '', baths: '', sqft: '', yearBuilt: '',
    description: '', agentId: isAgent ? '' : (agents[0]?.id || ''),
  })
  const [coverFile,    setCoverFile]    = useState(null)
  const [coverPreview, setCoverPreview] = useState(null)
  const [error,  setError]  = useState('')
  const [saving, setSaving] = useState(false)

  function set(k, v) { setForm(p => ({ ...p, [k]: v })) }

  function handleImagePick(e) {
    const file = e.target.files[0]
    if (!file) return
    setCoverFile(file)
    setCoverPreview(URL.createObjectURL(file))
    e.target.value = ''
  }

  function removeCover(e) {
    e.preventDefault()
    e.stopPropagation()
    setCoverFile(null)
    setCoverPreview(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const res = await api.post('/api/properties', {
        address:      form.address,
        neighborhood: form.neighborhood,
        type:         form.type,
        price:        parseFloat(form.price) || 0,
        beds:         parseInt(form.beds)    || 0,
        baths:        parseInt(form.baths)   || 0,
        sqft:         parseInt(form.sqft)    || 0,
        yearBuilt:    form.yearBuilt ? parseInt(form.yearBuilt) : undefined,
        description:  form.description || undefined,
        agentId:      form.agentId || undefined,
      })
      if (coverFile && res.data?.id) {
        const fd = new FormData()
        fd.append('file',       coverFile)
        fd.append('entityType', 'property')
        fd.append('entityId',   res.data.id)
        await upload('/api/files/upload', fd, () => {}).catch(() => {})
      }
      onSaved()
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to add property')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card card-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-white/8">
          <h2 className="text-white font-semibold">{t('properties.formTitle')}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {/* Cover photo picker */}
            <div className="col-span-2">
              <label className="text-slate-400 text-xs mb-1 block">{t('properties.coverPhoto')}</label>
              <label className={`flex flex-col items-center justify-center gap-1.5 border-2 border-dashed rounded-xl cursor-pointer transition-all overflow-hidden ${
                coverPreview ? 'border-blue-500/40 p-0' : 'border-white/10 hover:border-white/20 hover:bg-white/3 p-4'
              }`}>
                {coverPreview ? (
                  <div className="relative w-full h-32">
                    <img src={coverPreview} alt="Preview" className="w-full h-full object-cover" />
                    <button type="button" onClick={removeCover}
                      className="absolute top-2 right-2 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-red-500/80 transition-colors">
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <>
                    <ImagePlus size={20} className="text-slate-500" />
                    <p className="text-slate-400 text-xs">Drop a photo or <span className="text-blue-400 underline underline-offset-2">browse</span></p>
                    <p className="text-slate-600 text-[10px]">JPG, PNG, WebP · Max 25 MB</p>
                  </>
                )}
                <input type="file" className="hidden" accept="image/jpeg,image/png,image/webp" onChange={handleImagePick} />
              </label>
            </div>

            <div className="col-span-2">
              <label className="text-slate-400 text-xs mb-1 block">{t('properties.address')} *</label>
              <input required value={form.address} onChange={e => set('address', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50"
                placeholder="123 Oak Street" />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">{t('properties.neighborhood')}</label>
              <select value={form.neighborhood} onChange={e => set('neighborhood', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50">
                {NEIGHBORHOODS.map(n => <option key={n} value={n} className="bg-slate-800">{n}</option>)}
              </select>
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">{t('properties.type')}</label>
              <select value={form.type} onChange={e => set('type', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50">
                {PROPERTY_TYPES.map(pt => <option key={pt} value={pt} className="bg-slate-800">{pt}</option>)}
              </select>
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">{t('properties.price')} *</label>
              <input required type="number" value={form.price} onChange={e => set('price', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
                placeholder="1500000" min="0" />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">{t('properties.yearBuilt')}</label>
              <input type="number" value={form.yearBuilt} onChange={e => set('yearBuilt', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
                placeholder="2020" min="1800" max="2030" />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">{t('properties.beds')}</label>
              <input type="number" value={form.beds} onChange={e => set('beds', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
                placeholder="3" min="0" />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">{t('properties.baths')}</label>
              <input type="number" value={form.baths} onChange={e => set('baths', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
                placeholder="2" min="0" />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">{t('properties.sqft')}</label>
              <input type="number" value={form.sqft} onChange={e => set('sqft', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
                placeholder="1500" min="0" />
            </div>
            {!isAgent && agents.length > 0 && (
              <div className="col-span-2">
                <label className="text-slate-400 text-xs mb-1 block">{t('properties.assignAgent')}</label>
                <select value={form.agentId} onChange={e => set('agentId', e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50">
                  {agents.map(a => <option key={a.id} value={a.id} className="bg-slate-800">{a.name}</option>)}
                </select>
              </div>
            )}
            <div className="col-span-2">
              <label className="text-slate-400 text-xs mb-1 block">{t('properties.description')}</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 resize-none"
                placeholder="Property description…" />
            </div>
          </div>
          {error && <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/8 transition-all">{t('common.cancel')}</button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-60 rounded-xl text-sm font-semibold text-white transition-all">
              {saving ? t('common.saving') : t('properties.addListing')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function PropertiesPage() {
  const { t } = useLang()
  const { user } = useAuth()
  const [properties, setProperties] = useState([])
  const [agents,     setAgents]     = useState([])
  const [loading,    setLoading]    = useState(true)
  const [filters,    setFilters]    = useState(defaultFilters)
  const [selected,   setSelected]   = useState(null)
  const [viewMode,   setViewMode]   = useState('grid')
  const [showAdd,    setShowAdd]    = useState(false)

  const fetchProperties = useCallback(() => {
    setLoading(true)
    api.get('/api/properties?per_page=100')
      .then(res => setProperties((res.data || []).map(mapProperty)))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchProperties()
    api.get('/api/agents?per_page=50')
      .then(res => setAgents(res.data || []))
      .catch(console.error)
  }, [fetchProperties])

  const filtered = useMemo(() => {
    const [minP, maxP] = parsePriceRange(filters.price)
    const minBeds = parseBeds(filters.beds)
    const q = filters.query.toLowerCase()
    return properties.filter((p) => {
      if (filters.neighborhood !== 'All' && p.neighborhood !== filters.neighborhood) return false
      if (filters.type !== 'All' && p.type !== filters.type) return false
      if (p.price < minP || p.price > maxP) return false
      if (minBeds > 0 && p.beds < minBeds) return false
      if (q && !`${p.address} ${p.neighborhood} ${p.type} ${p.description || ''} ${(p.tags || []).join(' ')}`.toLowerCase().includes(q)) return false
      return true
    }).sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0))
  }, [properties, filters])

  const marketSummary = {
    avgPrice:        properties.length ? Math.round(properties.reduce((s, p) => s + p.price, 0) / properties.length) : 0,
    avgDaysOnMarket: properties.length ? Math.round(properties.reduce((s, p) => s + (p.daysOnMarket || 0), 0) / properties.length) : 0,
    activeListings:  properties.filter(p => p.status === 'Active').length,
    pendingListings: properties.filter(p => p.status === 'Pending').length,
    totalProperties: properties.length,
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-white text-xl font-bold tracking-tight">{t('properties.title')}</h1>
          <p className="text-slate-400 text-sm mt-0.5">{t('properties.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-white/5 border border-white/10 rounded-xl p-1">
            <button onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'}`}>
              <LayoutGrid size={14} />
            </button>
            <button onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'}`}>
              <List size={14} />
            </button>
          </div>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 rounded-xl text-xs font-medium text-white hover:bg-blue-600 transition-all">
            <Plus size={13} /> {t('properties.addListing')}
          </button>
        </div>
      </div>

      <MarketStrip data={marketSummary} />
      <PropertyFilters filters={filters} onChange={setFilters} resultCount={filtered.length} />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <span className="text-5xl mb-4">🏠</span>
          <p className="text-white font-semibold mb-1">{t('properties.noMatch')}</p>
          <p className="text-slate-400 text-sm">{t('properties.tryAdjusting')}</p>
          <button onClick={() => setFilters(defaultFilters)}
            className="mt-4 px-4 py-2 bg-blue-500/20 border border-blue-500/30 rounded-xl text-blue-300 text-sm hover:bg-blue-500/30 transition-all">
            {t('properties.clearFilters')}
          </button>
        </div>
      ) : (
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4' : 'space-y-3'}>
          {filtered.map((p) => (
            <PropertyCard key={p.id} property={p} onClick={setSelected} />
          ))}
        </div>
      )}

      <PropertyDrawer
        property={selected}
        onClose={() => setSelected(null)}
        onCoverChange={(id, url) =>
          setProperties(prev => prev.map(p => p.id === id ? { ...p, coverUrl: url } : p))
        }
      />
      {showAdd && <AddPropertyModal agents={agents} isAgent={user?.role === 'agent'} onClose={() => setShowAdd(false)} onSaved={fetchProperties} />}
    </div>
  )
}
