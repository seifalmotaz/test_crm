import { DollarSign, AlertTriangle, TrendingUp, Clock, Flame } from 'lucide-react';
import { fmtCents } from '../../lib/format';

interface DealPipelineHeaderProps {
  totalDeals: number;
  totalValue: number;
  closingThisWeek: number;
  closingThisWeekValue: number;
  atRisk: number;
  commissionPending: number;
  commissionThisMonth: number;
  avgDaysToClose: number;
}

const accentMap: Record<string, string> = {
  blue: 'bg-blue-500/15 text-blue-400',
  green: 'bg-emerald-500/15 text-emerald-400',
  red: 'bg-red-500/15 text-red-400',
  amber: 'bg-amber-500/15 text-amber-400',
  purple: 'bg-purple-500/15 text-purple-400',
};

function Stat({
  icon: Icon,
  label,
  value,
  sub,
  color = 'blue',
}: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="bg-card card-border rounded-2xl p-4 glow-blue flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${accentMap[color]}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-slate-400 text-[10px] uppercase tracking-wider">{label}</p>
        <p className="text-white text-lg font-bold">{value}</p>
        {sub && <p className="text-slate-500 text-[10px]">{sub}</p>}
      </div>
    </div>
  );
}

export default function DealPipelineHeader(props: DealPipelineHeaderProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
      <Stat
        icon={DollarSign}
        label="Pipeline Value"
        value={fmtCents(props.totalValue)}
        sub={`${props.totalDeals} active deals`}
        color="blue"
      />
      <Stat
        icon={Flame}
        label="Closing This Week"
        value={fmtCents(props.closingThisWeekValue)}
        sub={`${props.closingThisWeek} deals`}
        color="green"
      />
      <Stat
        icon={AlertTriangle}
        label="At Risk"
        value={String(props.atRisk)}
        sub="need immediate action"
        color="red"
      />
      <Stat
        icon={TrendingUp}
        label="Commission Pending"
        value={fmtCents(props.commissionPending)}
        sub={`${fmtCents(props.commissionThisMonth)} this month`}
        color="purple"
      />
      <Stat
        icon={Clock}
        label="Avg Days to Close"
        value={`${props.avgDaysToClose}d`}
        color="amber"
      />
      <Stat
        icon={DollarSign}
        label="Total Deals"
        value={String(props.totalDeals)}
        sub="active pipeline"
        color="blue"
      />
    </div>
  );
}
