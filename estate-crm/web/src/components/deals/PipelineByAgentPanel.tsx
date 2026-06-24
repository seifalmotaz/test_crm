import { fmtCents } from '../../lib/format';

interface PipelineByAgentPanelProps {
  agents: Array<{
    name: string;
    avatar?: string;
    color?: string;
    dealCount: number;
    totalValue: number;
  }>;
}

export default function PipelineByAgentPanel({ agents }: PipelineByAgentPanelProps) {
  const maxValue = Math.max(...agents.map((a) => a.totalValue), 1);

  return (
    <div className="bg-card card-border rounded-2xl p-4 glow-blue">
      <p className="text-white font-semibold text-xs mb-3">Pipeline by Agent</p>
      <div className="space-y-2">
        {agents.length === 0 ? (
          <p className="text-slate-500 text-xs">No agents with deals</p>
        ) : (
          agents.map((agent) => {
            const initials = agent.name
              .split(' ')
              .map((w) => w[0])
              .join('')
              .toUpperCase();
            const barWidth = Math.max((agent.totalValue / maxValue) * 100, 2);
            return (
              <div key={agent.name} className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-300 text-[9px] font-bold flex-shrink-0">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-300 text-[10px] truncate">
                    {agent.name.split(' ')[0]}
                  </p>
                  <div className="h-1 bg-white/5 rounded-full mt-1 overflow-hidden">
                    <div
                      className="h-full bg-blue-400 rounded-full"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-white text-[10px] font-semibold">
                    {fmtCents(agent.totalValue)}
                  </p>
                  <p className="text-slate-500 text-[9px]">
                    {agent.dealCount} deal{agent.dealCount !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
