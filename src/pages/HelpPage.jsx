import { useState } from 'react'
import { HelpCircle, MessageSquare, BookOpen, ChevronDown, ChevronUp, Mail, Phone, ExternalLink, Search, CheckCircle, AlertCircle, Zap, Shield, BarChart3, Users } from 'lucide-react'

const FAQS = [
  {
    category: 'Getting Started',
    icon: <Zap size={14} />,
    color: '#f59e0b',
    items: [
      { q: 'How do I add a new lead?', a: 'Go to the Leads page and click the "+ Add Lead" button in the top-right corner. Fill in the required fields (name, email, phone, budget) and click Save.' },
      { q: 'How do I assign a lead to an agent?', a: 'Open any lead from the Leads page, scroll to the Agent section in the drawer, and select an agent from the dropdown. Changes are saved automatically.' },
      { q: 'How do I import leads in bulk?', a: 'On the Leads page, click the "Import" button and upload an Excel (.xlsx) or CSV file. Download the template first to ensure the correct format.' },
    ],
  },
  {
    category: 'Deals & Pipeline',
    icon: <BarChart3 size={14} />,
    color: '#3b82f6',
    items: [
      { q: 'How do I move a deal to the next stage?', a: 'In the Deals page (Kanban view), drag and drop the deal card to the target column. Alternatively, open the deal and change the stage from the dropdown.' },
      { q: 'How are commissions calculated?', a: 'Commissions are calculated automatically based on the deal value and the commission rate set for each agent in the Agents page. You can view commission breakdowns in the Analytics section.' },
      { q: 'Can I attach documents to a deal?', a: 'Yes. Open a deal and scroll to the Documents section. Click "Attach" to upload PDFs, images, or any file up to 25MB.' },
    ],
  },
  {
    category: 'Team & Security',
    icon: <Shield size={14} />,
    color: '#8b5cf6',
    items: [
      { q: 'How do I create a new user?', a: 'Go to Security → Users tab → click "+ New User". Enter the email, set a role, and the user will receive an invitation email with their temporary password.' },
      { q: 'How do I change a user\'s permissions?', a: 'In Security → Security Layer tab, select the user and toggle individual feature access. Changes take effect immediately on their next page load.' },
      { q: 'How do I reset a user\'s password?', a: 'In Security → Users tab, click the edit (✏️) icon next to the user, enter a new password in the password field, and save. The user must meet the password complexity requirements.' },
    ],
  },
  {
    category: 'Chat & Communication',
    icon: <MessageSquare size={14} />,
    color: '#10b981',
    items: [
      { q: 'How do I send a voice note?', a: 'Open the chat panel (blue button, bottom-right), open any conversation, and click the 🎤 microphone button when the text input is empty. Click "Send" to send the recording.' },
      { q: 'How do I create a group chat?', a: 'In the chat panel, click the 👥 icon in the header, enter a group name, select members, and click "Create Group".' },
      { q: 'How can I view another user\'s chats as admin?', a: 'Open the chat panel, click the 🛡 shield icon (Admin Access), select any user, and you can view all their conversations and groups.' },
    ],
  },
]

const CONTACTS = [
  { icon: <Mail size={16} />, label: 'Email Support',  value: 'support@pin-crm.io',    color: '#E53935', href: 'mailto:support@pin-crm.io' },
  { icon: <Phone size={16} />, label: 'Phone Support', value: '+1 (800) 776-2276',      color: '#10b981', href: 'tel:+18007762276' },
  { icon: <MessageSquare size={16} />, label: 'Live Chat', value: 'Available 9am–6pm', color: '#8b5cf6', href: null },
]

