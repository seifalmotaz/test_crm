import { X, Mail, Users, Shield } from 'lucide-react'
import { useState } from 'react'
import type { UserWithKPIs } from '../../types/users'

function fmt(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v}`
}

const roleConfig: Record<string, { label: string; color: string }> = {
  admin: { label: 'Admin', color: 'text-amber-300 bg-amber-500/15 border-amber-500/30' },
  manager: { label: 'Manager', color: 'text-blue-300 bg-blue-500/15 border-blue-500/30' },
  agent: { label: 'Agent', color: 'text-slate-300 bg-slate-500/15 border-slate-500/30' },
}

interface AgentDrawerProps {
  agent: UserWithKPIs | null
  onClose: () => void
  onDeactivate?: () => void
  onReactivate?: () => void
  onChangeRole?: (role: string) => void
}

export default function AgentDrawer({ agent, onClose, onDeactivate, onReactivate, onChangeRole }: AgentDrawerProps) {
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false)
  const [showReactivateConfirm, setShowReactivateConfirm] = useState(false)
  const [showRoleDropdown, setShowRoleDropdown] = useState(false)

  if (!agent) return null

  const roleCfg = roleConfig[agent.role]
  const roleOptions = ['manager', 'agent']

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[520px] bg-navy-800 border-l border-blue-500/15 z-50 overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-navy-800/95 backdrop-blur-sm border-b border-white/5 px-6 py-4 flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-base font-bold flex-shrink-0"
            style={{ backgroundColor: `${agent.color}20`, border: `1px solid ${agent.color}40`, color: agent.color }}
          >
            {agent.avatar}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-base">{agent.name}</p>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${roleCfg.color}`}>{roleCfg.label}</span>
              <span className="text-slate-400 text-xs">{agent.email}</span>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* Status Line */}
          <div className="bg-white/4 border border-white/8 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${agent.status === 'active' ? 'bg-emerald-400' : 'bg-red-400'}`} />
              <div>
                <p className="text-white text-sm font-semibold">
                  {agent.status === 'active' ? 'Active' : 'Departed'}
                </p>
                <p className="text-slate-400 text-xs">
                  {agent.status === 'active'
                    ? `Active since ${new Date(agent.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                    : agent.departedAt
                      ? `Departed on ${new Date(agent.departedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                      : 'No longer active'}
                </p>
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/4 border border-white/8 rounded-xl p-3">
              <p className="text-slate-500 text-[9px] uppercase tracking-wider mb-1">Email</p>
              <p className="text-white text-xs font-medium truncate">{agent.email}</p>
            </div>
            {agent.role === 'agent' && agent.commissionSplit !== undefined && (
              <div className="bg-white/4 border border-white/8 rounded-xl p-3">
                <p className="text-slate-500 text-[9px] uppercase tracking-wider mb-1">Commission Split</p>
                <p className="text-white text-xs font-medium">{(agent.commissionSplit * 100).toFixed(0)}%</p>
              </div>
            )}
            <div className="bg-white/4 border border-white/8 rounded-xl p-3">
              <p className="text-slate-500 text-[9px] uppercase tracking-wider mb-1">Deals Closed YTD</p>
              <p className="text-white text-xs font-medium">{agent.dealsClosedYTD}</p>
            </div>
            <div className="bg-white/4 border border-white/8 rounded-xl p-3">
              <p className="text-slate-500 text-[9px] uppercase tracking-wider mb-1">Conversion Rate</p>
              <p className="text-white text-xs font-medium">{agent.conversionRate}%</p>
            </div>
            <div className="bg-white/4 border border-white/8 rounded-xl p-3">
              <p className="text-slate-500 text-[9px] uppercase tracking-wider mb-1">Revenue YTD</p>
              <p className="text-white text-xs font-medium">{fmt(agent.revenueYTD)}</p>
            </div>
            <div className="bg-white/4 border border-white/8 rounded-xl p-3">
              <p className="text-slate-500 text-[9px] uppercase tracking-wider mb-1">NPS Score</p>
              <p className="text-white text-xs font-medium">{agent.npsScore}</p>
            </div>
          </div>

          {/* Recent Deals (Mock) */}
          <div>
            <p className="text-white font-semibold text-xs mb-2">Recent Deals</p>
            <div className="space-y-2">
              {[
                { property: 'Marina Heights #245', stage: 'Closing', value: 2450000, date: 'Mar 2026' },
                { property: 'Palm Vista #18', stage: 'Negotiation', value: 1800000, date: 'Feb 2026' },
                { property: 'Skyline Penthouse', stage: 'Due Diligence', value: 5200000, date: 'Jan 2026' },
              ].map((d, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 bg-white/3 border border-white/6 rounded-xl">
                  <span className="text-lg">🏠</span>
                  <div className="flex-1">
                    <p className="text-white text-xs font-medium">{d.property}</p>
                    <p className="text-slate-500 text-[10px]">{d.stage} · {d.date}</p>
                  </div>
                  <p className="text-white text-xs font-bold">{fmt(d.value)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pb-2">
            <div className="grid grid-cols-2 gap-2">
              <button className="flex items-center justify-center gap-2 py-2.5 bg-white/5 border border-white/10 rounded-xl text-slate-300 text-xs font-medium hover:bg-white/10 transition-all">
                <Mail size={13} /> Send Message
              </button>
              <button className="flex items-center justify-center gap-2 py-2.5 bg-blue-500 rounded-xl text-white text-xs font-medium hover:bg-blue-600 transition-all">
                <Users size={13} /> Schedule 1-on-1
              </button>
            </div>

            {/* Change Role (admin only — guarded in parent) */}
            <div className="relative">
              <button
                onClick={() => setShowRoleDropdown(!showRoleDropdown)}
                className="w-full flex items-center justify-between gap-2 py-2.5 px-4 bg-white/5 border border-white/10 rounded-xl text-slate-300 text-xs font-medium hover:bg-white/10 transition-all"
              >
                <span className="flex items-center gap-2">
                  <Shield size={13} /> Change Role
                </span>
                <span className="text-slate-500">{agent.role}</span>
              </button>
              {showRoleDropdown && (
                <div className="absolute bottom-full mb-1 left-0 right-0 bg-navy-700 border border-white/10 rounded-xl overflow-hidden shadow-xl">
                  {roleOptions.map(r => (
                    <button
                      key={r}
                      onClick={() => {
                        onChangeRole?.(r)
                        setShowRoleDropdown(false)
                      }}
                      className={`w-full px-4 py-2 text-xs text-left hover:bg-white/5 transition-all ${
                        agent.role === r ? 'text-blue-400 bg-blue-500/10' : 'text-slate-300'
                      }`}
                    >
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {agent.status === 'active' ? (
              <button
                onClick={() => setShowDeactivateConfirm(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-500/10 border border-red-500/25 rounded-xl text-red-300 text-xs font-medium hover:bg-red-500/20 transition-all"
              >
                Deactivate User
              </button>
            ) : (
              <button
                onClick={() => setShowReactivateConfirm(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-emerald-300 text-xs font-medium hover:bg-emerald-500/20 transition-all"
              >
                Reactivate User
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Deactivate Confirmation */}
      {showDeactivateConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card card-border rounded-2xl w-full max-w-sm p-5">
            <p className="text-white font-semibold text-sm mb-2">Deactivate User</p>
            <p className="text-slate-400 text-xs mb-4">
              Are you sure you want to deactivate {agent.name}? Their leads will be unassigned.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setShowDeactivateConfirm(false)} className="flex-1 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-slate-400 hover:text-white transition-all">
                Cancel
              </button>
              <button onClick={() => { onDeactivate?.(); setShowDeactivateConfirm(false) }} className="flex-1 py-2 bg-red-500 rounded-xl text-xs font-semibold text-white hover:bg-red-600 transition-all">
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reactivate Confirmation */}
      {showReactivateConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card card-border rounded-2xl w-full max-w-sm p-5">
            <p className="text-white font-semibold text-sm mb-2">Reactivate User</p>
            <p className="text-slate-400 text-xs mb-4">
              Are you sure you want to reactivate {agent.name}?
            </p>
            <div className="flex gap-2">
              <button onClick={() => setShowReactivateConfirm(false)} className="flex-1 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-slate-400 hover:text-white transition-all">
                Cancel
              </button>
              <button onClick={() => { onReactivate?.(); setShowReactivateConfirm(false) }} className="flex-1 py-2 bg-emerald-500 rounded-xl text-xs font-semibold text-white hover:bg-emerald-600 transition-all">
                Reactivate
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}