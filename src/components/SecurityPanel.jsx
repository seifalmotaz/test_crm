import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useChat } from '../context/ChatContext'

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_FEATURES = [
  { id: 'leads',       label: 'Leads',       icon: '👥', group: 'Sales' },
  { id: 'deals',       label: 'Deals',       icon: '🤝', group: 'Sales' },
  { id: 'properties',  label: 'Properties',  icon: '🏠', group: 'Inventory' },
  { id: 'clients',     label: 'Clients',     icon: '👤', group: 'CRM' },
  { id: 'messages',    label: 'Messages',    icon: '💬', group: 'Communication' },
  { id: 'tasks',       label: 'Tasks',       icon: '✅', group: 'Workflow' },
  { id: 'calendar',    label: 'Calendar',    icon: '📅', group: 'Workflow' },
  { id: 'analytics',   label: 'Analytics',   icon: '📊', group: 'Reports' },
  { id: 'reports',     label: 'Reports',     icon: '📋', group: 'Reports' },
  { id: 'market',      label: 'Market Data', icon: '📈', group: 'Reports' },
  { id: 'documents',   label: 'Documents',   icon: '📁', group: 'Storage' },
  { id: 'team',        label: 'Team',        icon: '🧑‍🤝‍🧑', group: 'Management' },
  { id: 'commissions', label: 'Commissions', icon: '💰', group: 'Finance' },
  { id: 'settings',    label: 'Settings',    icon: '⚙️', group: 'System' },
  { id: 'security',    label: 'Security',    icon: '🔒', group: 'System' },
  { id: 'audit',       label: 'Audit Log',   icon: '🗂️', group: 'System' },
]

const GROUPS = ['Sales', 'Inventory', 'CRM', 'Communication', 'Workflow', 'Reports', 'Storage', 'Management', 'Finance', 'System']

const ROLE_DEFAULTS = {
  administrator:    ALL_FEATURES.map(f => f.id),
  manager:          ['leads', 'properties', 'deals', 'clients', 'messages', 'tasks', 'analytics', 'reports', 'calendar', 'documents', 'team', 'commissions', 'market'],
  agent:            ['leads', 'properties', 'deals', 'clients', 'messages', 'tasks', 'calendar'],
  sales_manager:    ['leads', 'properties', 'deals', 'clients', 'messages', 'tasks', 'calendar', 'analytics', 'team'],
  team_leader:      ['leads', 'properties', 'deals', 'clients', 'messages', 'tasks', 'calendar', 'analytics'],
  marketing:        ['leads', 'properties', 'clients', 'messages', 'tasks', 'calendar', 'market'],
  marketing_manager: ['leads', 'properties', 'clients', 'messages', 'tasks', 'calendar', 'analytics', 'reports', 'market'],
  sales_admin:      ['leads', 'properties', 'deals', 'clients', 'tasks', 'documents'],
  quality_control:  ['leads', 'deals', 'clients', 'tasks', 'analytics', 'reports'],
}

const ROLE_BADGE = {
  administrator:    { bg: '#3b82f620', color: '#93c5fd',  border: '#3b82f640' },
  manager:          { bg: '#8b5cf620', color: '#c4b5fd',  border: '#8b5cf640' },
  agent:            { bg: '#10b98120', color: '#6ee7b7',  border: '#10b98140' },
  sales_manager:    { bg: '#f59e0b20', color: '#fcd34d',  border: '#f59e0b40' },
  team_leader:      { bg: '#06b6d420', color: '#67e8f9',  border: '#06b6d440' },
  marketing:        { bg: '#ec489920', color: '#f9a8d4',  border: '#ec489940' },
  marketing_manager: { bg: '#a855f720', color: '#d8b4fe', border: '#a855f740' },
  sales_admin:      { bg: '#eab30820', color: '#fde68a',  border: '#eab30840' },
  quality_control:  { bg: '#6366f120', color: '#a5b4fc',  border: '#6366f140' },
}

const ROLE_LABELS = {
  administrator:    'Administrator',
  manager:          'Manager',
  agent:            'Agent',
  staff:            'Staff',
  sales_manager:    'Sales Manager',
  team_leader:      'Team Leader',
  marketing:        'Marketing',
  marketing_manager: 'Marketing Manager',
  sales_admin:      'Sales Admin',
  quality_control:  'Quality Control',
}

const avatarColor = name => {
  const colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#84cc16']
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return colors[Math.abs(h) % colors.length]
}

// Map API user (role: 'admin') → local user (role: 'administrator')
function apiUserToLocal(u) {
  const role = u.role === 'admin' ? 'administrator' : u.role
  const namePart = u.email.split('@')[0].replace(/[._-]/g, ' ')
  const name = namePart.replace(/\b\w/g, c => c.toUpperCase())
  const avatar = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return {
    id: u.id,
    name,
    email: u.email,
    role,
    active: u.isActive,
    avatar,
    createdAt: u.createdAt.slice(0, 10),
    features: u.features?.length ? [...u.features] : [...(ROLE_DEFAULTS[role] || ROLE_DEFAULTS.agent)],
    quota: u.userQuota ?? null,
    createdById: u.createdById ?? null,
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Avatar({ name, size = 36 }) {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div style={{
      width: size, height: size,
      borderRadius: '50%',
      background: avatarColor(name),
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.33, fontWeight: 700, color: '#fff', flexShrink: 0,
    }}>
      {initials}
    </div>
  )
}

function RoleBadge({ role }) {
  const s = ROLE_BADGE[role] || ROLE_BADGE.agent
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      whiteSpace: 'nowrap',
    }}>
      {ROLE_LABELS[role] || role}
    </span>
  )
}

function Toggle({ on, onChange, color = '#3b82f6' }) {
  return (
    <div
      onClick={e => { e.stopPropagation(); onChange(!on) }}
      style={{
        width: 36, height: 20, borderRadius: 10,
        background: on ? color : '#334155',
        cursor: 'pointer', position: 'relative',
        transition: 'background 0.2s', flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute', top: 2, left: on ? 18 : 2,
        width: 16, height: 16, borderRadius: '50%',
        background: on ? '#fff' : '#94a3b8',
        transition: 'left 0.2s',
      }} />
    </div>
  )
}