export default function HelpPage() {
  const [openFaq, setOpenFaq]     = useState(null)
  const [search, setSearch]       = useState('')
  const [sent, setSent]           = useState(false)
  const [form, setForm]           = useState({ subject: '', message: '' })

  const setField = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  const allFaqs = FAQS.flatMap(cat =>
    cat.items.map(item => ({ ...item, category: cat.category, color: cat.color }))
  )
  const filtered = search.trim()
    ? allFaqs.filter(f => f.q.toLowerCase().includes(search.toLowerCase()) || f.a.toLowerCase().includes(search.toLowerCase()))
    : null

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.subject.trim() || !form.message.trim()) return
    setSent(true)
    setForm({ subject: '', message: '' })
    setTimeout(() => setSent(false), 4000)
  }

  return (
    <div style={{ padding: '28px 24px', background: '#0f1117', minHeight: '100%', fontFamily: 'Inter, system-ui, sans-serif', color: '#f8fafc', boxSizing: 'border-box' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <HelpCircle size={18} color="#60a5fa" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f8fafc', margin: 0 }}>Help & Support</h1>
        </div>
        <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>Find answers, contact support, or browse documentation</p>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 28, maxWidth: 520 }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search questions..."
          style={{ width: '100%', boxSizing: 'border-box', padding: '11px 16px 11px 36px', background: '#1a1f2e', border: '1px solid #1e2d40', borderRadius: 12, color: '#f1f5f9', fontSize: 13, outline: 'none' }}
          onFocus={e => { e.target.style.borderColor = '#3b82f6' }}
          onBlur={e => { e.target.style.borderColor = '#1e2d40' }}
        />
      </div>

      {/* Search results */}
      {filtered && (
        <div style={{ marginBottom: 28 }}>
          <p style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            {filtered.length} result{filtered.length !== 1 ? 's' : ''} for "{search}"
          </p>
          {filtered.length === 0 ? (
            <div style={{ padding: '20px', background: '#1a1f2e', borderRadius: 12, border: '1px solid #1e2d40', textAlign: 'center' }}>
              <AlertCircle size={20} color="#475569" style={{ marginBottom: 8 }} />
              <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>No results found. Try a different search or contact support below.</p>
            </div>
          ) : filtered.map((f, i) => (
            <FaqItem key={i} item={f} isOpen={openFaq === `s${i}`} onToggle={() => setOpenFaq(openFaq === `s${i}` ? null : `s${i}`)} showCategory />
          ))}
        </div>
      )}

      {/* FAQ + Contact grid */}
      {!filtered && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>

          {/* FAQ */}
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <BookOpen size={15} color="#60a5fa" /> Frequently Asked Questions
            </h2>
            {FAQS.map((cat, ci) => (
              <div key={ci} style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                  <span style={{ color: cat.color }}>{cat.icon}</span>
                  <p style={{ fontSize: 11, fontWeight: 700, color: cat.color, textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>{cat.category}</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {cat.items.map((item, ii) => {
                    const id = `${ci}-${ii}`
                    return <FaqItem key={ii} item={item} isOpen={openFaq === id} onToggle={() => setOpenFaq(openFaq === id ? null : id)} />
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Contact */}
            <div style={{ background: '#1a1f2e', border: '1px solid #1e2d40', borderRadius: 16, padding: '20px' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
                <Users size={14} color="#60a5fa" /> Contact Support
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {CONTACTS.map(c => (
                  <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: '#111827', border: '1px solid #1e2d40' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: `${c.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.color, flexShrink: 0 }}>
                      {c.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 10, color: '#475569', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{c.label}</p>
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', margin: '2px 0 0' }}>{c.value}</p>
                    </div>
                    {c.href && (
                      <a href={c.href} style={{ color: '#475569', display: 'flex' }}><ExternalLink size={12} /></a>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Send message */}
            <div style={{ background: '#1a1f2e', border: '1px solid #1e2d40', borderRadius: 16, padding: '20px' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
                <MessageSquare size={14} color="#8b5cf6" /> Send a Message
              </h3>
              {sent ? (
                <div style={{ padding: '16px', borderRadius: 10, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle size={16} color="#10b981" />
                  <p style={{ fontSize: 13, color: '#6ee7b7', margin: 0 }}>Message sent! We'll reply within 24h.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input
                    placeholder="Subject"
                    value={form.subject}
                    onChange={setField('subject')}
                    required
                    style={{ padding: '9px 12px', background: '#111827', border: '1px solid #1e2d40', borderRadius: 9, color: '#f1f5f9', fontSize: 12, outline: 'none' }}
                    onFocus={e => { e.target.style.borderColor = '#8b5cf6' }}
                    onBlur={e => { e.target.style.borderColor = '#1e2d40' }}
                  />
                  <textarea
                    placeholder="Describe your issue..."
                    value={form.message}
                    onChange={setField('message')}
                    required
                    rows={4}
                    style={{ padding: '9px 12px', background: '#111827', border: '1px solid #1e2d40', borderRadius: 9, color: '#f1f5f9', fontSize: 12, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
                    onFocus={e => { e.target.style.borderColor = '#8b5cf6' }}
                    onBlur={e => { e.target.style.borderColor = '#1e2d40' }}
                  />
                  <button type="submit" style={{ padding: '9px', background: 'linear-gradient(135deg,#7c3aed,#8b5cf6)', border: 'none', borderRadius: 9, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    Send Message
                  </button>
                </form>
              )}
            </div>

            {/* Version */}
            <div style={{ padding: '12px 16px', background: '#1a1f2e', border: '1px solid #1e2d40', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>PIN CRM Version</p>
              <span style={{ fontSize: 11, color: '#E53935', fontWeight: 600, background: 'rgba(229,57,53,0.1)', padding: '2px 8px', borderRadius: 6 }}>v2.4.1</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FaqItem({ item, isOpen, onToggle, showCategory }) {
  return (
    <div style={{ background: '#1a1f2e', border: `1px solid ${isOpen ? '#1e3a5f' : '#1e2d40'}`, borderRadius: 11, overflow: 'hidden', transition: 'border-color 0.15s' }}>
      <button
        onClick={onToggle}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          {showCategory && <p style={{ fontSize: 9, color: item.color, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 3px' }}>{item.category}</p>}
          <p style={{ fontSize: 12, fontWeight: 600, color: isOpen ? '#93c5fd' : '#e2e8f0', margin: 0, lineHeight: 1.4 }}>{item.q}</p>
        </div>
        {isOpen ? <ChevronUp size={14} color="#475569" style={{ flexShrink: 0 }} /> : <ChevronDown size={14} color="#475569" style={{ flexShrink: 0 }} />}
      </button>
      {isOpen && (
        <div style={{ padding: '0 14px 13px', borderTop: '1px solid #1e2d40' }}>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: '10px 0 0', lineHeight: 1.7 }}>{item.a}</p>
        </div>
      )}
    </div>
  )
}
