import { Users, UserCheck, UserX, UserCog, Percent } from 'lucide-react'

interface TileProps {
  icon: React.ComponentType<{ size?: number }>
  label: string
  value: string | number
  sub?: string
  color?: string
}

function Tile({ icon: Icon, label, value, sub, color = 'blue' }: TileProps) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-500/15 text-blue-400',
    amber: 'bg-amber-500/15 text-amber-400',
    green: 'bg-emerald-500/15 text-emerald-400',
    red: 'bg-red-500/15 text-red-400',
    purple: 'bg-purple-500/15 text-purple-400',
  }

  return (
    <div className="bg-card card-border rounded-2xl p-4 flex items-center gap-3 glow-blue">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colors[color]}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-slate-400 text-[10px] uppercase tracking-wider">{label}</p>
        <p className="text-white text-lg font-bold">{value}</p>
        {sub && <p className="text-slate-500 text-[10px]">{sub}</p>}
      </div>
    </div>
  )
}

interface TeamSummaryData {
  totalUsers: number
  activeAgents: number
  inactiveAgents: number
  managers: number
  avgCommissionSplit: number
}

interface TeamSummaryBarProps {
  data: TeamSummaryData
}

export default function TeamSummaryBar({ data }: TeamSummaryBarProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
      <Tile icon={Users} label="Total Users" value={data.totalUsers} sub={`${data.managers} manager${data.managers !== 1 ? 's' : ''}`} color="blue" />
      <Tile icon={UserCheck} label="Active Agents" value={data.activeAgents} sub="Currently active" color="green" />
      <Tile icon={UserX} label="Inactive" value={data.inactiveAgents} sub="Departed" color="red" />
      <Tile icon={UserCog} label="Managers" value={data.managers} sub="Team leads" color="amber" />
      <Tile icon={Percent} label="Avg Commission Split" value={`${data.avgCommissionSplit}%`} sub="Agent share" color="purple" />
    </div>
  )
}