function Toast({ toast }) {
  if (!toast) return null
  const isErr = toast.type === 'error'
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      padding: '10px 18px', borderRadius: 10,
      background: isErr ? '#2d0a0a' : '#052e16',
      border: `1px solid ${isErr ? '#ef444450' : '#10b98150'}`,
      color: isErr ? '#fca5a5' : '#6ee7b7',
      fontSize: 13, fontWeight: 500,
      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      animation: 'spToastIn 0.2s ease',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {toast.msg}
    </div>
  )
}

// ─── Users Tab ────────────────────────────────────────────────────────────────

function UsersTab({ users, allUsers, search, setSearch, filterRole, setFilterRole, onManage, onDelete, onCreateOpen }) {
  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          placeholder="Search by name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: 200,
            padding: '8px 14px',
            background: '#1a1f2e', border: '1px solid #334155', borderRadius: 10,
            color: '#f8fafc', fontSize: 13, outline: 'none',
          }}
          onFocus={e => { e.target.style.borderColor = '#3b82f6' }}
          onBlur={e => { e.target.style.borderColor = '#334155' }}
        />
        <select
          value={filterRole}
          onChange={e => setFilterRole(e.target.value)}
          style={{
            padding: '8px 14px',
            background: '#1a1f2e', border: '1px solid #334155', borderRadius: 10,
            color: '#f8fafc', fontSize: 13, cursor: 'pointer', outline: 'none',
          }}
          onFocus={e => { e.target.style.borderColor = '#3b82f6' }}
          onBlur={e => { e.target.style.borderColor = '#334155' }}
        >
          <option value="all">All Roles</option>
          <option value="administrator">Administrator</option>
          <option value="manager">Manager</option>
          <option value="agent">Agent</option>
          <option value="sales_manager">Sales Manager</option>
          <option value="team_leader">Team Leader</option>
          <option value="marketing">Marketing</option>
          <option value="marketing_manager">Marketing Manager</option>
          <option value="sales_admin">Sales Admin</option>
          <option value="quality_control">Quality Control</option>
        </select>
        <button
          onClick={onCreateOpen}
          style={{
            padding: '8px 16px', background: '#3b82f6', border: 'none',
            borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', whiteSpace: 'nowrap',
          }}
          onMouseOver={e => { e.currentTarget.style.background = '#2563eb' }}
          onMouseOut={e => { e.currentTarget.style.background = '#3b82f6' }}
        >
          + Create User
        </button>
      </div>

      {/* Table */}
      <div style={{ background: '#1a1f2e', border: '1px solid #1e2d40', borderRadius: 14, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#111827' }}>
              {['User', 'Role', 'Features', 'Status', 'Created', 'Actions'].map(h => (
                <th key={h} style={{
                  padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600,
                  color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em',
                  borderBottom: '1px solid #1e2d40',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <TableRow
                key={u.id}
                u={u}
                isLast={i === users.length - 1}
                onManage={onManage}
                onDelete={onDelete}
                subUsers={u.role === 'manager' ? allUsers.filter(a => a.createdById === u.id) : []}
              />
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#475569', fontSize: 13 }}>
            No users found
          </div>
        )}
      </div>
    </div>
  )
}

function TableRow({ u, isLast, onManage, onDelete, subUsers = [] }) {
  const [hovered, setHovered] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const hasSubUsers = subUsers.length > 0
  const showBorder = !isLast || (hasSubUsers && expanded)

  return (
    <>
      <tr
        style={{
          background: hovered ? '#1e2840' : 'transparent',
          borderBottom: (!expanded && isLast) ? 'none' : '1px solid #1e2d40',
          transition: 'background 0.15s',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <td style={{ padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {u.role === 'manager' && (
              <button
                onClick={() => setExpanded(e => !e)}
                title={expanded ? 'Collapse agents' : 'Expand agents'}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                  color: hasSubUsers ? '#64748b' : '#2d3748',
                  fontSize: 11, lineHeight: 1, flexShrink: 0,
                  transition: 'transform 0.15s',
                  transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                }}
              >
                ▶
              </button>
            )}
            <Avatar name={u.name} size={34} />
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{u.name}</p>
              <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>{u.email}</p>
            </div>
          </div>
        </td>
        <td style={{ padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <RoleBadge role={u.role} />
            {u.role === 'manager' && hasSubUsers && (
              <span style={{ fontSize: 11, color: '#475569' }}>{subUsers.length} agent{subUsers.length !== 1 ? 's' : ''}</span>
            )}
          </div>
        </td>
        <td style={{ padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
            <div style={{ flex: 1, height: 6, background: '#0f1117', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${(u.features.length / 16) * 100}%`,
                background: '#3b82f6', borderRadius: 3,
              }} />
            </div>
            <span style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>{u.features.length}/16</span>
          </div>
        </td>
        <td style={{ padding: '12px 16px' }}>
          <span style={{
            padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
            background: u.active ? '#10b98120' : '#ef444420',
            color: u.active ? '#6ee7b7' : '#fca5a5',
            border: `1px solid ${u.active ? '#10b98140' : '#ef444440'}`,
          }}>
            {u.active ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748b' }}>{u.createdAt}</td>
        <td style={{ padding: '12px 16px' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <ManageBtn onClick={() => onManage(u)} />
            <DeleteBtn onClick={() => onDelete(u)} />
          </div>
        </td>
      </tr>

      {/* Sub-user rows (agents created by this manager) */}
      {u.role === 'manager' && expanded && subUsers.map((sub, si) => (
        <SubUserRow
          key={sub.id}
          sub={sub}
          isLast={si === subUsers.length - 1 && isLast}
          onManage={onManage}
          onDelete={onDelete}
        />
      ))}

      {/* Empty state when expanded but no agents yet */}
      {u.role === 'manager' && expanded && subUsers.length === 0 && (
        <tr style={{ borderBottom: isLast ? 'none' : '1px solid #1e2d40' }}>
          <td colSpan={6} style={{ padding: '10px 16px 10px 52px', fontSize: 12, color: '#475569', fontStyle: 'italic' }}>
            No agents created by this manager yet
          </td>
        </tr>
      )}
    </>
  )
}

function SubUserRow({ sub, isLast, onManage, onDelete }) {
  const [hovered, setHovered] = useState(false)
  return (
    <tr
      style={{
        background: hovered ? '#181d2c' : '#13182400',
        borderBottom: isLast ? 'none' : '1px solid #1e2d40',
        transition: 'background 0.15s',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <td style={{ padding: '9px 16px 9px 52px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 16, height: 1, background: '#334155', flexShrink: 0 }} />
          <Avatar name={sub.name} size={28} />
          <div>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#cbd5e1' }}>{sub.name}</p>
            <p style={{ margin: 0, fontSize: 11, color: '#475569' }}>{sub.email}</p>
          </div>
        </div>
      </td>
      <td style={{ padding: '9px 16px' }}><RoleBadge role={sub.role} /></td>
      <td style={{ padding: '9px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
          <div style={{ flex: 1, height: 4, background: '#0f1117', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(sub.features.length / 16) * 100}%`, background: '#3b82f6', borderRadius: 3 }} />
          </div>
          <span style={{ fontSize: 11, color: '#64748b' }}>{sub.features.length}/16</span>
        </div>
      </td>
      <td style={{ padding: '9px 16px' }}>
        <span style={{
          padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
          background: sub.active ? '#10b98120' : '#ef444420',
          color: sub.active ? '#6ee7b7' : '#fca5a5',
          border: `1px solid ${sub.active ? '#10b98140' : '#ef444440'}`,
        }}>
          {sub.active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td style={{ padding: '9px 16px', fontSize: 12, color: '#64748b' }}>{sub.createdAt}</td>
      <td style={{ padding: '9px 16px' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <ManageBtn onClick={() => onManage(sub)} />
          <DeleteBtn onClick={() => onDelete(sub)} />
        </div>
      </td>
    </tr>
  )
}

function ManageBtn({ onClick }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '5px 12px',
        background: hov ? '#3b82f630' : '#3b82f620',
        border: '1px solid #3b82f640',
        borderRadius: 8, color: '#93c5fd',
        fontSize: 12, fontWeight: 600, cursor: 'pointer',
        transition: 'background 0.15s',
      }}
    >
      Manage →
    </button>
  )
}

function DeleteBtn({ onClick }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '5px 12px',
        background: hov ? '#ef444430' : '#ef444420',
        border: '1px solid #ef444440',
        borderRadius: 8, color: '#fca5a5',
        fontSize: 12, fontWeight: 600, cursor: 'pointer',
        transition: 'background 0.15s',
      }}
    >
      Delete
    </button>
  )
}

function EditBtn({ onClick }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title="Edit user"
      style={{
        padding: '6px 14px',
        background: hov ? '#8b5cf630' : '#8b5cf620',
        border: '1px solid #8b5cf640',
        borderRadius: 8, color: '#c4b5fd',
        fontSize: 12, fontWeight: 600, cursor: 'pointer',
        transition: 'background 0.15s', flexShrink: 0,
      }}
    >
      ✏ Edit
    </button>
  )
}

function ConfirmDeleteModal({ name, deleting, onConfirm, onCancel }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#1a1f2e', border: '1px solid #334155', borderRadius: 16,
        padding: '28px 32px', width: 380, maxWidth: '90vw',
        fontFamily: 'Inter, system-ui, sans-serif',
        boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: '#ef444420', border: '1px solid #ef444440',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, flexShrink: 0,
          }}>
            🗑️
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>Delete User</p>
            <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>This action cannot be undone</p>
          </div>
        </div>

        <p style={{ margin: '0 0 24px', fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>
          Are you sure you want to delete{' '}
          <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{name}</span>?
          {' '}Their account and all associated data will be permanently removed.
        </p>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            disabled={deleting}
            style={{
              padding: '8px 18px', background: 'transparent',
              border: '1px solid #334155', borderRadius: 9,
              color: '#94a3b8', fontSize: 13, fontWeight: 600,
              cursor: deleting ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            style={{
              padding: '8px 18px',
              background: deleting ? '#991b1b' : '#ef4444',
              border: 'none', borderRadius: 9,
              color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: deleting ? 'not-allowed' : 'pointer',
              opacity: deleting ? 0.7 : 1,
            }}
          >
            {deleting ? 'Deleting…' : 'Yes, Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Security Tab ─────────────────────────────────────────────────────────────

function SecurityTab({ users, selectedUser, onSelect, search, setSearch, toggleFeature, toggleAllFeatures, changeRole, toggleActive, onEdit, onSetQuota }) {
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

      {/* Left: User List */}
      <div style={{ width: 260, flexShrink: 0, background: '#1a1f2e', border: '1px solid #1e2d40', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid #1e2d40' }}>
          <input
            placeholder="Search users…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '7px 12px',
              background: '#0f1117', border: '1px solid #334155', borderRadius: 8,
              color: '#f8fafc', fontSize: 12, outline: 'none',
            }}
            onFocus={e => { e.target.style.borderColor = '#3b82f6' }}
            onBlur={e => { e.target.style.borderColor = '#334155' }}
          />
        </div>
        <div style={{ maxHeight: 520, overflowY: 'auto' }}>
          {users.map(u => (
            <UserListItem
              key={u.id}
              u={u}
              selected={selectedUser?.id === u.id}
              onClick={() => onSelect(u)}
            />
          ))}
          {users.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: '#475569', fontSize: 12 }}>No users</div>
          )}
        </div>
      </div>

      {/* Right: Permissions Panel */}
      {selectedUser ? (
        <PermissionsPanel
          user={selectedUser}
          toggleFeature={toggleFeature}
          toggleAllFeatures={toggleAllFeatures}
          changeRole={changeRole}
          toggleActive={toggleActive}
          onEdit={onEdit}
          onSetQuota={onSetQuota}
        />
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: 13, minHeight: 200 }}>
          Select a user to manage permissions
        </div>
      )}
    </div>
  )
}

function UserListItem({ u, selected, onClick }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '10px 14px',
        display: 'flex', alignItems: 'center', gap: 10,
        background: selected ? '#1e2840' : hov ? '#161b28' : 'transparent',
        borderBottom: '1px solid #1e2d40',
        cursor: 'pointer', transition: 'background 0.15s',
      }}
    >
      <Avatar name={u.name} size={32} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</p>
        <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>{ROLE_LABELS[u.role] || u.role}</p>
      </div>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: u.active ? '#10b981' : '#ef4444', flexShrink: 0 }} />
    </div>
  )
}

