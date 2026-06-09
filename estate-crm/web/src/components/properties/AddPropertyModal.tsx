import { useState } from 'react';
import { X, ImagePlus } from 'lucide-react';
import type { CreatePropertyDto, PropertyResponseDto } from '../../api/types.gen';
import { usePresignedUpload } from '../../hooks/usePresignedUpload';
import { propertiesControllerUpdate } from '../../api/sdk.gen';

interface AddPropertyModalProps {
  onClose: () => void;
  onSaved: (formData: CreatePropertyDto) => Promise<PropertyResponseDto>;
  projects?: { id: string; name: string }[];
  agents?: { id: string; name: string }[];
}

interface FormState {
  title: string;
  address: string;
  type: string;
  price: string; // dollars string, convert to cents
  beds: string;
  baths: string;
  sqft: string;
  yearBuilt: string;
  description: string;
  projectId: string;
  agentId: string;
  // Dynamic attributes
  floor: string;
  totalFloors: string;
  hasElevator: boolean;
  maintenanceFee: string;
  amenities: string;
  parkingSpots: string;
  plotSize: string;
  gardenArea: string;
  floors: string;
  hasPool: boolean;
  hasGarden: boolean;
  frontage: string;
  ceilingHeight: string;
  licenseType: string;
  footTraffic: string;
  utilities: string;
  zoningType: string;
  buildableArea: string;
  roadAccess: boolean;
  utilitiesAvailable: string;
  topography: string;
  sharedWalls: string;
}

interface FormErrors {
  [key: string]: string;
}

const propertyTypes = [
  { value: 'apartment', label: 'Apartment' },
  { value: 'villa', label: 'Villa' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'land', label: 'Land' },
  { value: 'townhouse', label: 'Townhouse' },
];

const footTrafficOptions = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

const topographyOptions = [
  { value: 'flat', label: 'Flat' },
  { value: 'sloped', label: 'Sloped' },
  { value: 'hilly', label: 'Hilly' },
];

const initialForm: FormState = {
  title: '',
  address: '',
  type: 'apartment',
  price: '',
  beds: '',
  baths: '',
  sqft: '',
  yearBuilt: '',
  description: '',
  projectId: '',
  agentId: '',
  floor: '',
  totalFloors: '',
  hasElevator: false,
  maintenanceFee: '',
  amenities: '',
  parkingSpots: '',
  plotSize: '',
  gardenArea: '',
  floors: '',
  hasPool: false,
  hasGarden: false,
  frontage: '',
  ceilingHeight: '',
  licenseType: '',
  footTraffic: 'medium',
  utilities: '',
  zoningType: '',
  buildableArea: '',
  roadAccess: false,
  utilitiesAvailable: '',
  topography: 'flat',
  sharedWalls: '',
};

