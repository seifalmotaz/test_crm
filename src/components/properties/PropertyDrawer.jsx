import { useState, useEffect, useCallback } from 'react'
import { X, TrendingUp, Eye, Clock, Bed, Bath, Maximize2, AlertTriangle, Star, Calendar, Trash2, ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react'
import FileUploader from '../shared/FileUploader'
import api from '../../lib/api'
import { useLang } from '../../context/LanguageContext'

function agentName(agent) {
  if (!agent) return ''
  return typeof agent === 'string' ? agent : (agent.name || '')
}

function fmt(v) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(3)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v}`
}

const statusColors = {
  Active: 'bg-emerald-500/15 text-emerald-400',
  Pending: 'bg-amber-500/15 text-amber-400',
  Sold: 'bg-slate-500/15 text-slate-400',
}

export default function PropertyDrawer({ property, onClose, onCoverChange }) {
  const { t } = useLang()
  const [files,        setFiles]        = useState([])
  const [filesLoading, setFilesLoading] = useState(false)
  const [lightbox,     setLightbox]     = useState(null) // index | null

  const closeLightbox = useCallback(() => setLightbox(null), [])
  const prevPhoto = useCallback(() => setLightbox(i => (i - 1 + files.length) % files.length), [files.length])
  const nextPhoto = useCallback(() => setLightbox(i => (i + 1) % files.length), [files.length])

  useEffect(() => {
    if (lightbox === null) return
    function onKey(e) {
      if (e.key === 'Escape')     closeLightbox()
      if (e.key === 'ArrowLeft')  prevPhoto()
      if (e.key === 'ArrowRight') nextPhoto()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox, closeLightbox, prevPhoto, nextPhoto])

  const statusLabels = {
    Active:  t('ui.propStatusActive'),
    Pending: t('ui.propStatusPending'),
    Sold:    t('ui.propStatusSold'),
  }

  useEffect(() => {
    if (!property?.id) { setFiles([]); return }
    setFilesLoading(true)
    setFiles([])
    api.get(`/api/files?entityType=property&entityId=${property.id}`)
      .then(res => setFiles(res.data || []))
      .catch(() => {})
      .finally(() => setFilesLoading(false))
  }, [property?.id])

  async function deletePhoto(fileId) {
    try {
      await api.delete(`/api/files/${fileId}`)
      setFiles(prev => prev.filter(f => f.id !== fileId))
    } catch {}
  }

  if (!property) return null
  const ppsf = Math.round(property.price / property.sqft)
  const activePhoto = lightbox !== null ? files[lightbox] : null

  return (
    <>
      {/* ── Lightbox ─────────────────────────────────────────── */}
      {activePhoto && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.92)' }}
          onClick={closeLightbox}
        >
          {/* close */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 end-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all"
          >
            <X size={18} />
          </button>

          {/* counter */}
          <span className="absolute top-4 left-1/2 -translate-x-1/2 text-white/60 text-sm select-none">
            {lightbox + 1} / {files.length}
          </span>

          {/* prev */}
          {files.length > 1 && (
            <button
              onClick={e => { e.stopPropagation(); prevPhoto() }}
              className="absolute start-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all"
            >
              <ChevronLeft size={22} />
            </button>
          )}

          {/* image */}
          <img
            src={activePhoto.url}
            alt={activePhoto.originalName}
            onClick={e => e.stopPropagation()}
            className="max-h-[85vh] max-w-[85vw] rounded-2xl object-contain shadow-2xl select-none"
            style={{ userSelect: 'none' }}
          />

          {/* next */}
          {files.length > 1 && (
            <button
              onClick={e => { e.stopPropagation(); nextPhoto() }}
              className="absolute end-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all"
            >
              <ChevronRight size={22} />
            </button>
          )}

          {/* filename */}
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/40 text-xs truncate max-w-xs select-none">
            {activePhoto.originalName}
          </p>
        </div>
      )}

      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={onClose} />

      <div className="fixed end-0 top-0 h-full w-full sm:w-[480px] bg-navy-800 border-s border-blue-500/15 z-50 overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-navy-800/95 backdrop-blur-sm border-b border-white/5 px-6 py-4 flex items-start justify-between">
          <div>
            <p className="text-white font-bold text-base">{property.address}</p>
            <p className="text-slate-400 text-sm">{property.neighborhood} · {property.type}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="h-48 bg-gradient-to-br from-navy-700 to-navy-600 rounded-2xl flex items-center justify-center relative overflow-hidden">
            {files[0]?.url
              ? <img src={files[0].url} alt={property.address} className="w-full h-full object-cover" />
              : <span className="text-7xl">{property.images[0]}</span>
            }
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-4 start-4 end-4 flex items-end justify-between">
              <div>
                <p className="text-white text-2xl font-bold">{fmt(property.price)}</p>
                <p className="text-slate-300 text-xs">${ppsf}/{t('ui.propSqft')}</p>
              </div>
              <div className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[property.status]}`}>
                {statusLabels[property.status] || property.status}
              </div>
            </div>
            <div className="absolute top-4 end-4 w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm border border-white/20 flex items-center justify-center">
              <span className="text-white font-bold text-sm">{property.matchScore}</span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {[
              { icon: Bed,      label: t('properties.drawer.beds'),  value: property.beds || '—' },
              { icon: Bath,     label: t('properties.drawer.baths'), value: property.baths },
              { icon: Maximize2, label: t('properties.drawer.sqft'), value: (property.sqft ?? 0).toLocaleString() },
              { icon: Calendar, label: t('properties.drawer.built'), value: property.yearBuilt },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="bg-white/4 border border-white/8 rounded-xl p-3 text-center">
                <Icon size={14} className="text-blue-400 mx-auto mb-1" />
                <p className="text-white text-sm font-semibold">{value}</p>
                <p className="text-slate-500 text-[10px]">{label}</p>
              </div>
            ))}
          </div>

          <div>
            <p className="text-slate-300 text-sm leading-relaxed">{property.description}</p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {property.tags.map((tag) => (
              <span key={tag} className="text-xs text-blue-300 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-lg">
                {tag}
              </span>
            ))}
          </div>

          <div className="bg-white/3 border border-white/6 rounded-2xl p-4 grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">{t('properties.drawer.views')}</p>
              <p className="text-white font-bold flex items-center justify-center gap-1">
                <Eye size={12} className="text-blue-400" /> {property.views}
              </p>
            </div>
            <div className="text-center border-x border-white/5">
              <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">{t('properties.drawer.daysListed')}</p>
              <p className="text-white font-bold flex items-center justify-center gap-1">
                <Clock size={12} className="text-amber-400" /> {property.daysOnMarket}d
              </p>
            </div>
            <div className="text-center">
              <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">{t('properties.drawer.appreciation')}</p>
              <p className="text-emerald-400 font-bold flex items-center justify-center gap-1">
                <TrendingUp size={12} /> +{property.appreciationYoY}%
              </p>
            </div>
          </div>

          <div>
            <p className="text-white font-semibold text-sm mb-3">{t('properties.drawer.comparableSales')}</p>
            <div className="space-y-2">
              {property.comps.map((c, i) => {
                const diff = c.price > 0 ? ((property.price - c.price) / c.price * 100).toFixed(1) : '—'
                const isHigher = property.price > c.price
                return (
                  <div key={i} className="flex items-center justify-between p-3 bg-white/3 border border-white/6 rounded-xl">
                    <div>
                      <p className="text-white text-xs font-medium">{c.address}</p>
                      <p className="text-slate-500 text-[10px]">{(c.sqft ?? 0).toLocaleString()} {t('ui.propSqft')} · {c.dom}{t('properties.drawer.domSuffix')}</p>
                    </div>
                    <div className="text-end">
                      <p className="text-white text-xs font-semibold">{fmt(c.price)}</p>
                      <p className={`text-[10px] font-medium ${isHigher ? 'text-red-400' : 'text-emerald-400'}`}>
                        {isHigher ? '+' : ''}{diff}% {t('properties.drawer.vsThis')}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-blue-500/8 border border-blue-500/20 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Star size={14} className="text-blue-400" />
              <p className="text-blue-300 text-xs font-semibold uppercase tracking-wider">{t('properties.drawer.aiRecommendation')}</p>
            </div>
            <p className="text-slate-200 text-sm leading-relaxed">{property.recommendation}</p>
          </div>

          {property.concerns.length > 0 && (
            <div className="bg-amber-500/8 border border-amber-500/20 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={14} className="text-amber-400" />
                <p className="text-amber-300 text-xs font-semibold uppercase tracking-wider">{t('properties.drawer.watchPoints')}</p>
              </div>
              <ul className="space-y-1">
                {property.concerns.map((c, i) => (
                  <li key={i} className="text-slate-300 text-sm flex items-start gap-2">
                    <span className="text-amber-400 mt-0.5">·</span> {c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-3 p-3 bg-white/3 border border-white/6 rounded-xl">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-300 text-xs font-bold">
              {(agentName(property.agent) || '?').split(' ').map(w => w[0]).join('') || '?'}
            </div>
            <div>
              <p className="text-white text-xs font-medium">{agentName(property.agent) || '—'}</p>
              <p className="text-slate-500 text-[10px]">{t('properties.drawer.listingAgent')}</p>
            </div>
            <div className="ms-auto flex gap-2">
              <button className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-slate-300 hover:bg-white/10 transition-all">
                {t('properties.drawer.message')}
              </button>
              <button className="px-3 py-1.5 bg-blue-500 rounded-lg text-xs text-white font-medium hover:bg-blue-600 transition-all">
                {t('properties.drawer.scheduleShowing')}
              </button>
            </div>
          </div>

          <div>
            <p className="text-white font-semibold text-sm mb-3">{t('properties.drawer.photos')}</p>
            {filesLoading ? (
              <div className="flex justify-center py-3">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : files.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {files.map((f, idx) => (
                  <div key={f.id} className="relative aspect-square rounded-xl overflow-hidden bg-white/5 border border-white/8 group">
                    <img src={f.url} alt={f.originalName}
                      className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all">
                      <button
                        onClick={() => setLightbox(idx)}
                        className="absolute inset-0 flex items-center justify-center"
                      >
                        <ZoomIn size={16} className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); deletePhoto(f.id) }}
                        className="absolute top-1.5 end-1.5 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
                      >
                        <Trash2 size={10} className="text-white" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <FileUploader
              entityType="property"
              entityId={property.id}
              accept="image/jpeg,image/png,image/webp"
              hint={t('properties.drawer.photoHint')}
              onUploadSuccess={file => setFiles(prev => {
                const next = [file, ...prev]
                if (prev.length === 0) onCoverChange?.(property.id, file.url)
                return next
              })}
            />
          </div>
        </div>
      </div>
    </>
  )
}