function PermissionsPanel({ user, toggleFeature, toggleAllFeatures, changeRole, toggleActive, onEdit, onSetQuota }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      {/* User Card */}
      <div style={{ background: '#1a1f2e', border: '1px solid #1e2d40', borderRadius: 14, padding: '20px', marginBottom: 16 }}>

        {/* Top row: avatar + name + active toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
          <Avatar name={user.name} size={48} />
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#f8fafc' }}>{user.name}</h2>
            <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>{user.email}</p>
          </div>
          <EditBtn onClick={() => onEdit(user)} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#64748b' }}>{user.active ? 'Active' : 'Inactive'}</span>
            <Toggle on={user.active} onChange={() => toggleActive(user.id)} color="#3b82f6" />
          </div>
        </div>

        {/* Bottom row: role selector + progress + action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* Role */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>Role:</span>
            <select
              value={user.role}
              onChange={e => changeRole(user.id, e.target.value)}
              style={{
                padding: '5px 10px',
                background: '#0f1117', border: '1px solid #334155', borderRadius: 8,
                color: '#f8fafc', fontSize: 12, cursor: 'pointer', outline: 'none',
              }}
              onFocus={e => { e.target.style.borderColor = '#3b82f6' }}
              onBlur={e => { e.target.style.borderColor = '#334155' }}
            >
              <option value="administrator">Administrator</option>
              <option value="manager">Manager</option>
              <option value="agent">Agent</option>
              <option value="sales_manager">Sales Manager</option>
              <option value="team_leader">Team Leader</option>
              <option value="marketing">Marketing</option>
              <option value="marketing_manager">Marketing Manager</option>
              <option value="sales_admin">Sales Admin</option>
              <option value="quality_control">Quality Control</option>
            </select>
          </div>

          {/* Progress */}
          <div style={{ flex: 1, minWidth: 120, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, height: 6, background: '#0f1117', borderRadius: 3 }}>
              <div style={{
                height: '100%',
                width: `${(user.features.length / 16) * 100}%`,
                background: '#3b82f6', borderRadius: 3, transition: 'width 0.3s',
              }} />
            </div>
            <span style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>{user.features.length} of 16</span>
          </div>

          {/* Bulk buttons */}
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { label: 'Enable All',     action: () => toggleAllFeatures(user.id, true) },
              { label: 'Disable All',    action: () => toggleAllFeatures(user.id, false) },
              { label: 'Reset Defaults', action: () => changeRole(user.id, user.role) },
            ].map(({ label, action }) => (
              <SmallBtn key={label} onClick={action}>{label}</SmallBtn>
            ))}
          </div>
        </div>
      </div>

      {/* Quota (managers only) */}
      {user.role === 'manager' && (
        <QuotaCard user={user} onSetQuota={onSetQuota} />
      )}

      {/* Feature Groups */}
      {GROUPS.map(group => {
        const feats = ALL_FEATURES.filter(f => f.group === group)
        const enabledCount = feats.filter(f => user.features.includes(f.id)).length
        return (
          <FeatureGroup
            key={group}
            group={group}
            features={feats}
            enabledCount={enabledCount}
            userFeatures={user.features}
            onToggle={fId => toggleFeature(user.id, fId)}
          />
        )
      })}
    </div>
  )
}

