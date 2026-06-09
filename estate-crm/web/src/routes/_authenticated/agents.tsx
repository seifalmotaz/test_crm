import { useState, useMemo } from 'react'
import { Search, Plus, AlertTriangle, TrendingDown, CheckCircle, Loader2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import type { UserResponseDto } from '../../api/types.gen'
import type { UserWithKPIs } from '../../types/users'
import { useUsers, useCreateUser, useDeactivateUser, useActivateUser, useChangeRole } from '../../hooks/useUsers'
import TeamSummaryBar from '../../components/agents/TeamSummaryBar'
import AgentCard from '../../components/agents/AgentCard'
import AgentDrawer from '../../components/agents/AgentDrawer'
import LeaderboardPanel from '../../components/agents/LeaderboardPanel'
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

export default function AgentsPage() {
  const { user } = useAuth()
  const [selectedAgent, setSelectedAgent] = useState<UserWithKPIs | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [toast, setToast] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [sortBy, setSortBy] = useState('name')

  const queryFilters = useMemo(() => {
    const filters: { limit?: number; status?: string; role?: string; search?: string } = { limit: 100 }
    if (roleFilter === 'inactive') {
      filters.status = 'inactive'
    } else if (roleFilter !== 'all') {
      filters.role = roleFilter
    }
    if (searchQuery.trim()) {
      filters.search = searchQuery.trim()
    }
    return filters
  }, [roleFilter, searchQuery])

  const { data: usersData, isLoading, error } = useUsers(queryFilters)
  const createMutation = useCreateUser()

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const agents = useMemo<UserWithKPIs[]>(() => {
    return (usersData?.data || []).map(enrichWithMockKPIs)
  }, [usersData])

  const teamSummary = useMemo(() => {
    const activeAgents = agents.filter(a => a.role === 'agent' && a.status === 'active').length
    const inactiveAgents = agents.filter(a => a.status === 'inactive').length
    const managers = agents.filter(a => a.role === 'manager').length
    const agentCommissions = agents
      .filter(a => a.role === 'agent' && a.commissionSplit !== undefined)
      .map(a => a.commissionSplit!)
    const avgCommissionSplit = agentCommissions.length
      ? Math.round((agentCommissions.reduce((s, v) => s + v, 0) / agentCommissions.length) * 100)
      : 0

    return {
      totalUsers: agents.length,
      activeAgents,
      inactiveAgents,
      managers,
      avgCommissionSplit,
    }
  }, [agents])

  const filtered = useMemo(() => {
    let list = agents.filter(a => {
      if (roleFilter !== 'all') {
        if (roleFilter === 'inactive') {
          if (a.status !== 'inactive') return false
        } else if (a.role !== roleFilter || a.status !== 'active') {
          return false
        }
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const match = `${a.name} ${a.email} ${a.role}`.toLowerCase().includes(q)
        if (!match) return false
      }
      return true
    })

    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case 'name': return a.name.localeCompare(b.name)
        case 'role': return a.role.localeCompare(b.role)
        case 'status': return a.status === 'active' ? -1 : 1
        case 'revenue': return b.revenueYTD - a.revenueYTD
        default: return 0
      }
    })

    return list
  }, [agents, searchQuery, roleFilter, sortBy])

  const filterCounts = useMemo(() => {
    const all = agents.length
    const admin = agents.filter(a => a.role === 'admin' && a.status === 'active').length
    const manager = agents.filter(a => a.role === 'manager' && a.status === 'active').length
    const agent = agents.filter(a => a.role === 'agent' && a.status === 'active').length
    const inactive = agents.filter(a => a.status === 'inactive').length
    return { all, admin, manager, agent, inactive }
  }, [agents])

  const filterTabs = [
    { key: 'all', label: 'All' },
    { key: 'admin', label: 'Admin' },
    { key: 'manager', label: 'Manager' },
    { key: 'agent', label: 'Agent' },
    { key: 'inactive', label: 'Inactive' },
  ]

  const atRiskAgents = agents.filter(a => a.status === 'active' && a.npsScore < 70)
  const decliningAgents = agents.filter(a => a.status === 'active' && a.conversionRate < 50)

  const canManage = ['admin', 'manager'].includes(user?.role || '')

  // Drawer mutations
  const selectedAgentId = selectedAgent?.id || ''
  const deactivateMutation = useDeactivateUser(selectedAgentId)
  const activateMutation = useActivateUser(selectedAgentId)
  const changeRoleMutation = useChangeRole(selectedAgentId)

  // Loading state
  if (isLoading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="flex items-center justify-center py-40">
          <Loader2 size={32} className="text-blue-400 animate-spin" />
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="p-4 sm:p-6">
        <div className="flex flex-col items-center justify-center py-20 bg-card card-border rounded-2xl">
          <AlertTriangle size={28} className="text-red-400 mb-3" />
          <p className="text-white font-semibold mb-1">Failed to load users</p>
          <p className="text-slate-400 text-xs">{(error as any)?.detail || error?.message || 'An unexpected error occurred'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6">
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

      <TeamSummaryBar data={teamSummary} />

      {/* Risk Alerts */}
      {(atRiskAgents.length > 0 || decliningAgents.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {atRiskAgents.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/25 rounded-2xl p-3.5 flex items-start gap-3">
              <AlertTriangle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-300 text-xs font-semibold mb-1">High retention risk</p>
                <div className="flex flex-wrap gap-1.5">
                  {atRiskAgents.map(a => (
                    <button
                      key={a.id}
                      onClick={() => setSelectedAgent(a)}
                      className="text-[10px] text-red-300 bg-red-500/15 border border-red-500/25 px-2 py-0.5 rounded-lg hover:bg-red-500/25 transition-all"
                    >
                      {a.name} — Schedule retention talk
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {decliningAgents.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-3.5 flex items-start gap-3">
              <TrendingDown size={15} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-300 text-xs font-semibold mb-1">Declining velocity</p>
                <div className="flex flex-wrap gap-1.5">
                  {decliningAgents.map(a => (
                    <button
                      key={a.id}
                      onClick={() => setSelectedAgent(a)}
                      className="text-[10px] text-amber-300 bg-amber-500/15 border border-amber-500/25 px-2 py-0.5 rounded-lg hover:bg-amber-500/25 transition-all"
                    >
                      {a.name} — Review pipeline
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 min-w-0">
          {/* Filter Bar */}
          <div className="bg-card card-border rounded-2xl p-4 mb-4 glow-blue">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search by name, email, or role..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-all"
                />
              </div>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="appearance-none bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none cursor-pointer"
              >
                <option value="name" className="bg-navy-800">Sort: Name</option>
                <option value="role" className="bg-navy-800">Sort: Role</option>
                <option value="status" className="bg-navy-800">Sort: Status</option>
                <option value="revenue" className="bg-navy-800">Sort: Revenue</option>
              </select>
            </div>
            <div className="flex gap-1.5">
              {filterTabs.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setRoleFilter(key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${
                    roleFilter === key
                      ? 'bg-blue-500 text-white'
                      : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/8'
                  }`}
                >
                  {label}
                  <span className="ml-1.5 text-[9px] opacity-70">
                    {filterCounts[key as keyof typeof filterCounts]}
                  </span>
                </button>
              ))}
              <span className="ml-auto text-slate-500 text-xs flex items-center">
                <span className="text-white font-semibold">{filtered.length}</span>&nbsp;users
              </span>
            </div>
          </div>

          {/* Card Grid */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-card card-border rounded-2xl">
              <span className="text-4xl mb-3">👤</span>
              <p className="text-white font-semibold">No users found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map(a => (
                <AgentCard key={a.id} agent={a} onClick={() => setSelectedAgent(a)} />
              ))}
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="w-full lg:w-64 lg:flex-shrink-0 space-y-4">
          <LeaderboardPanel agents={agents} onSelect={setSelectedAgent} />

          {/* Team Distribution */}
          <div className="bg-card card-border rounded-2xl p-4 glow-blue">
            <p className="text-white font-semibold text-xs mb-3">Team Distribution</p>
            <div className="space-y-2.5">
              {[
                { label: 'Admin', count: agents.filter(a => a.role === 'admin' && a.status === 'active').length, color: 'text-amber-300 bg-amber-500/15 border-amber-500/30', barColor: '#f59e0b' },
                { label: 'Manager', count: agents.filter(a => a.role === 'manager' && a.status === 'active').length, color: 'text-blue-300 bg-blue-500/15 border-blue-500/30', barColor: '#3b82f6' },
                { label: 'Agent', count: agents.filter(a => a.role === 'agent' && a.status === 'active').length, color: 'text-slate-300 bg-slate-500/15 border-slate-500/30', barColor: '#6b7280' },
              ].map(({ label, count, color, barColor }) => {
                const pct = agents.length ? Math.round((count / agents.length) * 100) : 0
                return (
                  <div key={label}>
                    <div className="flex items-center justify-between mb-1 text-[10px]">
                      <span className={`font-medium px-1.5 py-0.5 rounded-full ${color}`}>{label}</span>
                      <span className="text-slate-500">{count} users · {pct}% of team</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Mentorship Pairs */}
          <div className="bg-card card-border rounded-2xl p-4 glow-blue">
            <p className="text-white font-semibold text-xs mb-3">Mentorship Pairs</p>
            <div className="space-y-2">
              {[
                { mentor: 'Sarah J', mentee: 'Rachel M', status: 'Active' as const },
                { mentor: 'Marcus C', mentee: 'David K', status: 'Suggested' as const },
                { mentor: 'Priya P', mentee: 'Lisa T', status: 'Suggested' as const },
              ].map(({ mentor, mentee, status }) => (
                <div key={mentor + mentee} className="flex items-center gap-2 p-2 bg-white/3 border border-white/6 rounded-xl text-[10px]">
                  <span className="text-blue-300 font-medium">{mentor}</span>
                  <span className="text-slate-600">→</span>
                  <span className="text-slate-300">{mentee}</span>
                  <span
                    className={`ml-auto px-1.5 py-0.5 rounded-full ${
                      status === 'Active'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-slate-500/15 text-slate-400'
                    }`}
                  >
                    {status}
                  </span>
                </div>
              ))}
            </div>
          </div>
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