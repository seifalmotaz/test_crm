import { useMemo } from 'react';
import type { PropertyView } from '../../types/properties';

function fmtPrice(cents: number): string {
  if (cents >= 1_000_000_00) {
    return `$${(cents / 100_000_00).toFixed(1)}M`;
  }
  if (cents >= 100_000_00) {
    return `$${(cents / 100_00).toFixed(0)}K`;
  }
  return `$${(cents / 100).toLocaleString('en-US')}`;
}

interface MarketStripProps {
  properties: PropertyView[];
}

export default function MarketStrip({ properties }: MarketStripProps) {
  const stats = useMemo(() => {
    const total = properties.length;
    const active = properties.filter((p) => p.status === 'active').length;
    const pending = properties.filter((p) => p.status === 'pending').length;
    const sold = properties.filter((p) => p.status === 'sold').length;
    const totalPrice = properties.reduce((sum, p) => sum + p.price, 0);
    const avgPrice = total > 0 ? Math.round(totalPrice / total) : 0;
    return { total, active, pending, sold, avgPrice };
  }, [properties]);

  return (
    <div className="bg-card card-border rounded-2xl p-4 mb-4 flex items-center gap-6 text-xs">
      <div className="flex items-center gap-1.5">
        <span className="text-slate-400">Total</span>
        <span className="text-white font-semibold">{stats.total}</span>
      </div>
      <div className="w-px h-3 bg-white/10" />
      <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        <span className="text-slate-400">Active</span>
        <span className="text-emerald-400 font-semibold">{stats.active}</span>
      </div>
      <div className="w-px h-3 bg-white/10" />
      <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        <span className="text-slate-400">Pending</span>
        <span className="text-amber-400 font-semibold">{stats.pending}</span>
      </div>
      <div className="w-px h-3 bg-white/10" />
      <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
        <span className="text-slate-400">Sold</span>
        <span className="text-slate-300 font-semibold">{stats.sold}</span>
      </div>
      <div className="w-px h-3 bg-white/10" />
      <div className="flex items-center gap-1.5">
        <span className="text-slate-400">Avg Price</span>
        <span className="text-white font-semibold">{fmtPrice(stats.avgPrice)}</span>
      </div>
    </div>
  );
}