function buildCreateDto(form: FormState): CreatePropertyDto {
  const dto: CreatePropertyDto = {
    title: form.title.trim(),
    address: form.address.trim(),
    type: form.type as CreatePropertyDto['type'],
    price: Math.round(parseFloat(form.price) * 100),
  };

  if (form.beds) dto.beds = Number(form.beds);
  if (form.baths) dto.baths = Number(form.baths);
  if (form.sqft) dto.sqft = Number(form.sqft);
  if (form.yearBuilt) dto.yearBuilt = Number(form.yearBuilt);
  if (form.description) dto.description = form.description.trim();
  if (form.projectId) dto.projectId = form.projectId;
  if (form.agentId) dto.agentId = form.agentId;

  // Build attributes based on type
  const attributes: Record<string, any> = {};

  if (form.type === 'apartment') {
    if (form.floor) attributes.floor = Number(form.floor);
    if (form.totalFloors) attributes.totalFloors = Number(form.totalFloors);
    attributes.hasElevator = form.hasElevator;
    if (form.maintenanceFee) attributes.maintenanceFee = Number(form.maintenanceFee);
    if (form.amenities) attributes.amenities = form.amenities;
    if (form.parkingSpots) attributes.parkingSpots = Number(form.parkingSpots);
  } else if (form.type === 'villa') {
    if (form.plotSize) attributes.plotSize = Number(form.plotSize);
    if (form.gardenArea) attributes.gardenArea = Number(form.gardenArea);
    if (form.floors) attributes.floors = Number(form.floors);
    attributes.hasPool = form.hasPool;
    attributes.hasGarden = form.hasGarden;
    if (form.parkingSpots) attributes.parkingSpots = Number(form.parkingSpots);
  } else if (form.type === 'commercial') {
    if (form.frontage) attributes.frontage = Number(form.frontage);
    if (form.ceilingHeight) attributes.ceilingHeight = Number(form.ceilingHeight);
    if (form.licenseType) attributes.licenseType = form.licenseType;
    attributes.footTraffic = form.footTraffic;
    if (form.utilities) attributes.utilities = form.utilities;
  } else if (form.type === 'land') {
    if (form.zoningType) attributes.zoningType = form.zoningType;
    if (form.buildableArea) attributes.buildableArea = Number(form.buildableArea);
    attributes.roadAccess = form.roadAccess;
    if (form.utilitiesAvailable) attributes.utilitiesAvailable = form.utilitiesAvailable;
    attributes.topography = form.topography;
  } else if (form.type === 'townhouse') {
    if (form.plotSize) attributes.plotSize = Number(form.plotSize);
    if (form.sharedWalls) attributes.sharedWalls = Number(form.sharedWalls);
    if (form.floors) attributes.floors = Number(form.floors);
    attributes.hasGarden = form.hasGarden;
    if (form.parkingSpots) attributes.parkingSpots = Number(form.parkingSpots);
  }

  if (Object.keys(attributes).length > 0) {
    dto.attributes = attributes;
  }

  return dto;
}

