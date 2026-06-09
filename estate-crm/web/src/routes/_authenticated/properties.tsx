import { useState, useMemo, useCallback } from 'react';
import { Plus, Loader2, LayoutGrid, List, CheckCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useProperties, useCreateProperty, useUpdateProperty, useDeleteProperty, useChangePropertyStatus } from '../../hooks/useProperties';
import { usersControllerFindAll } from '../../api/sdk.gen';
import { projectsControllerFindAll } from '../../api/sdk.gen';
import { useQuery } from '@tanstack/react-query';
import type { PropertyResponseDto } from '../../api/types.gen';
import type { CreatePropertyDto, UpdatePropertyDto } from '../../api/types.gen';
import type { PropertyView, PropertyFilters } from '../../types/properties';
import MarketStrip from '../../components/properties/MarketStrip';
import PropertyFiltersBar from '../../components/properties/PropertyFilters';
import PropertyCard from '../../components/properties/PropertyCard';
import PropertyDrawer from '../../components/properties/PropertyDrawer';
import AddPropertyModal from '../../components/properties/AddPropertyModal';

function toPropertyView(dto: PropertyResponseDto): PropertyView {
  return {
    id: dto.id,
    title: dto.title,
    address: dto.address,
    type: dto.type,
    status: dto.status,
    price: dto.price,
    beds: dto.beds,
    baths: dto.baths,
    sqft: dto.sqft,
    yearBuilt: dto.yearBuilt,
    attributes: dto.attributes,
    images: dto.images || [],
    videos: dto.videos || [],
    tags: dto.tags || [],
    projectId: dto.projectId,
    agentId: dto.agentId,
    commissionPlanId: dto.commissionPlanId,
    description: dto.description,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

export default function PropertiesPage() {
  const { user } = useAuth();
  const canManage = ['admin', 'manager'].includes(user?.role || '');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedProperty, setSelectedProperty] = useState<PropertyView | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [toast, setToast] = useState('');

  const [filters, setFilters] = useState<PropertyFilters>({
    search: '',
    status: undefined,
    type: undefined,
    minPrice: undefined,
    maxPrice: undefined,
    beds: undefined,
    page: 1,
    limit: 100,
  });

  const { data: propertiesData, isLoading, error } = useProperties(filters);

  // Fetch projects for dropdown
  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data } = await projectsControllerFindAll({ query: { limit: 100 } });
      return data;
    },
  });

  // Fetch agents for dropdown
  const { data: agentsData } = useQuery({
    queryKey: ['agents-for-properties'],
    queryFn: async () => {
      const { data } = await usersControllerFindAll({
        query: { role: 'agent', limit: 100 },
      });
      return data;
    },
  });

  const properties = useMemo<PropertyView[]>(() => {
    return (propertiesData?.data || []).map(toPropertyView);
  }, [propertiesData]);

  const projects = useMemo(() => {
    return (projectsData?.data || []).map((p: any) => ({
      id: p.id,
      name: p.name,
    }));
  }, [projectsData]);

  const agents = useMemo(() => {
    return (agentsData?.data || []).map((u: any) => ({
      id: u.id,
      name: u.name,
    }));
  }, [agentsData]);

  const createMutation = useCreateProperty();
  const selectedId = selectedProperty?.id || '';
  const updateMutation = useUpdateProperty(selectedId);
  const deleteMutation = useDeleteProperty(selectedId);
  const changeStatusMutation = useChangePropertyStatus(selectedId);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  const handleFilterChange = useCallback((newFilters: PropertyFilters) => {
    setFilters(newFilters);
  }, []);

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
          <p className="text-white font-semibold mb-1">Failed to load properties</p>
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
          <h1 className="text-white text-xl font-bold tracking-tight">Properties</h1>
          <p className="text-slate-400 text-sm mt-0.5">Manage your real estate listings</p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 rounded-xl text-xs font-medium text-white hover:bg-blue-600 transition-all"
          >
            <Plus size={13} /> Add Property
          </button>
        )}
      </div>

      {/* Market Strip */}
      <MarketStrip properties={properties} />

      {/* Filters + View Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1">
          <PropertyFiltersBar
            filters={filters}
            onChange={handleFilterChange}
            resultCount={properties.length}
          />
        </div>
        <div className="flex items-center gap-1 mb-4 bg-white/5 border border-white/10 rounded-xl p-0.5">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-lg transition-all ${
              viewMode === 'grid'
                ? 'bg-blue-500/20 text-blue-400'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <LayoutGrid size={14} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-lg transition-all ${
              viewMode === 'list'
                ? 'bg-blue-500/20 text-blue-400'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <List size={14} />
          </button>
        </div>
      </div>

      {/* Property Grid/List */}
      {properties.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-card card-border rounded-2xl">
          <p className="text-slate-400 text-sm mb-1">No properties found</p>
          <p className="text-slate-500 text-xs mb-4">
            Try adjusting your filters or add a new property.
          </p>
          {(filters.search || filters.status || filters.type) && (
            <button
              onClick={() =>
                setFilters({
                  search: '',
                  status: undefined,
                  type: undefined,
                  minPrice: undefined,
                  maxPrice: undefined,
                  beds: undefined,
                  page: 1,
                  limit: 100,
                })
              }
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-slate-400 hover:text-white transition-all"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {properties.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              onClick={() => setSelectedProperty(property)}
            />
          ))}
        </div>
      ) : (
        // List view
        <div className="bg-card card-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-slate-500 font-medium">Title</th>
                  <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-slate-500 font-medium">Type</th>
                  <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-slate-500 font-medium">Status</th>
                  <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-slate-500 font-medium">Price</th>
                  <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-slate-500 font-medium">Beds</th>
                  <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-slate-500 font-medium">Baths</th>
                  <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-slate-500 font-medium">Sqft</th>
                </tr>
              </thead>
              <tbody>
                {properties.map((property) => {
                  const typeCfg: Record<string, { label: string }> = {
                    apartment: { label: 'Apartment' },
                    villa: { label: 'Villa' },
                    commercial: { label: 'Commercial' },
                    land: { label: 'Land' },
                    townhouse: { label: 'Townhouse' },
                  };
                  const statusCfg: Record<string, { label: string; bg: string; text: string }> = {
                    active: { label: 'Active', bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
                    pending: { label: 'Pending', bg: 'bg-amber-500/15', text: 'text-amber-400' },
                    sold: { label: 'Sold', bg: 'bg-slate-500/15', text: 'text-slate-400' },
                    withdrawn: { label: 'Withdrawn', bg: 'bg-red-500/15', text: 'text-red-400' },
                  };
                  const sc = statusCfg[property.status] || statusCfg.active;
                  return (
                    <tr
                      key={property.id}
                      onClick={() => setSelectedProperty(property)}
                      className="border-b border-white/3 hover:bg-white/3 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <p className="text-white text-xs font-medium truncate max-w-[200px]">
                          {property.title}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-slate-400 text-xs">
                          {typeCfg[property.type]?.label || property.type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full border border-white/10 ${sc.bg} ${sc.text}`}
                        >
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-white text-xs font-medium">
                          ${(property.price / 100).toLocaleString('en-US')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {property.beds ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {property.baths ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {property.sqft?.toLocaleString() ?? '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Property Drawer */}
      <PropertyDrawer
        property={selectedProperty}
        onClose={() => setSelectedProperty(null)}
        onUpdate={async (data: UpdatePropertyDto) => {
          return new Promise<void>((resolve, reject) => {
            updateMutation.mutate(data, {
              onSuccess: () => {
                showToast('Property updated');
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
              showToast('Property deleted');
              setSelectedProperty(null);
            },
            onError: (err: any) => showToast(err?.detail || 'Failed to delete'),
          });
        }}
        onChangeStatus={(status) => {
          changeStatusMutation.mutate(
            { status: status as 'active' | 'pending' | 'sold' | 'withdrawn' },
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

      {/* Add Property Modal */}
      {showAddModal && (
        <AddPropertyModal
          onClose={() => setShowAddModal(false)}
          onSaved={async (formData: CreatePropertyDto) => {
            return new Promise<PropertyResponseDto>((resolve, reject) => {
              createMutation.mutate(formData, {
                onSuccess: (data) => {
                  if (!data) {
                    reject(new Error('No data returned from server'));
                    return;
                  }
                  showToast('Property created');
                  setShowAddModal(false);
                  resolve(data);
                },
                onError: (err: any) => {
                  reject(err);
                },
              });
            });
          }}
          projects={projects}
          agents={agents}
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