import { useState, useMemo } from 'react'
import { Search, Plus, CheckCircle, Loader2, MoreHorizontal, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import type { UserResponseDto } from '../../api/types.gen'
import type { UserWithKPIs } from '../../types/users'
import { useUsers, useCreateUser, useDeactivateUser, useActivateUser, useChangeRole } from '../../hooks/useUsers'
import AgentDrawer from '../../components/agents/AgentDrawer'
import AddUserModal from '../../components/agents/AddUserModal'

function enrichWithMockKPIs(user: UserResponseDto): UserWithKPIs {
  const hash = user.id.split('-').join('').slice(0, 8)
  const seed = parseInt(hash, 16) || 1
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    departedAt: user.departedAt,
    commissionSplit: user.commissionSplit ? parseFloat(user.commissionSplit) : undefined,
    createdAt: user.createdAt,
    revenueYTD: (seed % 500000) + 100000,
    dealsClosedYTD: (seed % 20) + 1,
    conversionRate: (seed % 30) + 10,
    npsScore: (seed % 40) + 60,
    activeDeals: (seed % 8) + 1,
    avatar: user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
    color: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'][seed % 6],
  }
}

function fmtRevenue(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v}`
}

const roleConfig: Record<string, { label: string; color: string; bg: string }> = {
  admin: { label: 'Admin', color: 'text-amber-300', bg: 'bg-amber-500/15 border-amber-500/30' },
  manager: { label: 'Manager', color: 'text-blue-300', bg: 'bg-blue-500/15 border-blue-500/30' },
  agent: { label: 'Agent', color: 'text-slate-300', bg: 'bg-slate-500/15 border-slate-500/30' },
}

type SortField = 'name' | 'role' | 'status' | 'revenue' | 'deals' | 'createdAt'
type SortDir = 'asc' | 'desc'

export default function AgentsPage() {
  const { user } = useAuth()
  const [selectedAgent, setSelectedAgent] = useState<UserWithKPIs | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [toast, setToast] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const queryFilters = useMemo(() => {
    const filters: { limit?: number; status?: string; role?: string; search?: string } = { limit: 100 }
    if (statusFilter !== 'all') {
      filters.status = statusFilter
    } else if (roleFilter !== 'all') {
      filters.role = roleFilter
    }
    if (searchQuery.trim()) {
      filters.search = searchQuery.trim()
    }
    return filters
  }, [roleFilter, statusFilter, searchQuery])

  const { data: usersData, isLoading, error } = useUsers(queryFilters)
  const createMutation = useCreateUser()

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const agents = useMemo<UserWithKPIs[]>(() => {
    return (usersData?.data || []).map(enrichWithMockKPIs)
  }, [usersData])

  const stats = useMemo(() => {
    const total = agents.length
    const active = agents.filter(a => a.status === 'active').length
    const inactive = agents.filter(a => a.status === 'inactive').length
    const admins = agents.filter(a => a.role === 'admin' && a.status === 'active').length
    const managers = agents.filter(a => a.role === 'manager' && a.status === 'active').length
    const activeAgents = agents.filter(a => a.role === 'agent' && a.status === 'active').length
    return { total, active, inactive, admins, managers, activeAgents }
  }, [agents])

  const filtered = useMemo(() => {
    let list = agents.filter(a => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const match = `${a.name} ${a.email} ${a.role}`.toLowerCase().includes(q)
        if (!match) return false
      }
      if (roleFilter !== 'all') {
        if (a.role !== roleFilter || a.status !== 'active') return false
      }
      if (statusFilter !== 'all') {
        if (a.status !== statusFilter) return false
      }
      return true
    })

    list.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      switch (sortField) {
        case 'name': return a.name.localeCompare(b.name) * dir
        case 'role': return a.role.localeCompare(b.role) * dir
        case 'status': return a.status.localeCompare(b.status) * dir
        case 'revenue': return (a.revenueYTD - b.revenueYTD) * dir
        case 'deals': return (a.dealsClosedYTD - b.dealsClosedYTD) * dir
        case 'createdAt': return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir
        default: return 0
      }
    })

    return list
  }, [agents, searchQuery, roleFilter, statusFilter, sortField, sortDir])

  const canManage = ['admin', 'manager'].includes(user?.role || '')

  const selectedAgentId = selectedAgent?.id || ''
  const deactivateMutation = useDeactivateUser(selectedAgentId)
  const activateMutation = useActivateUser(selectedAgentId)
  const changeRoleMutation = useChangeRole(selectedAgentId)

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown size={12} className="text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
    return sortDir === 'asc'
      ? <ArrowUp size={12} className="text-blue-400" />
      : <ArrowDown size={12} className="text-blue-400" />
  }

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="flex items-center justify-center py-40">
          <Loader2 size={32} className="text-blue-400 animate-spin" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6">
        <div className="flex flex-col items-center justify-center py-20 bg-card card-border rounded-2xl">
          <p className="text-white font-semibold mb-1">Failed to load users</p>
          <p className="text-slate-400 text-xs">{(error as any)?.detail || error?.message || 'An unexpected error occurred'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-white text-xl font-bold tracking-tight">Users</h1>
          <p className="text-slate-400 text-sm mt-0.5">Manage your team</p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 rounded-xl text-xs font-medium text-white hover:bg-blue-600 transition-all"
          >
            <Plus size={13} /> Add User
          </button>
        )}
      </div>

      {/* Compact Stats */}
      <div className="flex items-center gap-4 mb-5 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400">Total</span>
          <span className="text-white font-semibold">{stats.total}</span>
        </div>
        <div className="w-px h-3 bg-white/10" />
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-slate-400">Active</span>
          <span className="text-white font-semibold">{stats.active}</span>
        </div>
        <div className="w-px h-3 bg-white/10" />
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
          <span className="text-slate-400">Inactive</span>
          <span className="text-white font-semibold">{stats.inactive}</span>
        </div>
        <div className="w-px h-3 bg-white/10" />
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400">Admins</span>
          <span className="text-amber-300 font-semibold">{stats.admins}</span>
        </div>
        <div className="w-px h-3 bg-white/10" />
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400">Managers</span>
          <span className="text-blue-300 font-semibold">{stats.managers}</span>
        </div>
        <div className="w-px h-3 bg-white/10" />
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400">Agents</span>
          <span className="text-slate-300 font-semibold">{stats.activeAgents}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, or role..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setRoleFilter('all') }}
            className="appearance-none bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none cursor-pointer"
          >
            <option value="all" className="bg-navy-800">All Status</option>
            <option value="active" className="bg-navy-800">Active</option>
            <option value="inactive" className="bg-navy-800">Inactive</option>
          </select>
          <select
            value={roleFilter}
            onChange={e => { setRoleFilter(e.target.value); setStatusFilter('all') }}
            className="appearance-none bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none cursor-pointer"
          >
            <option value="all" className="bg-navy-800">All Roles</option>
            <option value="admin" className="bg-navy-800">Admin</option>
            <option value="manager" className="bg-navy-800">Manager</option>
            <option value="agent" className="bg-navy-800">Agent</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card card-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-slate-500 font-medium w-12">#</th>
                <th
                  className="px-4 py-3 text-[10px] uppercase tracking-wider text-slate-500 font-medium cursor-pointer group hover:text-slate-300 transition-colors"
                  onClick={() => toggleSort('name')}
                >
                  <span className="flex items-center gap-1">User <SortIcon field="name" /></span>
                </th>
                <th
                  className="px-4 py-3 text-[10px] uppercase tracking-wider text-slate-500 font-medium cursor-pointer group hover:text-slate-300 transition-colors"
                  onClick={() => toggleSort('role')}
                >
                  <span className="flex items-center gap-1">Role <SortIcon field="role" /></span>
                </th>
                <th
                  className="px-4 py-3 text-[10px] uppercase tracking-wider text-slate-500 font-medium cursor-pointer group hover:text-slate-300 transition-colors"
                  onClick={() => toggleSort('status')}
                >
                  <span className="flex items-center gap-1">Status <SortIcon field="status" /></span>
                </th>
                <th
                  className="px-4 py-3 text-[10px] uppercase tracking-wider text-slate-500 font-medium cursor-pointer group hover:text-slate-300 transition-colors"
                  onClick={() => toggleSort('revenue')}
                >
                  <span className="flex items-center gap-1">Revenue YTD <SortIcon field="revenue" /></span>
                </th>
                <th
                  className="px-4 py-3 text-[10px] uppercase tracking-wider text-slate-500 font-medium cursor-pointer group hover:text-slate-300 transition-colors"
                  onClick={() => toggleSort('deals')}
                >
                  <span className="flex items-center gap-1">Deals <SortIcon field="deals" /></span>
                </th>
                <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-slate-500 font-medium">Email</th>
                <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-slate-500 font-medium w-10" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <p className="text-slate-500 text-sm">No users found</p>
                  </td>
                </tr>
              ) : (
                filtered.map((agent, i) => {
                  const roleCfg = roleConfig[agent.role]
                  return (
                    <tr
                      key={agent.id}
                      onClick={() => setSelectedAgent(agent)}
                      className="border-b border-white/3 hover:bg-white/3 cursor-pointer transition-colors group"
                    >
                      <td className="px-4 py-3">
                        <span className="text-slate-600 text-[10px] font-medium">{i + 1}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                            style={{ backgroundColor: `${agent.color}20`, border: `1px solid ${agent.color}40`, color: agent.color }}
                          >
                            {agent.avatar}
                          </div>
                          <div className="min-w-0">
                            <p className="text-white text-xs font-medium truncate">{agent.name}</p>
                            <p className="text-slate-500 text-[10px] truncate">{agent.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${roleCfg?.bg || ''} ${roleCfg?.color || ''}`}>
                          {roleCfg?.label || agent.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${agent.status === 'active' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                          <span className={`text-xs capitalize ${agent.status === 'active' ? 'text-emerald-400' : 'text-red-400'}`}>
                            {agent.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-white text-xs font-medium">{fmtRevenue(agent.revenueYTD)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-white text-xs font-medium">{agent.dealsClosedYTD}</span>
                        <span className="text-slate-500 text-[10px] ml-1">{agent.conversionRate}% conv</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-slate-500 text-xs">{agent.email}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/5 transition-all opacity-0 group-hover:opacity-100">
                          <MoreHorizontal size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drawer */}
      <AgentDrawer
        agent={selectedAgent}
        onClose={() => setSelectedAgent(null)}
        onDeactivate={() => {
          deactivateMutation.mutate(undefined, {
            onSuccess: (data) => {
              showToast(`User deactivated. ${data?.unassignedLeads || 0} leads unassigned.`)
              setSelectedAgent(null)
            },
            onError: (err: any) => showToast(err?.detail || 'Failed to deactivate'),
          })
        }}
        onReactivate={() => {
          activateMutation.mutate(undefined, {
            onSuccess: () => {
              showToast(`${selectedAgent?.name} reactivated`)
              setSelectedAgent(null)
            },
            onError: (err: any) => showToast(err?.detail || 'Failed to reactivate'),
          })
        }}
        onChangeRole={(role) => {
          changeRoleMutation.mutate({ role: role as 'manager' | 'agent' }, {
            onSuccess: () => {
              showToast(`${selectedAgent?.name} role changed to ${role}`)
            },
            onError: (err: any) => showToast(err?.detail || 'Failed to change role'),
          })
        }}
      />

      {/* Add User Modal */}
      {showAddModal && (
        <AddUserModal
          onClose={() => setShowAddModal(false)}
          onSaved={async (formData) => {
            return new Promise<void>((resolve, reject) => {
              createMutation.mutate(formData, {
                onSuccess: (data) => {
                  if (data?.generatedPassword) {
                    showToast(`User created. Temporary password: ${data.generatedPassword}`)
                  } else {
                    showToast('User created successfully')
                  }
                  setShowAddModal(false)
                  resolve()
                },
                onError: (err: any) => {
                  reject(err)
                },
              })
            })
          }}
          currentUserRole={user?.role || 'agent'}
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
  )
}
