import { useState, useEffect } from 'react';
import { X, Bed, Bath, Maximize2, MapPin, Calendar, Trash2, Edit2, Check, AlertTriangle, ImagePlus, Loader2 } from 'lucide-react';
import type { PropertyView } from '../../types/properties';
import type { UpdatePropertyDto } from '../../api/types.gen';
import { usePresignedUpload } from '../../hooks/usePresignedUpload';

interface PropertyDrawerProps {
  property: PropertyView | null;
  onClose: () => void;
  onUpdate: (data: UpdatePropertyDto) => Promise<void>;
  onDelete: () => void;
  onChangeStatus: (status: string) => void;
  canManage: boolean;
}

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  active: { label: 'Active', bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
  pending: { label: 'Pending', bg: 'bg-amber-500/15', text: 'text-amber-400' },
  sold: { label: 'Sold', bg: 'bg-slate-500/15', text: 'text-slate-400' },
  withdrawn: { label: 'Withdrawn', bg: 'bg-red-500/15', text: 'text-red-400' },
};

const typeLabels: Record<string, string> = {
  apartment: 'Apartment',
  villa: 'Villa',
  commercial: 'Commercial',
  land: 'Land',
  townhouse: 'Townhouse',
};

const statusTransitions: Record<string, string[]> = {
  active: ['pending', 'sold', 'withdrawn'],
  pending: ['active', 'sold', 'withdrawn'],
  sold: ['active', 'withdrawn'],
  withdrawn: ['active', 'pending'],
};

function fmtPrice(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US')}`;
}

