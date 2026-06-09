import { useState } from 'react'
import { X } from 'lucide-react'
import type { CreateUserDto } from '../../api/types.gen'

interface AddUserModalProps {
  onClose: () => void
  onSaved: (data: CreateUserDto) => Promise<void>
  currentUserRole: string
}

interface FormState {
  firstName: string
  lastName: string
  email: string
  password: string
  role: string
  commissionSplit: string
}

interface FormErrors {
  [key: string]: string
}

function getAvailableRoles(currentUserRole: string): { value: string; label: string }[] {
  if (currentUserRole === 'admin') {
    return [
      { value: 'admin', label: 'Admin' },
      { value: 'manager', label: 'Manager' },
      { value: 'agent', label: 'Agent' },
    ]
  }
  if (currentUserRole === 'manager') {
    return [
      { value: 'agent', label: 'Agent' },
    ]
  }
  return []
}

export default function AddUserModal({ onClose, onSaved, currentUserRole }: AddUserModalProps) {
  const [form, setForm] = useState<FormState>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'agent',
    commissionSplit: '',
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [generatePassword, setGeneratePassword] = useState(true)

  const availableRoles = getAvailableRoles(currentUserRole)

  function updateField(k: keyof FormState, v: string) {
    setForm(p => ({ ...p, [k]: v }))
  }

  function validate(): FormErrors {
    const e: FormErrors = {}
    if (!form.firstName.trim()) e.firstName = 'Required'
    if (!form.lastName.trim()) e.lastName = 'Required'
    if (!form.email.trim()) e.email = 'Required'
    if (!generatePassword && !form.password) e.password = 'Required'
    if (!generatePassword && form.password && form.password.length < 8) e.password = 'Minimum 8 characters'
    if (!form.role) e.role = 'Required'
    if (form.role === 'agent') {
      const cs = parseFloat(form.commissionSplit)
      if (isNaN(cs) || cs < 0 || cs > 1) e.commissionSplit = 'Must be between 0 and 1'
    }
    return e
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setError('')

    const dto: CreateUserDto = {
      email: form.email.trim(),
      name: `${form.firstName.trim()} ${form.lastName.trim()}`,
      role: form.role as 'admin' | 'manager' | 'agent',
      ...(form.role === 'agent' && form.commissionSplit ? { commissionSplit: parseFloat(form.commissionSplit) } : {}),
      ...(!generatePassword && form.password ? { password: form.password } : {}),
    }

    setSaving(true)
    try {
      await onSaved(dto)
    } catch (err: any) {
      const msg = err?.code === 'USER_ALREADY_EXISTS'
        ? 'Email already in use'
        : err?.detail || 'Failed to create user'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  function inputCls(field: string) {
    return `w-full bg-white/5 border ${errors[field] ? 'border-red-500/50' : 'border-white/10'} rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-all`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card card-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-white/8">
          <h2 className="text-white font-semibold">Add User</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <div>
            <p className="text-slate-400 text-[10px] uppercase tracking-widest mb-3">Account Details</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 text-xs mb-1 block">First Name *</label>
                <input
                  value={form.firstName}
                  onChange={e => updateField('firstName', e.target.value)}
                  className={inputCls('firstName')}
                  placeholder="Sarah"
                />
                {errors.firstName && <p className="text-red-400 text-[10px] mt-0.5">{errors.firstName}</p>}
              </div>
              <div>
                <label className="text-slate-400 text-xs mb-1 block">Last Name *</label>
                <input
                  value={form.lastName}
                  onChange={e => updateField('lastName', e.target.value)}
                  className={inputCls('lastName')}
                  placeholder="Johnson"
                />
                {errors.lastName && <p className="text-red-400 text-[10px] mt-0.5">{errors.lastName}</p>}
              </div>
              <div className="col-span-2">
                <label className="text-slate-400 text-xs mb-1 block">Email *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => updateField('email', e.target.value)}
                  className={inputCls('email')}
                  placeholder="sarah@pin-crm.io"
                />
                {errors.email && <p className="text-red-400 text-[10px] mt-0.5">{errors.email}</p>}
              </div>
              <div className="col-span-2">
                <label className="text-slate-400 text-xs mb-1 block">
                  Password
                  <button
                    type="button"
                    onClick={() => setGeneratePassword(!generatePassword)}
                    className="ml-2 text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    {generatePassword ? '(Auto-generate)' : '(Set manually)'}
                  </button>
                </label>
                {!generatePassword && (
                  <>
                    <input
                      type="password"
                      value={form.password}
                      onChange={e => updateField('password', e.target.value)}
                      className={inputCls('password')}
                      placeholder="Minimum 8 characters"
                    />
                    {errors.password && <p className="text-red-400 text-[10px] mt-0.5">{errors.password}</p>}
                  </>
                )}
                {generatePassword && (
                  <p className="text-slate-500 text-[10px]">A random password will be generated.</p>
                )}
              </div>
            </div>
          </div>

          <div>
            <p className="text-slate-400 text-[10px] uppercase tracking-widest mb-3 border-t border-white/8 pt-4">Permissions</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 text-xs mb-1 block">Role *</label>
                <select
                  value={form.role}
                  onChange={e => updateField('role', e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50"
                >
                  {availableRoles.map(r => (
                    <option key={r.value} value={r.value} className="bg-slate-800">{r.label}</option>
                  ))}
                </select>
                {errors.role && <p className="text-red-400 text-[10px] mt-0.5">{errors.role}</p>}
              </div>
              {form.role === 'agent' && (
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">Commission Split (0–1)</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    value={form.commissionSplit}
                    onChange={e => updateField('commissionSplit', e.target.value)}
                    className={inputCls('commissionSplit')}
                    placeholder="0.70"
                  />
                  {errors.commissionSplit && <p className="text-red-400 text-[10px] mt-0.5">{errors.commissionSplit}</p>}
                </div>
              )}
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/8 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-60 rounded-xl text-sm font-semibold text-white transition-all"
            >
              {saving ? 'Saving...' : 'Add User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}