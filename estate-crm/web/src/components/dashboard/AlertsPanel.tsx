import { AlertTriangle, AlertCircle, Info, ChevronRight } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';

const priorityConfig: Record<string, { icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; color: string; bg: React.CSSProperties }> = {
  high:   { icon: AlertTriangle, color: '#C08090', bg: { background: 'rgba(192,128,144,0.08)', borderColor: 'rgba(192,128,144,0.18)' } },
  medium: { icon: AlertCircle,   color: '#C9963A', bg: { background: 'rgba(201,150,58,0.08)',  borderColor: 'rgba(201,150,58,0.18)'  } },
  low:    { icon: Info,          color: '#6B9EC7', bg: { background: 'rgba(107,158,199,0.08)', borderColor: 'rgba(107,158,199,0.18)' } },
};

interface Alert {
  priority: 'high' | 'medium' | 'low';
  message: string;
  action?: string;
  linkTo?: string;
}

export default function AlertsPanel({ alerts }: { alerts: Alert[] }) {
  const navigate = useNavigate();
  const highCount = alerts.filter((a) => a.priority === 'high').length;
  return (
    <div className="bg-card card-border rounded-2xl p-5 glow-blue">
      <div className="flex items-center justify-between mb-4">
        <p className="text-white font-semibold text-sm">Alerts & Actions</p>
        <span
          className="text-[10px] px-2 py-0.5 rounded-full font-medium"
          style={{ background: 'rgba(192,128,144,0.12)', color: '#C08090' }}
        >
          {highCount} urgent
        </span>
      </div>
      <div className="space-y-2.5">
        {alerts.map((alert, i) => {
          const { icon: Icon, color, bg } = priorityConfig[alert.priority] ?? priorityConfig.low;
          return (
            <button
              key={i}
              onClick={() => alert.linkTo && navigate({ to: alert.linkTo })}
              disabled={!alert.linkTo}
              className="w-full flex items-start gap-3 p-3 rounded-xl border text-start cursor-pointer hover:brightness-110 transition-all disabled:cursor-default"
              style={bg}
            >
              <div className="flex-shrink-0 mt-0.5">
                <Icon size={14} style={{ color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-medium leading-snug">{alert.message}</p>
                <p className="text-slate-500 text-[10px] mt-0.5">{alert.action}</p>
              </div>
              <ChevronRight size={13} className="text-slate-600 flex-shrink-0 mt-0.5" />
            </button>
          );
        })}
      </div>
    </div>
  );
}