function SmallBtn({ onClick, children }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '5px 10px',
        background: hov ? '#1e2840' : '#0f1117',
        border: '1px solid #334155', borderRadius: 7,
        color: '#94a3b8', fontSize: 11, fontWeight: 500,
        cursor: 'pointer', transition: 'background 0.15s',
      }}
    >
      {children}
    </button>
  )
}

function FeatureGroup({ group, features, enabledCount, userFeatures, onToggle }) {
  const pct = features.length > 0 ? (enabledCount / features.length) * 100 : 0
  const allOn = enabledCount === features.length
  return (
    <div style={{
      background: 'linear-gradient(145deg, #161b2e, #1a1f2e)',
      border: '1px solid #232d42',
      borderRadius: 16,
      padding: '18px 20px',
      marginBottom: 14,
      boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* left accent bar */}
      <div style={{
        position: 'absolute', left: 0, top: 12, bottom: 12, width: 3,
        borderRadius: '0 3px 3px 0',
        background: allOn ? '#10b981' : enabledCount > 0 ? '#f59e0b' : '#334155',
        transition: 'background 0.3s',
      }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingLeft: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.02em' }}>{group}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* progress bar */}
          <div style={{ width: 72, height: 4, borderRadius: 99, background: '#1e2d40', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 99,
              width: `${pct}%`,
              background: allOn ? '#10b981' : '#f59e0b',
              transition: 'width 0.3s, background 0.3s',
            }} />
          </div>
          <span style={{
            fontSize: 11, fontWeight: 600,
            color: allOn ? '#34d399' : enabledCount > 0 ? '#fbbf24' : '#475569',
            minWidth: 52, textAlign: 'right',
          }}>
            {enabledCount}/{features.length} on
          </span>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 8, paddingLeft: 10 }}>
        {features.map(feat => (
          <FeatureCard
            key={feat.id}
            feat={feat}
            isOn={userFeatures.includes(feat.id)}
            onToggle={() => onToggle(feat.id)}
          />
        ))}
      </div>
    </div>
  )
}

