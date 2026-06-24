import { useState } from 'react';
import { X, ImagePlus, Loader2 } from 'lucide-react';
import type { CreateProjectDto, ProjectResponseDto } from '../../api/types.gen';
import { useProjectPresignedUpload } from '../../hooks/useProjectPresignedUpload';
import { projectsControllerUpdate } from '../../api/sdk.gen';

interface AddProjectModalProps {
  onClose: () => void;
  onSaved: (formData: CreateProjectDto) => Promise<ProjectResponseDto>;
}

interface FormState {
  name: string;
  location: string;
  description: string;
  developerName: string;
  launchDate: string;
  completionDate: string;
  totalUnits: string;
}

interface FormErrors {
  [key: string]: string;
}

const initialForm: FormState = {
  name: '',
  location: '',
  description: '',
  developerName: '',
  launchDate: '',
  completionDate: '',
  totalUnits: '',
};

function buildCreateDto(form: FormState): CreateProjectDto {
  const dto: CreateProjectDto = {
    name: form.name.trim(),
    location: form.location.trim(),
  };

  if (form.description.trim()) dto.description = form.description.trim();
  if (form.developerName.trim()) dto.developerName = form.developerName.trim();
  if (form.launchDate) dto.launchDate = form.launchDate;
  if (form.completionDate) dto.completionDate = form.completionDate;
  if (form.totalUnits) dto.totalUnits = Number(form.totalUnits);

  return dto;
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 25 * 1024 * 1024;

export default function AddProjectModal({ onClose, onSaved }: AddProjectModalProps) {
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const presignedUpload = useProjectPresignedUpload();

  function updateField(k: keyof FormState, v: any) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  function validate(): FormErrors {
    const e: FormErrors = {};
    if (!form.name.trim()) e.name = 'Required';
    if (!form.location.trim()) e.location = 'Required';
    if (form.totalUnits && Number(form.totalUnits) < 0) e.totalUnits = 'Must be >= 0';
    return e;
  }

  function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Only JPG, PNG, and WebP images are allowed');
      return;
    }
    if (file.size > MAX_SIZE) {
      setError('File size must be under 25 MB');
      return;
    }

    setCoverFile(file);
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverPreview(URL.createObjectURL(file));
    setError('');
  }

  function removeCover() {
    setCoverFile(null);
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverPreview(null);
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setError('');

    const dto = buildCreateDto(form);

    setSaving(true);
    try {
      const created = await onSaved(dto);
      if (coverFile && created?.id) {
        setUploading(true);
        try {
          const result = await presignedUpload.mutateAsync({
            projectId: created.id,
            file: coverFile,
          });
          await projectsControllerUpdate({
            path: { id: created.id },
            body: { images: [result.fileUrl] },
          });
          setCoverFile(null);
          if (coverPreview) URL.revokeObjectURL(coverPreview);
          setCoverPreview(null);
        } catch (uploadErr: any) {
          setError(
            `Project created, but cover photo failed: ${uploadErr?.message || 'Upload error'}. You can re-upload from the project drawer.`,
          );
        } finally {
          setUploading(false);
        }
      }
    } catch (err: any) {
      setError(err?.detail || err?.message || 'Failed to create project');
    } finally {
      setSaving(false);
    }
  }

  function inputCls(field: string) {
    return `w-full bg-white/5 border ${errors[field] ? 'border-red-500/50' : 'border-white/10'} rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-all`;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card card-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-white/8">
          <h2 className="text-white font-semibold">Add Project</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Cover Photo */}
          <div>
            <label className="text-slate-400 text-xs mb-1 block">Cover Photo</label>
            <label
              className={`flex flex-col items-center justify-center gap-1.5 border-2 border-dashed rounded-xl cursor-pointer transition-all overflow-hidden ${
                coverPreview ? 'border-blue-500/40 p-0' : 'border-white/10 hover:border-white/20 hover:bg-white/3 p-4'
              }`}
            >
              {coverPreview ? (
                <div className="relative w-full h-32">
                  <img src={coverPreview} className="w-full h-full object-cover" alt="Cover preview" />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      removeCover();
                    }}
                    className="absolute top-2 right-2 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-red-500/80 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <>
                  {uploading ? (
                    <Loader2 size={20} className="text-blue-400 animate-spin" />
                  ) : (
                    <>
                      <ImagePlus size={20} className="text-slate-500" />
                      <p className="text-slate-400 text-xs">
                        Drop a photo or <span className="text-blue-400 underline">browse</span>
                      </p>
                      <p className="text-slate-600 text-[10px]">JPG, PNG, WebP · Max 25 MB</p>
                    </>
                  )}
                </>
              )}
              <input
                type="file"
                className="hidden"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImagePick}
                disabled={uploading}
              />
            </label>
          </div>

          {/* Basic Info */}
          <div>
            <p className="text-slate-400 text-[10px] uppercase tracking-widest mb-3">Basic Information</p>
            <div className="space-y-3">
              <div>
                <label className="text-slate-400 text-xs mb-1 block">Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  className={inputCls('name')}
                  placeholder="e.g. Marina Heights"
                />
                {errors.name && <p className="text-red-400 text-[10px] mt-0.5">{errors.name}</p>}
              </div>
              <div>
                <label className="text-slate-400 text-xs mb-1 block">Location *</label>
                <input
                  value={form.location}
                  onChange={(e) => updateField('location', e.target.value)}
                  className={inputCls('location')}
                  placeholder="e.g. Dubai Marina"
                />
                {errors.location && <p className="text-red-400 text-[10px] mt-0.5">{errors.location}</p>}
              </div>
              <div>
                <label className="text-slate-400 text-xs mb-1 block">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-all resize-none h-20"
                  placeholder="Project description..."
                />
              </div>
            </div>
          </div>

          {/* Details */}
          <div>
            <p className="text-slate-400 text-[10px] uppercase tracking-widest mb-3 border-t border-white/8 pt-4">
              Details
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 text-xs mb-1 block">Developer Name</label>
                <input
                  value={form.developerName}
                  onChange={(e) => updateField('developerName', e.target.value)}
                  className={inputCls('developerName')}
                  placeholder="e.g. Emaar"
                />
              </div>
              <div>
                <label className="text-slate-400 text-xs mb-1 block">Total Units</label>
                <input
                  type="number"
                  min="0"
                  value={form.totalUnits}
                  onChange={(e) => updateField('totalUnits', e.target.value)}
                  className={inputCls('totalUnits')}
                  placeholder="e.g. 250"
                />
                {errors.totalUnits && <p className="text-red-400 text-[10px] mt-0.5">{errors.totalUnits}</p>}
              </div>
              <div>
                <label className="text-slate-400 text-xs mb-1 block">Launch Date</label>
                <input
                  type="date"
                  value={form.launchDate}
                  onChange={(e) => updateField('launchDate', e.target.value)}
                  className={inputCls('launchDate')}
                />
              </div>
              <div>
                <label className="text-slate-400 text-xs mb-1 block">Completion Date</label>
                <input
                  type="date"
                  value={form.completionDate}
                  onChange={(e) => updateField('completionDate', e.target.value)}
                  className={inputCls('completionDate')}
                />
              </div>
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/8 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || uploading}
              className="flex-1 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-60 rounded-xl text-sm font-semibold text-white transition-all"
            >
              {saving ? 'Saving...' : uploading ? 'Uploading photo...' : 'Add Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}