export default function AddPropertyModal({
  onClose,
  onSaved,
  projects,
  agents,
}: AddPropertyModalProps) {
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const presignedUpload = usePresignedUpload();

  function updateField(k: keyof FormState, v: any) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  function validate(): FormErrors {
    const e: FormErrors = {};
    if (!form.title.trim()) e.title = 'Required';
    if (!form.address.trim()) e.address = 'Required';
    if (!form.type) e.type = 'Required';
    const price = parseFloat(form.price);
    if (!form.price || isNaN(price) || price <= 0) e.price = 'Must be greater than 0';
    return e;
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
      // Upload cover photo after the property is created
      if (coverFile && created?.id) {
        setUploading(true);
        try {
          const result = await presignedUpload.mutateAsync({
            propertyId: created.id,
            file: coverFile,
          });
          await propertiesControllerUpdate({
            path: { id: created.id },
            body: { images: [result.fileUrl] },
          });
        } catch (uploadErr: any) {
          // Cover photo upload failed but property was created — just ignore for now
          console.error('Cover photo upload failed:', uploadErr);
        } finally {
          setUploading(false);
        }
      }
    } catch (err: any) {
      setError(err?.detail || err?.message || 'Failed to create property');
    } finally {
      setSaving(false);
    }
  }

  function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Only JPG, PNG, and WebP images are allowed');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setError('File size must be under 25 MB');
      return;
    }

    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    setError('');
  }

  function removeCover() {
    setCoverFile(null);
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverPreview(null);
  }

  function inputCls(field: string) {
    return `w-full bg-white/5 border ${errors[field] ? 'border-red-500/50' : 'border-white/10'} rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-all`;
  }

  function selectCls() {
    return `w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50`;
  }

  function renderAttributeFields() {
    switch (form.type) {
      case 'apartment':
        return (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Floor</label>
              <input
                type="number"
                value={form.floor}
                onChange={(e) => updateField('floor', e.target.value)}
                className={inputCls('floor')}
                placeholder="e.g. 5"
              />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Total Floors</label>
              <input
                type="number"
                value={form.totalFloors}
                onChange={(e) => updateField('totalFloors', e.target.value)}
                className={inputCls('totalFloors')}
                placeholder="e.g. 20"
              />
            </div>
            <div className="col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.hasElevator}
                  onChange={(e) => updateField('hasElevator', e.target.checked)}
                  className="w-4 h-4 rounded bg-white/5 border border-white/10"
                />
                <span className="text-slate-300 text-xs">Has Elevator</span>
              </label>
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Maintenance Fee (monthly)</label>
              <input
                type="number"
                value={form.maintenanceFee}
                onChange={(e) => updateField('maintenanceFee', e.target.value)}
                className={inputCls('maintenanceFee')}
                placeholder="e.g. 500"
              />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Parking Spots</label>
              <input
                type="number"
                value={form.parkingSpots}
                onChange={(e) => updateField('parkingSpots', e.target.value)}
                className={inputCls('parkingSpots')}
                placeholder="e.g. 1"
              />
            </div>
            <div className="col-span-2">
              <label className="text-slate-400 text-xs mb-1 block">Amenities</label>
              <input
                value={form.amenities}
                onChange={(e) => updateField('amenities', e.target.value)}
                className={inputCls('amenities')}
                placeholder="e.g. Gym, Pool, Security"
              />
            </div>
          </div>
        );

      case 'villa':
        return (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Plot Size (sqft)</label>
              <input
                type="number"
                value={form.plotSize}
                onChange={(e) => updateField('plotSize', e.target.value)}
                className={inputCls('plotSize')}
                placeholder="e.g. 5000"
              />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Garden Area (sqft)</label>
              <input
                type="number"
                value={form.gardenArea}
                onChange={(e) => updateField('gardenArea', e.target.value)}
                className={inputCls('gardenArea')}
                placeholder="e.g. 1000"
              />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Floors</label>
              <input
                type="number"
                value={form.floors}
                onChange={(e) => updateField('floors', e.target.value)}
                className={inputCls('floors')}
                placeholder="e.g. 2"
              />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Parking Spots</label>
              <input
                type="number"
                value={form.parkingSpots}
                onChange={(e) => updateField('parkingSpots', e.target.value)}
                className={inputCls('parkingSpots')}
                placeholder="e.g. 2"
              />
            </div>
            <div className="col-span-2 flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.hasPool}
                  onChange={(e) => updateField('hasPool', e.target.checked)}
                  className="w-4 h-4 rounded bg-white/5 border border-white/10"
                />
                <span className="text-slate-300 text-xs">Has Pool</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.hasGarden}
                  onChange={(e) => updateField('hasGarden', e.target.checked)}
                  className="w-4 h-4 rounded bg-white/5 border border-white/10"
                />
                <span className="text-slate-300 text-xs">Has Garden</span>
              </label>
            </div>
          </div>
        );

      case 'commercial':
        return (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Frontage (m)</label>
              <input
                type="number"
                value={form.frontage}
                onChange={(e) => updateField('frontage', e.target.value)}
                className={inputCls('frontage')}
                placeholder="e.g. 10"
              />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Ceiling Height (m)</label>
              <input
                type="number"
                value={form.ceilingHeight}
                onChange={(e) => updateField('ceilingHeight', e.target.value)}
                className={inputCls('ceilingHeight')}
                placeholder="e.g. 4"
              />
            </div>
            <div className="col-span-2">
              <label className="text-slate-400 text-xs mb-1 block">License Type</label>
              <input
                value={form.licenseType}
                onChange={(e) => updateField('licenseType', e.target.value)}
                className={inputCls('licenseType')}
                placeholder="e.g. Commercial, Retail, Office"
              />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Foot Traffic</label>
              <select
                value={form.footTraffic}
                onChange={(e) => updateField('footTraffic', e.target.value)}
                className={selectCls()}
              >
                {footTrafficOptions.map((o) => (
                  <option key={o.value} value={o.value} className="bg-slate-800">
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Utilities</label>
              <input
                value={form.utilities}
                onChange={(e) => updateField('utilities', e.target.value)}
                className={inputCls('utilities')}
                placeholder="e.g. Water, Electricity"
              />
            </div>
          </div>
        );

      case 'land':
        return (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Zoning Type</label>
              <input
                value={form.zoningType}
                onChange={(e) => updateField('zoningType', e.target.value)}
                className={inputCls('zoningType')}
                placeholder="e.g. Residential"
              />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Buildable Area (sqft)</label>
              <input
                type="number"
                value={form.buildableArea}
                onChange={(e) => updateField('buildableArea', e.target.value)}
                className={inputCls('buildableArea')}
                placeholder="e.g. 10000"
              />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Topography</label>
              <select
                value={form.topography}
                onChange={(e) => updateField('topography', e.target.value)}
                className={selectCls()}
              >
                {topographyOptions.map((o) => (
                  <option key={o.value} value={o.value} className="bg-slate-800">
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="flex items-center gap-2 cursor-pointer pt-5">
                <input
                  type="checkbox"
                  checked={form.roadAccess}
                  onChange={(e) => updateField('roadAccess', e.target.checked)}
                  className="w-4 h-4 rounded bg-white/5 border border-white/10"
                />
                <span className="text-slate-300 text-xs">Road Access</span>
              </label>
            </div>
            <div className="col-span-2">
              <label className="text-slate-400 text-xs mb-1 block">Utilities Available</label>
              <input
                value={form.utilitiesAvailable}
                onChange={(e) => updateField('utilitiesAvailable', e.target.value)}
                className={inputCls('utilitiesAvailable')}
                placeholder="e.g. Water, Electricity, Gas"
              />
            </div>
          </div>
        );

      case 'townhouse':
        return (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Plot Size (sqft)</label>
              <input
                type="number"
                value={form.plotSize}
                onChange={(e) => updateField('plotSize', e.target.value)}
                className={inputCls('plotSize')}
                placeholder="e.g. 2500"
              />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Shared Walls</label>
              <input
                type="number"
                value={form.sharedWalls}
                onChange={(e) => updateField('sharedWalls', e.target.value)}
                className={inputCls('sharedWalls')}
                placeholder="e.g. 2"
              />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Floors</label>
              <input
                type="number"
                value={form.floors}
                onChange={(e) => updateField('floors', e.target.value)}
                className={inputCls('floors')}
                placeholder="e.g. 2"
              />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Parking Spots</label>
              <input
                type="number"
                value={form.parkingSpots}
                onChange={(e) => updateField('parkingSpots', e.target.value)}
                className={inputCls('parkingSpots')}
                placeholder="e.g. 1"
              />
            </div>
            <div className="col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.hasGarden}
                  onChange={(e) => updateField('hasGarden', e.target.checked)}
                  className="w-4 h-4 rounded bg-white/5 border border-white/10"
                />
                <span className="text-slate-300 text-xs">Has Garden</span>
              </label>
            </div>
          </div>
        );

      default:
        return null;
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card card-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-white/8">
          <h2 className="text-white font-semibold">Add Property</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Cover Photo */}
          <div className="col-span-2">
            <label className="text-slate-400 text-xs mb-1 block">Cover Photo</label>
            <label className={`flex flex-col items-center justify-center gap-1.5 border-2 border-dashed rounded-xl cursor-pointer transition-all overflow-hidden ${coverPreview ? 'border-blue-500/40 p-0' : 'border-white/10 hover:border-white/20 hover:bg-white/3 p-4'}`}>
              {coverPreview ? (
                <div className="relative w-full h-32">
                  <img src={coverPreview} className="w-full h-full object-cover" alt="Cover preview" />
                  <button type="button" onClick={removeCover} className="absolute top-2 right-2 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-red-500/80 transition-colors"><X size={12} /></button>
                </div>
              ) : (
                <>
                  <ImagePlus size={20} className="text-slate-500" />
                  <p className="text-slate-400 text-xs">Drop a photo or <span className="text-blue-400 underline">browse</span></p>
                  <p className="text-slate-600 text-[10px]">JPG, PNG, WebP · Max 25 MB</p>
                </>
              )}
              <input type="file" className="hidden" accept="image/jpeg,image/png,image/webp" onChange={handleImagePick} />
            </label>
          </div>

          {/* Basic Info */}
          <div>
            <p className="text-slate-400 text-[10px] uppercase tracking-widest mb-3">
              Basic Information
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-slate-400 text-xs mb-1 block">Title *</label>
                <input
                  value={form.title}
                  onChange={(e) => updateField('title', e.target.value)}
                  className={inputCls('title')}
                  placeholder="e.g. Marina Heights #245"
                />
                {errors.title && <p className="text-red-400 text-[10px] mt-0.5">{errors.title}</p>}
              </div>
              <div>
                <label className="text-slate-400 text-xs mb-1 block">Address *</label>
                <input
                  value={form.address}
                  onChange={(e) => updateField('address', e.target.value)}
                  className={inputCls('address')}
                  placeholder="e.g. 123 Palm Street, Dubai Marina"
                />
                {errors.address && (
                  <p className="text-red-400 text-[10px] mt-0.5">{errors.address}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">Type *</label>
                  <select
                    value={form.type}
                    onChange={(e) => updateField('type', e.target.value)}
                    className={selectCls()}
                  >
                    {propertyTypes.map((t) => (
                      <option key={t.value} value={t.value} className="bg-slate-800">
                        {t.label}
                      </option>
                    ))}
                  </select>
                  {errors.type && <p className="text-red-400 text-[10px] mt-0.5">{errors.type}</p>}
                </div>
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">Price ($) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={(e) => updateField('price', e.target.value)}
                    className={inputCls('price')}
                    placeholder="e.g. 1250000"
                  />
                  {errors.price && (
                    <p className="text-red-400 text-[10px] mt-0.5">{errors.price}</p>
                  )}
                </div>
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
                <label className="text-slate-400 text-xs mb-1 block">Bedrooms</label>
                <input
                  type="number"
                  min="0"
                  value={form.beds}
                  onChange={(e) => updateField('beds', e.target.value)}
                  className={inputCls('beds')}
                  placeholder="e.g. 3"
                />
              </div>
              <div>
                <label className="text-slate-400 text-xs mb-1 block">Bathrooms</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={form.baths}
                  onChange={(e) => updateField('baths', e.target.value)}
                  className={inputCls('baths')}
                  placeholder="e.g. 2"
                />
              </div>
              <div>
                <label className="text-slate-400 text-xs mb-1 block">Sqft</label>
                <input
                  type="number"
                  min="0"
                  value={form.sqft}
                  onChange={(e) => updateField('sqft', e.target.value)}
                  className={inputCls('sqft')}
                  placeholder="e.g. 1800"
                />
              </div>
              <div>
                <label className="text-slate-400 text-xs mb-1 block">Year Built</label>
                <input
                  type="number"
                  min="1800"
                  max={new Date().getFullYear() + 5}
                  value={form.yearBuilt}
                  onChange={(e) => updateField('yearBuilt', e.target.value)}
                  className={inputCls('yearBuilt')}
                  placeholder="e.g. 2022"
                />
              </div>
            </div>
            <div className="mt-3">
              <label className="text-slate-400 text-xs mb-1 block">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-all resize-none h-20"
                placeholder="Property description..."
              />
            </div>
          </div>

          {/* Type-specific attributes */}
          <div>
            <p className="text-slate-400 text-[10px] uppercase tracking-widest mb-3 border-t border-white/8 pt-4">
              {propertyTypes.find((t) => t.value === form.type)?.label || 'Property'} Attributes
            </p>
            {renderAttributeFields()}
          </div>

          {/* Assignment */}
          <div>
            <p className="text-slate-400 text-[10px] uppercase tracking-widest mb-3 border-t border-white/8 pt-4">
              Assignment
            </p>
            <div className="grid grid-cols-2 gap-3">
              {projects && (
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">Project</label>
                  <select
                    value={form.projectId}
                    onChange={(e) => updateField('projectId', e.target.value)}
                    className={selectCls()}
                  >
                    <option value="" className="bg-slate-800">
                      None
                    </option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id} className="bg-slate-800">
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {agents && (
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">Agent</label>
                  <select
                    value={form.agentId}
                    onChange={(e) => updateField('agentId', e.target.value)}
                    className={selectCls()}
                  >
                    <option value="" className="bg-slate-800">
                      None
                    </option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id} className="bg-slate-800">
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
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
              {uploading ? 'Uploading...' : saving ? 'Saving...' : 'Add Property'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}