function FeatureCard({ feat, isOn, onToggle }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onClick={onToggle}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '9px 12px',
        borderRadius: 11,
        border: `1px solid ${isOn ? '#10b98166' : hov ? '#2e3a52' : '#1e2d40'}`,
        background: isOn
          ? hov ? 'linear-gradient(135deg, #0d2218, #0f2a1a)' : 'linear-gradient(135deg, #0a1c14, #0c2216)'
          : hov ? '#161c2e' : '#111827',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        transition: 'all 0.18s ease',
        boxShadow: isOn ? '0 0 0 1px #10b98122 inset, 0 1px 6px rgba(16,185,129,0.08)' : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          background: isOn ? 'rgba(16,185,129,0.15)' : 'rgba(51,65,85,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14,
          transition: 'background 0.18s',
        }}>
          {feat.icon}
        </div>
        <span style={{
          fontSize: 12, fontWeight: 500,
          color: isOn ? '#a7f3d0' : '#64748b',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          transition: 'color 0.18s',
        }}>
          {feat.label}
        </span>
      </div>
      <Toggle on={isOn} onChange={onToggle} color="#10b981" />
    </div>
  )
}

// ─── Create User Modal ────────────────────────────────────────────────────────

function CreateUserModal({ newUser, setNewUser, onCreate, creating, onClose, viewerRole }) {
  const set = key => e => setNewUser(prev => ({ ...prev, [key]: e.target.value }))

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#1a1f2e', border: '1px solid #1e2d40',
          borderRadius: 16, padding: '24px', width: 420, maxWidth: '90vw',
        }}
      >
        <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, color: '#f8fafc' }}>Create New User</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 5, fontWeight: 500 }}>Email</label>
            <input
              type="email"
              placeholder="user@example.com"
              value={newUser.email}
              onChange={set('email')}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '9px 12px',
                background: '#0f1117', border: '1px solid #334155', borderRadius: 9,
                color: '#f8fafc', fontSize: 13, outline: 'none',
              }}
              onFocus={e => { e.target.style.borderColor = '#3b82f6' }}
              onBlur={e => { e.target.style.borderColor = '#334155' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 5, fontWeight: 500 }}>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={newUser.password}
              onChange={set('password')}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '9px 12px',
                background: '#0f1117', border: '1px solid #334155', borderRadius: 9,
                color: '#f8fafc', fontSize: 13, outline: 'none',
              }}
              onFocus={e => { e.target.style.borderColor = '#3b82f6' }}
              onBlur={e => { e.target.style.borderColor = '#334155' }}
            />
            <p style={{ margin: '5px 0 0', fontSize: 11, color: '#475569', lineHeight: 1.5 }}>
              Must include: 8+ characters, one uppercase letter, one digit, one special character (!@#$%^&amp;*())
            </p>
          </div>

          {viewerRole !== 'manager' && (
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 5, fontWeight: 500 }}>Role</label>
              <select
                value={newUser.role}
                onChange={set('role')}
                style={{
                  width: '100%', padding: '9px 12px',
                  background: '#0f1117', border: '1px solid #334155', borderRadius: 9,
                  color: '#f8fafc', fontSize: 13, cursor: 'pointer', outline: 'none',
                }}
                onFocus={e => { e.target.style.borderColor = '#3b82f6' }}
                onBlur={e => { e.target.style.borderColor = '#334155' }}
              >
                <option value="agent">Agent</option>
                <option value="sales_manager">Sales Manager</option>
                <option value="team_leader">Team Leader</option>
                <option value="marketing">Marketing</option>
                <option value="marketing_manager">Marketing Manager</option>
                <option value="sales_admin">Sales Admin</option>
                <option value="quality_control">Quality Control</option>
                <option value="manager">Manager</option>
                <option value="administrator">Administrator</option>
              </select>
            </div>
          )}

        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={creating}
            style={{
              padding: '8px 16px', background: '#0f1117',
              border: '1px solid #334155', borderRadius: 9,
              color: '#94a3b8', fontSize: 13, cursor: 'pointer',
            }}
            onMouseOver={e => { e.currentTarget.style.background = '#1e2840' }}
            onMouseOut={e => { e.currentTarget.style.background = '#0f1117' }}
          >
            Cancel
          </button>
          <button
            onClick={onCreate}
            disabled={creating}
            style={{
              padding: '8px 16px', background: creating ? '#1d4ed8' : '#3b82f6',
              border: 'none', borderRadius: 9,
              color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: creating ? 'not-allowed' : 'pointer', opacity: creating ? 0.7 : 1,
            }}
          >
            {creating ? 'Creating…' : 'Create User'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Quota Card (managers only) ───────────────────────────────────────────────

const QUOTA_PRESETS = [1, 3, 5, 10, 20, 50]

function QuotaCard({ user, onSetQuota }) {
  const [custom, setCustom] = useState('')
  const [mode, setMode] = useState('preset') // 'preset' | 'custom'

  const current = user.quota

  const apply = (val) => {
    onSetQuota(user.id, val)
    setCustom('')
    setMode('preset')
  }

  const applyCustom = () => {
    const n = parseInt(custom, 10)
    if (!n || n < 1) return
    apply(n)
  }

  return (
    <div style={{
      background: '#1a1f2e', border: '1px solid #1e2d40', borderRadius: 14,
      padding: '16px 20px', marginBottom: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>User Creation Quota</span>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748b' }}>
            Limit how many users this manager can create
          </p>
        </div>
        <span style={{
          padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700,
          background: current === null ? '#10b98120' : '#f59e0b20',
          color: current === null ? '#6ee7b7' : '#fcd34d',
          border: `1px solid ${current === null ? '#10b98140' : '#f59e0b40'}`,
        }}>
          {current === null ? 'Unlimited' : `${current} users`}
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: mode === 'custom' ? 10 : 0 }}>
        {QUOTA_PRESETS.map(n => (
          <button
            key={n}
            onClick={() => apply(n)}
            style={{
              padding: '5px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: current === n ? '#f59e0b30' : '#0f1117',
              border: `1px solid ${current === n ? '#f59e0b80' : '#334155'}`,
              color: current === n ? '#fcd34d' : '#94a3b8',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseOver={e => { if (current !== n) { e.currentTarget.style.borderColor = '#f59e0b60'; e.currentTarget.style.color = '#fcd34d' } }}
            onMouseOut={e => { if (current !== n) { e.currentTarget.style.borderColor = '#334155'; e.currentTarget.style.color = '#94a3b8' } }}
          >
            {n}
          </button>
        ))}
        <button
          onClick={() => setMode(m => m === 'custom' ? 'preset' : 'custom')}
          style={{
            padding: '5px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            background: mode === 'custom' ? '#3b82f620' : '#0f1117',
            border: `1px solid ${mode === 'custom' ? '#3b82f660' : '#334155'}`,
            color: mode === 'custom' ? '#93c5fd' : '#94a3b8',
            cursor: 'pointer', transition: 'all 0.15s',
          }}
        >
          Custom…
        </button>
        <button
          onClick={() => apply(null)}
          style={{
            padding: '5px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            background: current === null ? '#10b98120' : '#0f1117',
            border: `1px solid ${current === null ? '#10b98160' : '#334155'}`,
            color: current === null ? '#6ee7b7' : '#94a3b8',
            cursor: 'pointer', transition: 'all 0.15s',
          }}
          onMouseOver={e => { if (current !== null) { e.currentTarget.style.borderColor = '#10b98160'; e.currentTarget.style.color = '#6ee7b7' } }}
          onMouseOut={e => { if (current !== null) { e.currentTarget.style.borderColor = '#334155'; e.currentTarget.style.color = '#94a3b8' } }}
        >
          Unlimited
        </button>
      </div>

      {mode === 'custom' && (
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <input
            type="number"
            min={1}
            placeholder="Enter number…"
            value={custom}
            onChange={e => setCustom(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && applyCustom()}
            style={{
              flex: 1, padding: '7px 12px',
              background: '#0f1117', border: '1px solid #334155', borderRadius: 8,
              color: '#f8fafc', fontSize: 13, outline: 'none',
            }}
            onFocus={e => { e.target.style.borderColor = '#f59e0b' }}
            onBlur={e => { e.target.style.borderColor = '#334155' }}
          />
          <button
            onClick={applyCustom}
            style={{
              padding: '7px 16px', background: '#f59e0b', border: 'none',
              borderRadius: 8, color: '#0f1117', fontSize: 12, fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Set
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Edit User Modal ──────────────────────────────────────────────────────────

function EditUserModal({ user, form, setForm, onSave, saving, onClose }) {
  const set = key => e => setForm(prev => ({ ...prev, [key]: e.target.value }))
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#1a1f2e', border: '1px solid #1e2d40',
          borderRadius: 16, padding: '24px', width: 420, maxWidth: '90vw',
        }}
      >
        <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: '#f8fafc' }}>Edit User</h2>
        <p style={{ margin: '0 0 20px', fontSize: 12, color: '#64748b' }}>Leave a field blank to keep it unchanged.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 5, fontWeight: 500 }}>Email</label>
            <input
              type="email"
              placeholder={user.email}
              value={form.email}
              onChange={set('email')}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '9px 12px',
                background: '#0f1117', border: '1px solid #334155', borderRadius: 9,
                color: '#f8fafc', fontSize: 13, outline: 'none',
              }}
              onFocus={e => { e.target.style.borderColor = '#3b82f6' }}
              onBlur={e => { e.target.style.borderColor = '#334155' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 5, fontWeight: 500 }}>New Password</label>
            <input
              type="password"
              placeholder="Leave blank to keep current password"
              value={form.password}
              onChange={set('password')}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '9px 12px',
                background: '#0f1117', border: '1px solid #334155', borderRadius: 9,
                color: '#f8fafc', fontSize: 13, outline: 'none',
              }}
              onFocus={e => { e.target.style.borderColor = '#3b82f6' }}
              onBlur={e => { e.target.style.borderColor = '#334155' }}
            />
            <p style={{ margin: '5px 0 0', fontSize: 11, color: '#475569', lineHeight: 1.5 }}>
              Must include: 8+ characters, one uppercase letter, one digit, one special character (!@#$%^&amp;*())
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              padding: '8px 16px', background: '#0f1117',
              border: '1px solid #334155', borderRadius: 9,
              color: '#94a3b8', fontSize: 13, cursor: 'pointer',
            }}
            onMouseOver={e => { e.currentTarget.style.background = '#1e2840' }}
            onMouseOut={e => { e.currentTarget.style.background = '#0f1117' }}
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            style={{
              padding: '8px 16px', background: saving ? '#1d4ed8' : '#3b82f6',
              border: 'none', borderRadius: 9,
              color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Chat Permissions Tab ─────────────────────────────────────────────────────

const CHAT_PERM_LABELS = {
  directMessage:   { label: 'Direct Messages',   desc: 'Can send private 1-on-1 messages',         icon: '💬' },
  createGroups:    { label: 'Create Groups',      desc: 'Can create group conversations',            icon: '👥' },
  seeAllChats:     { label: 'View All Chats',     desc: 'Can monitor all team conversations',        icon: '👁️' },
  pinMessages:     { label: 'Pin Messages',       desc: 'Can pin important messages in chats',       icon: '📌' },
  deleteMessages:  { label: 'Delete Messages',    desc: 'Can delete any message in a conversation',  icon: '🗑️' },
}

const CHAT_ROLES = [
  { key: 'administrator',     label: 'Administrator',      color: '#93c5fd' },
  { key: 'manager',           label: 'Manager',            color: '#c4b5fd' },
  { key: 'sales_manager',     label: 'Sales Manager',      color: '#fcd34d' },
  { key: 'team_leader',       label: 'Team Leader',        color: '#67e8f9' },
  { key: 'agent',             label: 'Agent',              color: '#6ee7b7' },
  { key: 'marketing',         label: 'Marketing',          color: '#f9a8d4' },
  { key: 'marketing_manager', label: 'Marketing Manager',  color: '#d8b4fe' },
  { key: 'sales_admin',       label: 'Sales Admin',        color: '#fde68a' },
  { key: 'quality_control',   label: 'Quality Control',    color: '#a5b4fc' },
]

function ChatPermissionsTab({ chatPerms, updateChatPerm, isAdmin }) {
  const permKeys = Object.keys(CHAT_PERM_LABELS)

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>
          Control what each role can do inside the team messenger.
        </p>
      </div>

      {/* Permission legend */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {permKeys.map(k => (
          <div key={k} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 10px', borderRadius: 8,
            background: '#1a1f2e', border: '1px solid #1e2d40',
            fontSize: 11, color: '#64748b',
          }}>
            <span>{CHAT_PERM_LABELS[k].icon}</span>
            <span>{CHAT_PERM_LABELS[k].label}</span>
          </div>
        ))}
      </div>

      {/* Roles grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {CHAT_ROLES.map(role => {
          const perms = chatPerms[role.key] ?? {}
          const isAdminRole = role.key === 'administrator'
          return (
            <div key={role.key} style={{
              background: '#1a1f2e', border: '1px solid #1e2d40',
              borderRadius: 14, padding: '14px 18px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: `${role.color}18`,
                    border: `1px solid ${role.color}35`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700, color: role.color,
                  }}>
                    {role.label.slice(0, 1)}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{role.label}</span>
                </div>
                {isAdminRole && (
                  <span style={{ fontSize: 10, color: '#3b82f6', background: '#1e3a5f', padding: '2px 8px', borderRadius: 6, border: '1px solid #2563eb40' }}>
                    Full Access
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {permKeys.map(k => {
                  const on = isAdminRole ? true : (perms[k] ?? false)
                  const locked = isAdminRole || !isAdmin
                  return (
                    <div
                      key={k}
                      onClick={() => !locked && updateChatPerm(role.key, k, !on)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '5px 10px', borderRadius: 8,
                        background: on ? `${role.color}12` : '#111827',
                        border: `1px solid ${on ? role.color + '40' : '#1e2d40'}`,
                        cursor: locked ? 'default' : 'pointer',
                        transition: 'all 0.15s', userSelect: 'none',
                        opacity: locked && !on ? 0.5 : 1,
                      }}
                    >
                      <span style={{ fontSize: 12 }}>{CHAT_PERM_LABELS[k].icon}</span>
                      <span style={{ fontSize: 11, fontWeight: 500, color: on ? role.color : '#475569' }}>
                        {CHAT_PERM_LABELS[k].label}
                      </span>
                      <Toggle on={on} onChange={() => !locked && updateChatPerm(role.key, k, !on)} color={role.color} />
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SecurityPanel() {
  const { user: authUser } = useAuth()
  const { chatPerms, updateChatPerm } = useChat()
  const viewerRole = authUser?.role === 'admin' ? 'administrator' : (authUser?.role ?? 'agent')
  const isAdmin = viewerRole === 'administrator'
  const [tab, setTab] = useState('users')
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newUser, setNewUser] = useState({ email: '', role: 'agent', password: '' })
  const [creating, setCreating] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [editModal, setEditModal] = useState(null)
  const [editForm, setEditForm] = useState({ email: '', password: '' })
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('all')
  const [toast, setToast] = useState(null)
  const [securitySearch, setSecuritySearch] = useState('')
  const toastTimer = useRef(null)

  // Fetch real users from API on mount
  useEffect(() => {
    api.get('/api/users')
      .then(res => setUsers(res.data.map(apiUserToLocal)))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false))
  }, [])

  // Auto-select first user when entering security tab
  useEffect(() => {
    if (tab === 'security' && !selectedUser && users.length > 0) {
      setSelectedUser(users[0])
    }
  }, [tab, users]) // eslint-disable-line

  // Keep selectedUser in sync with users state changes
  useEffect(() => {
    if (selectedUser) {
      const updated = users.find(u => u.id === selectedUser.id)
      if (updated) setSelectedUser(updated)
    }
  }, [users]) // eslint-disable-line

  const showToast = useCallback((msg, type = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ msg, type })
    toastTimer.current = setTimeout(() => setToast(null), 2800)
  }, [])

  const toggleFeature = useCallback((userId, featureId) => {
    setUsers(prev => {
      const updated = prev.map(u => {
        if (u.id !== userId) return u
        const has = u.features.includes(featureId)
        return { ...u, features: has ? u.features.filter(f => f !== featureId) : [...u.features, featureId] }
      })
      const user = updated.find(u => u.id === userId)
      if (user) api.patch(`/api/users/${userId}/features`, { features: user.features }).catch(() => {})
      return updated
    })
    showToast('Permission updated')
  }, [showToast])

  const toggleAllFeatures = useCallback((userId, enable) => {
    const newFeatures = enable ? ALL_FEATURES.map(f => f.id) : []
    setUsers(prev => prev.map(u => u.id !== userId ? u : { ...u, features: newFeatures }))
    api.patch(`/api/users/${userId}/features`, { features: newFeatures }).catch(() => {})
    showToast(enable ? 'All features enabled' : 'All features disabled')
  }, [showToast])

  const changeRole = useCallback(async (userId, role) => {
    const apiRole = role === 'administrator' ? 'admin' : role
    const newFeatures = [...(ROLE_DEFAULTS[role] || ROLE_DEFAULTS.agent)]
    try {
      await api.patch(`/api/users/${userId}/role`, { role: apiRole })
      await api.patch(`/api/users/${userId}/features`, { features: newFeatures })
      setUsers(prev => prev.map(u =>
        u.id !== userId ? u : { ...u, role, features: newFeatures }
      ))
      showToast('Role updated')
    } catch (err) {
      showToast(err.message || 'Failed to update role', 'error')
    }
  }, [showToast])

  const toggleActive = useCallback(async (userId) => {
    try {
      await api.patch(`/api/users/${userId}/status`)
      setUsers(prev => prev.map(u =>
        u.id !== userId ? u : { ...u, active: !u.active }
      ))
      showToast('Status updated')
    } catch (err) {
      showToast(err.message || 'Failed to update status', 'error')
    }
  }, [showToast])

  const setQuota = useCallback(async (userId, quota) => {
    try {
      await api.patch(`/api/users/${userId}/quota`, { quota })
      setUsers(prev => prev.map(u => u.id !== userId ? u : { ...u, quota }))
      showToast(quota === null ? 'Quota set to unlimited' : `Quota set to ${quota} users`)
    } catch (err) {
      showToast(err.message || 'Failed to update quota', 'error')
    }
  }, [showToast])

  const openEdit = useCallback((user) => {
    setEditForm({ email: '', password: '' })
    setEditModal(user)
  }, [])

  const saveEdit = useCallback(async () => {
    if (!editModal) return
    const payload = {}
    if (editForm.email.trim())    payload.email    = editForm.email.trim()
    if (editForm.password.trim()) payload.password = editForm.password.trim()
    if (!Object.keys(payload).length) { setEditModal(null); return }
    setSaving(true)
    try {
      const res = await api.patch(`/api/users/${editModal.id}/profile`, payload)
      setUsers(prev => prev.map(u => u.id !== editModal.id ? u : apiUserToLocal(res.data)))
      setEditModal(null)
      showToast('User updated successfully')
    } catch (err) {
      showToast(err.message || 'Failed to update user', 'error')
    } finally {
      setSaving(false)
    }
  }, [editModal, editForm, showToast])

  const deleteUser = useCallback((user) => {
    setDeleteConfirm({ id: user.id, name: user.name })
  }, [])

  const confirmDelete = useCallback(async () => {
    if (!deleteConfirm) return
    setDeleting(true)
    try {
      await api.delete(`/api/users/${deleteConfirm.id}`)
      setUsers(prev => prev.filter(u => u.id !== deleteConfirm.id))
      if (selectedUser?.id === deleteConfirm.id) setSelectedUser(null)
      showToast(`${deleteConfirm.name} deleted`)
      setDeleteConfirm(null)
    } catch (err) {
      showToast(err.message || 'Failed to delete user', 'error')
    } finally {
      setDeleting(false)
    }
  }, [deleteConfirm, selectedUser, showToast])

  const createUser = useCallback(async () => {
    if (!newUser.email.trim() || !newUser.password.trim()) {
      showToast('Email and password are required', 'error')
      return
    }
    const apiRole = newUser.role === 'administrator' ? 'admin' : newUser.role
    setCreating(true)
    try {
      const res = await api.post('/api/users', {
        email: newUser.email.trim(),
        password: newUser.password,
        role: apiRole,
      })
      setUsers(prev => [...prev, apiUserToLocal(res.data)])
      setNewUser({ email: '', role: 'agent', password: '' })
      setShowCreateModal(false)
      showToast('User created successfully ✓')
    } catch (err) {
      showToast(err.message || 'Failed to create user', 'error')
    } finally {
      setCreating(false)
    }
  }, [newUser, showToast])

  const stats = {
    total:    users.length,
    active:   users.filter(u => u.active).length,
    inactive: users.filter(u => !u.active).length,
    admins:   users.filter(u => u.role === 'administrator').length,
  }

  const filteredUsers = users.filter(u => {
    // in admin view: hide agents that belong under a manager row (they show on expand)
    if (viewerRole !== 'manager' && u.createdById) return false
    const q = search.toLowerCase()
    return (!q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      && (filterRole === 'all' || u.role === filterRole)
  })

  const secFiltered = users.filter(u => {
    const q = securitySearch.toLowerCase()
    return !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
  })

  return (
    <>
      <style>{`
        @keyframes spToastIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={{
        background: '#0f1117', minHeight: '100%', padding: '24px',
        fontFamily: 'Inter, system-ui, sans-serif', color: '#f8fafc',
        boxSizing: 'border-box',
      }}>
        {/* Page Header */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f8fafc', margin: 0 }}>Security</h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>Manage users and access permissions</p>
        </div>

        {/* Stats Bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total Users', value: stats.total,    color: '#3b82f6' },
            { label: 'Active',      value: stats.active,   color: '#10b981' },
            { label: 'Inactive',    value: stats.inactive, color: '#f59e0b' },
            { label: 'Admins',      value: stats.admins,   color: '#8b5cf6' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: '#1a1f2e', border: '1px solid #1e2d40', borderRadius: 14, padding: '16px 20px' }}>
              <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 6px', fontWeight: 500 }}>{label}</p>
              <p style={{ fontSize: 28, fontWeight: 700, color, margin: 0, lineHeight: 1 }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', gap: 4, background: '#1a1f2e', border: '1px solid #1e2d40', borderRadius: 12, padding: 4, width: 'fit-content', marginBottom: 20 }}>
          {[
            { key: 'users',    label: '👥 Users' },
            { key: 'security', label: '🔒 Security Layer' },
            { key: 'chat',     label: '💬 Chat Permissions' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                padding: '7px 20px', borderRadius: 9, border: 'none',
                cursor: 'pointer', fontSize: 13, fontWeight: 600,
                background: tab === key ? '#3b82f6' : 'transparent',
                color: tab === key ? '#fff' : '#64748b',
                transition: 'all 0.15s',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {tab === 'users' && (
          loading
            ? <div style={{ color: '#64748b', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>Loading users…</div>
            : <UsersTab
                users={filteredUsers}
                allUsers={users}
                search={search}
                setSearch={setSearch}
                filterRole={filterRole}
                setFilterRole={setFilterRole}
                onManage={u => { setSelectedUser(u); setTab('security') }}
                onDelete={deleteUser}
                onCreateOpen={() => setShowCreateModal(true)}
              />
        )}

        {tab === 'chat' && (
          <ChatPermissionsTab
            chatPerms={chatPerms}
            updateChatPerm={updateChatPerm}
            isAdmin={isAdmin}
          />
        )}

        {tab === 'security' && (
          <SecurityTab
            users={secFiltered}
            selectedUser={selectedUser}
            onSelect={setSelectedUser}
            search={securitySearch}
            setSearch={setSecuritySearch}
            toggleFeature={toggleFeature}
            toggleAllFeatures={toggleAllFeatures}
            changeRole={changeRole}
            toggleActive={toggleActive}
            onEdit={openEdit}
            onSetQuota={setQuota}
          />
        )}
      </div>

      {showCreateModal && (
        <CreateUserModal
          newUser={newUser}
          setNewUser={setNewUser}
          onCreate={createUser}
          creating={creating}
          onClose={() => { setShowCreateModal(false); setNewUser({ email: '', role: 'agent', password: '' }) }}
          viewerRole={viewerRole}
        />
      )}

      {deleteConfirm && (
        <ConfirmDeleteModal
          name={deleteConfirm.name}
          deleting={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}

      {editModal && (
        <EditUserModal
          user={editModal}
          form={editForm}
          setForm={setEditForm}
          onSave={saveEdit}
          saving={saving}
          onClose={() => setEditModal(null)}
        />
      )}

      <Toast toast={toast} />
    </>
  )
}
