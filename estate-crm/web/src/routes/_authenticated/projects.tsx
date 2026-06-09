import { useState, useMemo } from 'react';
import { Plus, Loader2, Search, CheckCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  useProjects,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  useChangeProjectStatus,
} from '../../hooks/useProjects';
import type { ProjectResponseDto, CreateProjectDto, UpdateProjectDto } from '../../api/types.gen';
import type { ProjectView, ProjectFilters } from '../../types/projects';
import ProjectCard from '../../components/projects/ProjectCard';
import ProjectDrawer from '../../components/projects/ProjectDrawer';
import AddProjectModal from '../../components/projects/AddProjectModal';

const statusOptions = [
  { value: 'all', label: 'All Statuses' },
  { value: 'planning', label: 'Planning' },
  { value: 'preLaunch', label: 'Pre-Launch' },
  { value: 'active', label: 'Active' },
  { value: 'soldOut', label: 'Sold Out' },
  { value: 'delivered', label: 'Delivered' },
];

function toProjectView(dto: ProjectResponseDto): ProjectView {
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description,
    location: dto.location,
    developerName: dto.developerName,
    status: dto.status,
    launchDate: dto.launchDate,
    completionDate: dto.completionDate,
    totalUnits: dto.totalUnits,
    soldUnits: dto.soldUnits ?? 0,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

export default function ProjectsPage() {
  const { user } = useAuth();
  const canManage = ['admin', 'manager'].includes(user?.role || '');
  const [selectedProject, setSelectedProject] = useState<ProjectView | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [toast, setToast] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filters = useMemo<ProjectFilters>(() => {
    const f: ProjectFilters = {};
    if (search) f.search = search;
    if (statusFilter !== 'all') f.status = statusFilter;
    f.limit = 100;
    return f;
  }, [search, statusFilter]);

  const { data: projectsData, isLoading, error } = useProjects(filters);

  const projects = useMemo<ProjectView[]>(() => {
    return (projectsData?.data || []).map(toProjectView);
  }, [projectsData]);

  const createMutation = useCreateProject();
  const selectedId = selectedProject?.id || '';
  const updateMutation = useUpdateProject(selectedId);
  const deleteMutation = useDeleteProject(selectedId);
  const changeStatusMutation = useChangeProjectStatus(selectedId);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  // Stats
  const stats = useMemo(() => {
    const all = projects;
    const total = all.length;
    const active = all.filter((p) => p.status === 'active').length;
    const planning = all.filter((p) => p.status === 'planning').length;
    const soldOut = all.filter((p) => p.status === 'soldOut').length;
    const delivered = all.filter((p) => p.status === 'delivered').length;
    const totalUnits = all.reduce((sum, p) => sum + (p.totalUnits || 0), 0);
    const soldUnits = all.reduce((sum, p) => sum + (p.soldUnits || 0), 0);
    return { total, active, planning, soldOut, delivered, totalUnits, soldUnits };
  }, [projects]);

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="flex items-center justify-center py-40">
          <Loader2 size={32} className="text-blue-400 animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6">
        <div className="flex flex-col items-center justify-center py-20 bg-card card-border rounded-2xl">
          <p className="text-white font-semibold mb-1">Failed to load projects</p>
          <p className="text-slate-400 text-xs">
            {(error as any)?.detail || (error as any)?.message || 'An unexpected error occurred'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-white text-xl font-bold tracking-tight">Projects</h1>
          <p className="text-slate-400 text-sm mt-0.5">Manage your real estate developments</p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 rounded-xl text-xs font-medium text-white hover:bg-blue-600 transition-all"
          >
            <Plus size={13} /> Add Project
          </button>
        )}
      </div>

      {/* Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-4">
        <div className="bg-card card-border rounded-2xl p-3">
          <p className="text-slate-500 text-[10px] uppercase tracking-wider">Total</p>
          <p className="text-white text-lg font-bold mt-1">{stats.total}</p>
        </div>
        <div className="bg-card card-border rounded-2xl p-3">
          <p className="text-slate-500 text-[10px] uppercase tracking-wider">Active</p>
          <p className="text-emerald-400 text-lg font-bold mt-1">{stats.active}</p>
        </div>
        <div className="bg-card card-border rounded-2xl p-3">
          <p className="text-slate-500 text-[10px] uppercase tracking-wider">Planning</p>
          <p className="text-blue-400 text-lg font-bold mt-1">{stats.planning}</p>
        </div>
        <div className="bg-card card-border rounded-2xl p-3">
          <p className="text-slate-500 text-[10px] uppercase tracking-wider">Sold Out</p>
          <p className="text-amber-400 text-lg font-bold mt-1">{stats.soldOut}</p>
        </div>
        <div className="bg-card card-border rounded-2xl p-3">
          <p className="text-slate-500 text-[10px] uppercase tracking-wider">Delivered</p>
          <p className="text-slate-400 text-lg font-bold mt-1">{stats.delivered}</p>
        </div>
        <div className="bg-card card-border rounded-2xl p-3">
          <p className="text-slate-500 text-[10px] uppercase tracking-wider">Total Units</p>
          <p className="text-white text-lg font-bold mt-1">{stats.totalUnits.toLocaleString()}</p>
        </div>
        <div className="bg-card card-border rounded-2xl p-3">
          <p className="text-slate-500 text-[10px] uppercase tracking-wider">Sold Units</p>
          <p className="text-white text-lg font-bold mt-1">{stats.soldUnits.toLocaleString()}</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-all"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50"
        >
          {statusOptions.map((o) => (
            <option key={o.value} value={o.value} className="bg-slate-800">
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Project Grid */}
      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-card card-border rounded-2xl">
          <p className="text-slate-400 text-sm mb-1">No projects found</p>
          <p className="text-slate-500 text-xs mb-4">
            {(search || statusFilter !== 'all')
              ? 'Try adjusting your search or filters.'
              : 'Add a new project to get started.'}
          </p>
          {(search || statusFilter !== 'all') && (
            <button
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
              }}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-slate-400 hover:text-white transition-all"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onClick={() => setSelectedProject(project)}
            />
          ))}
        </div>
      )}

      {/* Project Drawer */}
      <ProjectDrawer
        project={selectedProject}
        onClose={() => setSelectedProject(null)}
        onUpdate={async (data: UpdateProjectDto) => {
          return new Promise<void>((resolve, reject) => {
            updateMutation.mutate(data, {
              onSuccess: () => {
                showToast('Project updated');
                resolve();
              },
              onError: (err: any) => {
                reject(err);
              },
            });
          });
        }}
        onDelete={() => {
          deleteMutation.mutate(undefined, {
            onSuccess: () => {
              showToast('Project deleted');
              setSelectedProject(null);
            },
            onError: (err: any) => showToast(err?.detail || 'Failed to delete'),
          });
        }}
        onChangeStatus={(status) => {
          changeStatusMutation.mutate(
            { status: status as 'planning' | 'preLaunch' | 'active' | 'soldOut' | 'delivered' },
            {
              onSuccess: () => {
                showToast(`Status changed to ${status}`);
              },
              onError: (err: any) => showToast(err?.detail || 'Failed to change status'),
            },
          );
        }}
        canManage={canManage}
      />

      {/* Add Project Modal */}
      {showAddModal && (
        <AddProjectModal
          onClose={() => setShowAddModal(false)}
          onSaved={async (formData: CreateProjectDto) => {
            return new Promise<void>((resolve, reject) => {
              createMutation.mutate(formData, {
                onSuccess: () => {
                  showToast('Project created');
                  setShowAddModal(false);
                  resolve();
                },
                onError: (err: any) => {
                  reject(err);
                },
              });
            });
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium px-4 py-3 rounded-2xl shadow-lg">
          <CheckCircle size={14} />
          {toast}
        </div>
      )}
    </div>
  );
}