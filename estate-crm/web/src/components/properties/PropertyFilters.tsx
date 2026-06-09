import { Search, X } from 'lucide-react';
import { useMemo } from 'react';
import type { PropertyFilters } from '../../types/properties';

interface PropertyFiltersBarProps {
  filters: PropertyFilters;
  onChange: (filters: PropertyFilters) => void;
  resultCount: number;
}

function hasActiveFilter(f: PropertyFilters): boolean {
  return !!(
    f.search ||
    (f.status && f.status !== 'all') ||
    (f.type && f.type !== 'all') ||
    f.minPrice !== undefined ||
    f.maxPrice !== undefined ||
    f.beds !== undefined
  );
}

export default function PropertyFiltersBar({
  filters,
  onChange,
  resultCount,
}: PropertyFiltersBarProps) {
  const activeFiltersPresent = useMemo(() => hasActiveFilter(filters), [filters]);

  function update(changes: Partial<PropertyFilters>) {
    onChange({ ...filters, ...changes });
  }

  function clearFilters() {
    onChange({
      search: '',
      status: undefined,
      type: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      beds: undefined,
      page: 1,
      limit: 100,
    });
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
      <div className="relative flex-1">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={filters.search || ''}
          onChange={(e) => update({ search: e.target.value })}
          placeholder="Search by title or address..."
          className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-all"
        />
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={filters.status || 'all'}
          onChange={(e) =>
            update({ status: e.target.value === 'all' ? undefined : e.target.value })
          }
          className="appearance-none bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none cursor-pointer"
        >
          <option value="all" className="bg-navy-800">All Status</option>
          <option value="active" className="bg-navy-800">Active</option>
          <option value="pending" className="bg-navy-800">Pending</option>
          <option value="sold" className="bg-navy-800">Sold</option>
          <option value="withdrawn" className="bg-navy-800">Withdrawn</option>
        </select>

        <select
          value={filters.type || 'all'}
          onChange={(e) =>
            update({ type: e.target.value === 'all' ? undefined : e.target.value })
          }
          className="appearance-none bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none cursor-pointer"
        >
          <option value="all" className="bg-navy-800">All Types</option>
          <option value="apartment" className="bg-navy-800">Apartment</option>
          <option value="villa" className="bg-navy-800">Villa</option>
          <option value="commercial" className="bg-navy-800">Commercial</option>
          <option value="land" className="bg-navy-800">Land</option>
          <option value="townhouse" className="bg-navy-800">Townhouse</option>
        </select>

        <div className="flex items-center gap-1">
          <input
            type="number"
            placeholder="Min $"
            value={filters.minPrice !== undefined ? filters.minPrice / 100 : ''}
            onChange={(e) =>
              update({
                minPrice: e.target.value
                  ? Math.round(parseFloat(e.target.value) * 100)
                  : undefined,
              })
            }
            className="w-[80px] bg-white/5 border border-white/10 rounded-xl px-2 py-2 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-all"
          />
          <span className="text-slate-600 text-xs">–</span>
          <input
            type="number"
            placeholder="Max $"
            value={filters.maxPrice !== undefined ? filters.maxPrice / 100 : ''}
            onChange={(e) =>
              update({
                maxPrice: e.target.value
                  ? Math.round(parseFloat(e.target.value) * 100)
                  : undefined,
              })
            }
            className="w-[80px] bg-white/5 border border-white/10 rounded-xl px-2 py-2 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-all"
          />
        </div>

        <select
          value={filters.beds !== undefined ? String(filters.beds) : 'any'}
          onChange={(e) =>
            update({ beds: e.target.value === 'any' ? undefined : Number(e.target.value) })
          }
          className="appearance-none bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none cursor-pointer"
        >
          <option value="any" className="bg-navy-800">Any Beds</option>
          <option value="1" className="bg-navy-800">1+</option>
          <option value="2" className="bg-navy-800">2+</option>
          <option value="3" className="bg-navy-800">3+</option>
          <option value="4" className="bg-navy-800">4+</option>
          <option value="5" className="bg-navy-800">5+</option>
        </select>

        {activeFiltersPresent && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 px-2.5 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <X size={12} />
            Clear
          </button>
        )}
      </div>
      <span className="text-slate-500 text-xs whitespace-nowrap">
        {resultCount} result{resultCount !== 1 ? 's' : ''}
      </span>
    </div>
  );
}