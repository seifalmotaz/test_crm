import { Building2, MapPin } from 'lucide-react';
import type { ProjectView } from '../../types/projects';

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  planning: { label: 'Planning', bg: 'bg-blue-500/15', text: 'text-blue-400' },
  preLaunch: { label: 'Pre-Launch', bg: 'bg-purple-500/15', text: 'text-purple-400' },
  active: { label: 'Active', bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
  soldOut: { label: 'Sold Out', bg: 'bg-amber-500/15', text: 'text-amber-400' },
  delivered: { label: 'Delivered', bg: 'bg-slate-500/15', text: 'text-slate-400' },
};

interface ProjectCardProps {
  project: ProjectView;
  onClick: () => void;
}

function generateGradient(id: string): string {
  const colors = [
    'from-blue-600/40 via-indigo-600/30 to-purple-700/40',
    'from-emerald-600/40 via-teal-600/30 to-cyan-700/40',
    'from-amber-600/40 via-orange-600/30 to-red-700/40',
    'from-violet-600/40 via-purple-600/30 to-fuchsia-700/40',
    'from-rose-600/40 via-pink-600/30 to-red-700/40',
    'from-sky-600/40 via-blue-600/30 to-indigo-700/40',
  ];
  const idx = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length;
  return colors[idx];
}

export default function ProjectCard({ project, onClick }: ProjectCardProps) {
  const statusCfg = statusConfig[project.status] || { label: project.status, bg: 'bg-slate-500/15', text: 'text-slate-400' };
  const pct = project.totalUnits && project.totalUnits > 0
    ? Math.round((project.soldUnits / project.totalUnits) * 100)
    : 0;

  return (
    <div
      onClick={onClick}
      className="bg-card card-border rounded-2xl overflow-hidden cursor-pointer hover:border-blue-500/30 transition-all group"
    >
      {/* Gradient header */}
      <div className={`h-28 bg-gradient-to-br ${generateGradient(project.id)} flex items-center justify-center relative`}>
        <Building2 size={40} className="text-white/30" />

        {/* Status badge */}
        <span
          className={`absolute top-2 left-2 text-[10px] font-medium px-2 py-0.5 rounded-full border border-white/10 ${statusCfg.bg} ${statusCfg.text}`}
        >
          {statusCfg.label}
        </span>
      </div>

      {/* Content */}
      <div className="p-3 space-y-2">
        <div>
          <p className="text-white text-xs font-semibold truncate leading-tight">
            {project.name}
          </p>
          <p className="text-slate-500 text-[10px] truncate flex items-center gap-1 mt-0.5">
            <MapPin size={10} className="flex-shrink-0" />
            {project.location}
          </p>
        </div>

        {project.developerName && (
          <p className="text-slate-400 text-[10px]">{project.developerName}</p>
        )}

        {project.totalUnits && project.totalUnits > 0 ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-slate-400">
                {project.soldUnits} / {project.totalUnits}
              </span>
              <span className="text-slate-500">{pct}%</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full w-0 bg-blue-500 rounded-full" />
          </div>
        )}

        <div className="flex items-center gap-2">
          {project.launchDate && (
            <span className="text-[10px] text-slate-500 bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
              Launch: {new Date(project.launchDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          )}
          {project.completionDate && (
            <span className="text-[10px] text-slate-500 bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
              Est: {new Date(project.completionDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}