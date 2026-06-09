import type { UserWithKPIs } from '../../types/users'

function fmt(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v}`
}

const roleConfig: Record<string, { label: string; color: string }> = {
  admin: { label: 'Admin', color: 'text-amber-300 bg-amber-500/15 border-amber-500/30' },
  manager: { label: 'Manager', color: 'text-blue-300 bg-blue-500/15 border-blue-500/30' },
  agent: { label: 'Agent', color: 'text-slate-300 bg-slate-500/15 border-slate-500/30' },
}

interface AgentCardProps {
  agent: UserWithKPIs
  onClick: () => void
}

export default function AgentCard({ agent, onClick }: AgentCardProps) {
  const roleCfg = roleConfig[agent.role]

  return (
    <div
      onClick={onClick}
      className="bg-card card-border rounded-2xl p-4 cursor-pointer hover:border-blue-500/30 hover:shadow-lg hover:shadow-blue-500/5 transition-all"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-shrink-0">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold"
            style={{ backgroundColor: `${agent.color}20`, border: `1px solid ${agent.color}40`, color: agent.color }}
          >
            {agent.avatar}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-white text-sm font-semibold truncate">{agent.name}</p>
            <span className={`w-2 h-2 rounded-full ${agent.status === 'active' ? 'bg-emerald-400' : 'bg-red-400'}`} />
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full border ${roleCfg.color}`}>{roleCfg.label}</span>
            <span className="text-slate-500 text-[10px]">{agent.email}</span>
          </div>
        </div>
      </div>

      <div className="flex items-end justify-between mb-3">
        <div>
          <p className="text-slate-500 text-[10px] uppercase tracking-wider">Revenue YTD</p>
          <p className="text-white text-lg font-bold">{fmt(agent.revenueYTD)}</p>
        </div>
        {agent.role === 'agent' && agent.commissionSplit !== undefined && (
          <div className="text-right">
            <p className="text-slate-500 text-[10px] uppercase tracking-wider">Commission</p>
            <p className="text-slate-300 text-xs font-medium">{(agent.commissionSplit * 100).toFixed(0)}%</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1.5 mb-3">
        {[
          { label: 'Deals', value: agent.dealsClosedYTD },
          { label: 'Conversion', value: `${agent.conversionRate}%` },
          { label: 'Active Deals', value: agent.activeDeals },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white/4 border border-white/6 rounded-lg p-1.5 text-center">
            <p className="text-slate-500 text-[9px] uppercase tracking-wide">{label}</p>
            <p className="text-white text-xs font-bold">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-[10px] pt-2 border-t border-white/5">
        <span className="text-slate-500">
          {agent.status === 'active' ? 'Active' : 'Departed'}
        </span>
        <span className="text-slate-500">
          NPS: {agent.npsScore}
        </span>
      </div>
    </div>
  )
}