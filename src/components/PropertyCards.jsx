import { ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

function fmt(v) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(3).replace(/\.?0+$/, '')}M`
  return `$${(v / 1000).toFixed(1)}K`
}

function StageTag({ status }) {
  const map = {
    active: 'bg-emerald-500/15 text-emerald-400',
    negotiating: 'bg-amber-500/15 text-amber-400',
    closing: 'bg-blue-500/15 text-blue-400',
  }
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full capitalize ${map[status] ?? 'bg-slate-500/15 text-slate-400'}`}>
      {status}
    </span>
  )
}

export default function PropertyCards({ properties }) {
  const navigate = useNavigate()

  return (
    <div className="bg-card card-border rounded-2xl p-5 glow-blue">
      <div className="flex items-center justify-between mb-4">
        <p className="text-white font-semibold text-sm">My Properties</p>
        <button
          onClick={() => navigate('/properties')}
          className="flex items-center gap-1 text-blue-400 text-xs hover:text-[#E53935] transition-colors"
        >
          See all <ChevronRight size={13} />
        </button>
      </div>

      <div className="grid grid-cols-5 gap-3">
        {properties.map((p) => (
          <div
            key={p.id}
            onClick={() => navigate('/properties')}
            className="bg-white/4 border border-white/8 rounded-xl p-3 cursor-pointer hover:bg-white/8 hover:border-[#E53935]/30 transition-all group"
          >
            <div className="flex items-start justify-between mb-2">
              <span className="text-xl">{p.icon}</span>
              <StageTag status={p.status} />
            </div>
            <p className="text-white font-semibold text-sm leading-tight mb-0.5">
              {fmt(p.value ?? p.price ?? 0)}
            </p>
            <div className={`flex items-center gap-1 text-xs font-medium mb-2 ${(p.change ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              <span>{(p.change ?? 0) >= 0 ? '+' : ''}{p.changePct ?? 0}%</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${(p.change ?? 0) >= 0 ? 'bg-emerald-500/15' : 'bg-red-500/15'}`}>
                {(p.change ?? 0) >= 0 ? '+' : ''}{(p.change ?? 0).toFixed(1)}
              </span>
            </div>
            <p className="text-slate-400 text-[10px] truncate">{p.address}</p>
            <p className="text-slate-500 text-[10px]">{p.type} · {p.units} units</p>
          </div>
        ))}
      </div>
    </div>
  )
}