export default function PropertyDrawer({
  property,
  onClose,
  onUpdate,
  onDelete,
  onChangeStatus,
  canManage,
}: PropertyDrawerProps) {
  const [editing, setEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<UpdatePropertyDto>({});
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

  const presignedUpload = usePresignedUpload();

  // Close lightbox on Escape
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setLightboxIndex(null);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (!property) return null;
  const p = property;

  const statusCfg = statusConfig[p.status] || statusConfig.active;
  const transitions = statusTransitions[p.status] || [];
  const typeLabel = typeLabels[p.type] || p.type;

  function startEditing() {
    setForm({
      title: p.title,
      address: p.address,
      price: p.price,
      beds: p.beds,
      baths: p.baths,
      sqft: p.sqft,
      yearBuilt: p.yearBuilt,
      description: p.description,
      attributes: p.attributes,
      agentId: p.agentId,
      projectId: p.projectId,
    });
    setEditing(true);
    setError('');
  }

  function cancelEditing() {
    setEditing(false);
    setForm({});
    setError('');
  }

  async function saveEdits() {
    setSaving(true);
    setError('');
    try {
      await onUpdate(form);
      setEditing(false);
      setForm({});
    } catch (err: any) {
      setError(err?.detail || err?.message || 'Failed to update property');
    } finally {
      setSaving(false);
    }
  }

  function handleChangeStatus(status: string) {
    onChangeStatus(status);
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side validation
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Only JPG, PNG, and WebP images are allowed');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setError('File size must be under 25 MB');
      return;
    }

    setUploading(true);
    setError('');
    try {
      const result = await presignedUpload.mutateAsync({ propertyId: p.id, file });
      const updatedImages = [...(p.images || []), result.fileUrl];
      await onUpdate({ images: updatedImages });
    } catch (err: any) {
      setError(err?.message || 'Failed to upload photo');
    } finally {
      setUploading(false);
      // Reset input so user can re-select the same file
      e.target.value = '';
    }
  }

  async function handleRemovePhoto(url: string) {
    setError('');
    try {
      const updatedImages = (p.images || []).filter((img) => img !== url);
      await onUpdate({ images: updatedImages });
    } catch (err: any) {
      setError(err?.message || 'Failed to remove photo');
    }
  }

  function openLightbox(index: number) {
    setLightboxIndex(index);
  }

  function closeLightbox() {
    setLightboxIndex(null);
  }

  function goToPrevPhoto() {
    if (lightboxIndex === null) return;
    const images = p.images || [];
    setLightboxIndex((lightboxIndex - 1 + images.length) % images.length);
  }

  function goToNextPhoto() {
    if (lightboxIndex === null) return;
    const images = p.images || [];
    setLightboxIndex((lightboxIndex + 1) % images.length);
  }

  const attributes = property.attributes as Record<string, any> | undefined;

  function renderAttributes() {
    if (!attributes || Object.keys(attributes).length === 0) return null;

    const attrEntries = Object.entries(attributes);

    return (
      <div>
        <p className="text-slate-500 text-[9px] uppercase tracking-wider mb-2">Attributes</p>
        <div className="grid grid-cols-2 gap-2">
          {attrEntries.map(([key, value]) => {
            const label = key
              .replace(/([A-Z])/g, ' $1')
              .replace(/^./, (s) => s.toUpperCase())
              .trim();
            const display =
              typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value ?? '—');
            return (
              <div key={key} className="bg-white/4 border border-white/8 rounded-xl p-2.5">
                <p className="text-slate-500 text-[9px] uppercase tracking-wider mb-0.5">{label}</p>
                <p className="text-white text-xs font-medium truncate">{display}</p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function inputCls(field: string) {
    return `w-full bg-white/5 border ${field ? 'border-white/10' : 'border-white/10'} rounded-xl px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-all`;
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed end-0 top-0 h-full w-full sm:w-[480px] bg-card border-s border-white/10 z-50 overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-card/95 backdrop-blur-sm border-b border-white/5 px-5 py-4 flex items-center gap-3 z-10">
          <div className="flex-1 min-w-0">
            {editing ? (
              <input
                value={(form.title as string) || ''}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sm text-white font-semibold focus:outline-none focus:border-blue-500/50"
              />
            ) : (
              <p className="text-white font-bold text-base truncate">{property.title}</p>
            )}
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border border-white/10 ${statusCfg.bg} ${statusCfg.text}`}>
                {statusCfg.label}
              </span>
              <span className="text-slate-500 text-[10px]">{typeLabel}</span>
            </div>
          </div>
          {canManage && !editing && (
            <button
              onClick={startEditing}
              className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 hover:bg-blue-500/20 transition-all"
            >
              <Edit2 size={14} />
            </button>
          )}
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Photo Grid */}
          {(p.images && p.images.length > 0) || canManage ? (
            <div>
              <p className="text-slate-500 text-[9px] uppercase tracking-wider mb-2">Photos</p>
              {p.images && p.images.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {p.images.map((img, i) => (
                    <div key={img} className="group relative aspect-square rounded-xl overflow-hidden bg-white/5 border border-white/8">
                      <img
                        src={img}
                        alt={`${p.title} ${i + 1}`}
                        className="w-full h-full object-cover cursor-pointer"
                        onClick={() => openLightbox(i)}
                      />
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(img)}
                          className="absolute top-1 right-1 w-5 h-5 bg-red-500/80 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                        >
                          <X size={10} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {canManage && (
                <label className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-white/10 rounded-xl cursor-pointer hover:border-white/20 hover:bg-white/3 p-4 transition-all">
                  {uploading ? (
                    <Loader2 size={20} className="text-blue-400 animate-spin" />
                  ) : (
                    <>
                      <ImagePlus size={20} className="text-slate-500" />
                      <p className="text-slate-400 text-xs">
                        Drop a photo or <span className="text-blue-400 underline">browse</span>
                      </p>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleFileSelect}
                    disabled={uploading}
                  />
                </label>
              )}
            </div>
          ) : null}

          {/* Price */}
          <div>
            <p className="text-slate-500 text-[9px] uppercase tracking-wider mb-1">Price</p>
            {editing ? (
              <input
                type="number"
                value={form.price !== undefined ? form.price / 100 : ''}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    price: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : undefined,
                  }))
                }
                className={inputCls('price')}
                placeholder="Price in dollars"
              />
            ) : (
              <p className="text-white text-lg font-bold">{fmtPrice(property.price)}</p>
            )}
          </div>

          {/* Address */}
          <div>
            <p className="text-slate-500 text-[9px] uppercase tracking-wider mb-1">Address</p>
            {editing ? (
              <input
                value={(form.address as string) || ''}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                className={inputCls('address')}
                placeholder="Property address"
              />
            ) : (
              <p className="text-slate-300 text-xs flex items-center gap-1">
                <MapPin size={12} className="text-slate-500 flex-shrink-0" />
                {property.address}
              </p>
            )}
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-2">
            {editing ? (
              <>
                <div>
                  <p className="text-slate-500 text-[9px] uppercase tracking-wider mb-1">Beds</p>
                  <input
                    type="number"
                    value={form.beds ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, beds: e.target.value ? Number(e.target.value) : undefined }))
                    }
                    className={inputCls('beds')}
                    placeholder="—"
                  />
                </div>
                <div>
                  <p className="text-slate-500 text-[9px] uppercase tracking-wider mb-1">Baths</p>
                  <input
                    type="number"
                    value={form.baths ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, baths: e.target.value ? Number(e.target.value) : undefined }))
                    }
                    className={inputCls('baths')}
                    placeholder="—"
                  />
                </div>
                <div>
                  <p className="text-slate-500 text-[9px] uppercase tracking-wider mb-1">Sqft</p>
                  <input
                    type="number"
                    value={form.sqft ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, sqft: e.target.value ? Number(e.target.value) : undefined }))
                    }
                    className={inputCls('sqft')}
                    placeholder="—"
                  />
                </div>
                <div>
                  <p className="text-slate-500 text-[9px] uppercase tracking-wider mb-1">Year Built</p>
                  <input
                    type="number"
                    value={form.yearBuilt ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        yearBuilt: e.target.value ? Number(e.target.value) : undefined,
                      }))
                    }
                    className={inputCls('yearBuilt')}
                    placeholder="—"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="bg-white/4 border border-white/8 rounded-xl p-3">
                  <p className="text-slate-500 text-[9px] uppercase tracking-wider mb-1">Beds</p>
                  <p className="text-white text-xs font-medium flex items-center gap-1">
                    <Bed size={12} /> {property.beds ?? '—'}
                  </p>
                </div>
                <div className="bg-white/4 border border-white/8 rounded-xl p-3">
                  <p className="text-slate-500 text-[9px] uppercase tracking-wider mb-1">Baths</p>
                  <p className="text-white text-xs font-medium flex items-center gap-1">
                    <Bath size={12} /> {property.baths ?? '—'}
                  </p>
                </div>
                <div className="bg-white/4 border border-white/8 rounded-xl p-3">
                  <p className="text-slate-500 text-[9px] uppercase tracking-wider mb-1">Sqft</p>
                  <p className="text-white text-xs font-medium flex items-center gap-1">
                    <Maximize2 size={12} /> {property.sqft?.toLocaleString() ?? '—'}
                  </p>
                </div>
                <div className="bg-white/4 border border-white/8 rounded-xl p-3">
                  <p className="text-slate-500 text-[9px] uppercase tracking-wider mb-1">Year Built</p>
                  <p className="text-white text-xs font-medium flex items-center gap-1">
                    <Calendar size={12} /> {property.yearBuilt ?? '—'}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Attributes section */}
          {!editing && renderAttributes()}

          {/* Description */}
          {(property.description || editing) && (
            <div>
              <p className="text-slate-500 text-[9px] uppercase tracking-wider mb-1">Description</p>
              {editing ? (
                <textarea
                  value={(form.description as string) || ''}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-all resize-none h-20"
                  placeholder="Add description..."
                />
              ) : (
                <p className="text-slate-400 text-xs leading-relaxed">{property.description}</p>
              )}
            </div>
          )}

          {/* Tags section */}
          {property.tags && property.tags.length > 0 && (
            <div>
              <p className="text-slate-500 text-[9px] uppercase tracking-wider mb-2">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {property.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] text-slate-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Created at */}
          <div>
            <p className="text-slate-500 text-[9px] uppercase tracking-wider mb-1">Created</p>
            <p className="text-slate-400 text-xs">
              {new Date(property.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          </div>

          {/* Admin/Manager Controls */}
          {canManage && (
            <div className="space-y-3 pt-2 border-t border-white/10">
              {editing ? (
                /* Edit mode controls */
                <div className="space-y-2">
                  {error && (
                    <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={cancelEditing}
                      className="flex-1 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveEdits}
                      disabled={saving}
                      className="flex-1 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-60 rounded-xl text-xs font-semibold text-white transition-all flex items-center justify-center gap-1"
                    >
                      {saving ? 'Saving...' : <><Check size={13} /> Save</>}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Status transition */}
                  {transitions.length > 0 && (
                    <div>
                      <p className="text-slate-500 text-[9px] uppercase tracking-wider mb-2">Change Status</p>
                      <div className="flex flex-wrap gap-1.5">
                        {transitions.map((st) => {
                          const cfg = statusConfig[st] || statusConfig.active;
                          return (
                            <button
                              key={st}
                              onClick={() => handleChangeStatus(st)}
                              className={`text-[10px] font-medium px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.text} border-white/10 hover:opacity-80 transition-all`}
                            >
                              {cfg.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Delete */}
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-500/10 border border-red-500/25 rounded-xl text-red-300 text-xs font-medium hover:bg-red-500/20 transition-all"
                  >
                    <Trash2 size={13} /> Delete Property
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && p.images && p.images[lightboxIndex] && (
        <div
          className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center"
          onClick={closeLightbox}
        >
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 w-8 h-8 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-all z-10"
          >
            <X size={16} />
          </button>
          {p.images.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); goToPrevPhoto(); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-all z-10"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); goToNextPhoto(); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-all z-10"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
              </button>
            </>
          )}
          <img
            src={p.images[lightboxIndex]}
            alt={`${p.title} ${lightboxIndex + 1}`}
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl"
            onClick={(e) => e.stopPropagation()}
          />
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-xs">
            {lightboxIndex + 1} / {p.images.length}
          </p>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card card-border rounded-2xl w-full max-w-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={16} className="text-red-400" />
              <p className="text-white font-semibold text-sm">Delete Property</p>
            </div>
            <p className="text-slate-400 text-xs mb-4">
              Are you sure you want to delete <span className="text-white font-medium">{property.title}</span>?
              This action can be undone later (soft delete).
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-slate-400 hover:text-white transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  onDelete();
                }}
                className="flex-1 py-2 bg-red-500 rounded-xl text-xs font-semibold text-white hover:bg-red-600 transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}