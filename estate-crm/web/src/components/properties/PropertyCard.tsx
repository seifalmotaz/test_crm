import { Bed, Bath, Maximize2, MapPin } from 'lucide-react';
import type { PropertyView } from '../../types/properties';

const typeConfig: Record<string, { label: string; icon: string }> = {
  apartment: { label: 'Apartment', icon: '🏢' },
  villa: { label: 'Villa', icon: '🏠' },
  commercial: { label: 'Commercial', icon: '🏪' },
  land: { label: 'Land', icon: '🌳' },
  townhouse: { label: 'Townhouse', icon: '🏘️' },
};

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  active: { label: 'Active', bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
  pending: { label: 'Pending', bg: 'bg-amber-500/15', text: 'text-amber-400' },
  sold: { label: 'Sold', bg: 'bg-slate-500/15', text: 'text-slate-400' },
  withdrawn: { label: 'Withdrawn', bg: 'bg-red-500/15', text: 'text-red-400' },
};

function fmtPriceShort(cents: number): string {
  if (cents >= 1_000_000_00) {
    return `$${(cents / 100_000_00).toFixed(1)}M`;
  }
  if (cents >= 100_000_00) {
    return `$${(cents / 100_00).toFixed(0)}K`;
  }
  return `$${(cents / 100).toLocaleString('en-US')}`;
}

interface PropertyCardProps {
  property: PropertyView;
  onClick: () => void;
}

export default function PropertyCard({ property, onClick }: PropertyCardProps) {
  const typeCfg = typeConfig[property.type] || { label: property.type, icon: '📋' };
  const statusCfg = statusConfig[property.status] || { label: property.status, bg: 'bg-slate-500/15', text: 'text-slate-400' };
  const hasImage = property.images && property.images.length > 0;

  function generateGradient(id: string): string {
    const colors = [
      'from-blue-600/40 via-indigo-600/30 to-purple-700/40',
      'from-emerald-600/40 via-teal-600/30 to-cyan-700/40',
      'from-amber-600/40 via-orange-600/30 to-red-700/40',
      'from-violet-600/40 via-purple-600/30 to-fuchsia-700/40',
      'from-rose-600/40 via-pink-600/30 to-red-700/40',
    ];
    const idx =
      id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length;
    return colors[idx];
  }

  return (
    <div
      onClick={onClick}
      className="bg-card card-border rounded-2xl overflow-hidden cursor-pointer hover:border-blue-500/30 transition-all group"
    >
      {/* Image / Gradient area */}
      <div className="relative h-40 bg-navy-800 overflow-hidden">
        {hasImage ? (
          <img
            src={property.images[0]}
            alt={property.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div
            className={`w-full h-full bg-gradient-to-br ${generateGradient(property.id)} flex items-center justify-center`}
          >
            <span className="text-4xl opacity-50">{typeCfg.icon}</span>
          </div>
        )}

        {/* Status badge */}
        <span
          className={`absolute top-2 left-2 text-[10px] font-medium px-2 py-0.5 rounded-full border border-white/10 ${statusCfg.bg} ${statusCfg.text}`}
        >
          {statusCfg.label}
        </span>

        {/* Price */}
        <div className="absolute bottom-2 left-2">
          <span className="text-white text-sm font-bold drop-shadow-lg">
            {fmtPriceShort(property.price)}
          </span>
        </div>
      </div>

      {/* Details */}
      <div className="p-3 space-y-2">
        <div>
          <p className="text-white text-xs font-semibold truncate leading-tight">
            {property.title}
          </p>
          <p className="text-slate-500 text-[10px] truncate flex items-center gap-1 mt-0.5">
            <MapPin size={10} className="flex-shrink-0" />
            {property.address}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium text-slate-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
            {typeCfg.label}
          </span>
        </div>

        {(property.beds !== undefined || property.baths !== undefined || property.sqft !== undefined) && (
          <div className="flex items-center gap-3 text-slate-400">
            {property.beds !== undefined && (
              <span className="flex items-center gap-1 text-[10px]">
                <Bed size={11} /> {property.beds}
              </span>
            )}
            {property.baths !== undefined && (
              <span className="flex items-center gap-1 text-[10px]">
                <Bath size={11} /> {property.baths}
              </span>
            )}
            {property.sqft !== undefined && (
              <span className="flex items-center gap-1 text-[10px]">
                <Maximize2 size={11} /> {property.sqft.toLocaleString()} sqft
              </span>
            )}
          </div>
        )}

        {property.tags && property.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {property.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-[9px] text-slate-500 bg-white/5 px-1.5 py-0.5 rounded-md"
              >
                {tag}
              </span>
            ))}
            {property.tags.length > 3 && (
              <span className="text-[9px] text-slate-500">
                +{property.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}