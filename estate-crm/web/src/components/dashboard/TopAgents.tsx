import { Trophy, TrendingUp, TrendingDown } from 'lucide-react'

function fmt(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  return `$${(v / 1000).toFixed(0)}K`
}

interface Agent {
  id: string | number
  name: string
  avatar?: string
  color?: string
  region?: string
  dealsThisMonth?: number
  revenue: number
  trend: number
}

export default function TopAgents({ agents }: { agents: Agent[] }) {
  return (
    <div className="bg-card card-border rounded-2xl p-5 glow-blue">
      <div className="flex items-center gap-2 mb-4">
        <Trophy size={15} className="text-amber-400" />
        <p className="text-white font-semibold text-sm">Top Performers</p>
      </div>
      <div className="space-y-3">
        {agents.map((agent, i) => (
          <div key={agent.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors group">
            <div className="relative">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ backgroundColor: `${agent.color}25`, border: `1px solid ${agent.color}40` }}
              >
                <span style={{ color: agent.color }}>{agent.avatar}</span>
              </div>
              {i === 0 && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center text-[8px] text-black font-bold">
                  #1
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium">{agent.name}</p>
              <p className="text-slate-500 text-[10px]">{agent.region} · {agent.dealsThisMonth} deals closed</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-white text-xs font-semibold">{fmt(agent.revenue)}</p>
              <div className={`flex items-center gap-0.5 justify-end text-[10px] font-medium ${agent.trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {agent.trend >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                {agent.trend >= 0 ? '+' : ''}{agent.trend}%
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
