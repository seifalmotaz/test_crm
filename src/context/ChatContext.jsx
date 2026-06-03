import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { useAuth } from './AuthContext'
import api from '../lib/api'

const ChatContext = createContext(null)

const USER_COLORS = [
  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b',
  '#06b6d4', '#ec4899', '#ef4444', '#84cc16', '#f97316', '#a78bfa',
]

function mapApiUser(u, index) {
  const namePart = u.email.split('@')[0].replace(/[._-]/g, ' ')
  const name = namePart.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  const avatar = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '??'
  return {
    id: u.id,
    name,
    role: u.role,
    avatar,
    color: USER_COLORS[index % USER_COLORS.length],
    online: u.isActive,
    email: u.email,
  }
}

// Convert DB conversation to the shape the UI expects
function mapConvo(c, meId) {
  return {
    id: c.id,
    type: c.type,
    name: c.name ?? null,
    avatar: c.name ? c.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : null,
    color: '#3b82f6',
    participants: c.participants.map(p => p.userId ?? p.user?.id),
    unread: c.unread ?? 0,
    messages: (c.messages ?? []).map(m => mapMsg(m, meId)),
    _lastMessageAt: c.messages?.[0]?.createdAt ?? c.createdAt,
  }
}

function mapMsg(m, _meId) {
  return {
    id: m.id,
    senderId: m.senderId,
    type: m.type ?? 'text',
    text: m.text ?? '',
    fileUrl:  m.fileUrl  ?? null,
    fileName: m.fileName ?? null,
    fileSize: m.fileSize ?? null,
    fileMime: m.fileMime ?? null,
    duration: null,
    time: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    read: true,
    createdAt: m.createdAt,
  }
}

const DEFAULT_CHAT_PERMS = {
  administrator:    { directMessage: true,  createGroups: true,  seeAllChats: true,  pinMessages: true,  deleteMessages: true  },
  manager:          { directMessage: true,  createGroups: true,  seeAllChats: false, pinMessages: true,  deleteMessages: false },
  sales_manager:    { directMessage: true,  createGroups: true,  seeAllChats: false, pinMessages: false, deleteMessages: false },
  team_leader:      { directMessage: true,  createGroups: true,  seeAllChats: false, pinMessages: false, deleteMessages: false },
  agent:            { directMessage: true,  createGroups: false, seeAllChats: false, pinMessages: false, deleteMessages: false },
  marketing:        { directMessage: true,  createGroups: false, seeAllChats: false, pinMessages: false, deleteMessages: false },
  marketing_manager:{ directMessage: true,  createGroups: true,  seeAllChats: false, pinMessages: false, deleteMessages: false },
  sales_admin:      { directMessage: true,  createGroups: false, seeAllChats: false, pinMessages: false, deleteMessages: false },
  quality_control:  { directMessage: false, createGroups: false, seeAllChats: false, pinMessages: false, deleteMessages: false },
}

export function ChatProvider({ children }) {
  const { user }                          = useAuth()
  const [chatUsers, setChatUsers]         = useState([])
  const [isOpen, setIsOpen]               = useState(false)
  const [activeConvoId, setActiveConvoId] = useState(null)
  const [conversations, setConversations] = useState([])
  const [chatPerms, setChatPerms]         = useState(DEFAULT_CHAT_PERMS)
  const pollRef = useRef(null)

  const meId = user?.id ?? null

  // ── Load full message history for one conversation ────────────────────────
  const loadMessages = useCallback(async (convoId) => {
    try {
      const res = await api.get(`/api/chat/conversations/${convoId}/messages?limit=100`)
      const dbMsgs = (res.data || []).map(m => mapMsg(m, user.id))
      setConversations(prev => prev.map(c => {
        if (c.id !== convoId) return c
        // Preserve any pending optimistic (temp) messages so they don't flicker
        const temps = c.messages.filter(m => String(m.id).startsWith('temp_'))
        const dbIds  = new Set(dbMsgs.map(m => m.id))
        const merged = [...dbMsgs, ...temps.filter(t => !dbIds.has(t.id))]
          .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        return { ...c, messages: merged }
      }))
    } catch {}
  }, [user])

  // ── Fetch all conversations (metadata + new msgs for non-active convos) ───
  const fetchConversations = useCallback(async () => {
    if (!user) return
    try {
      const res = await api.get('/api/chat/conversations')
      const fresh = (res.data || []).map(c => mapConvo(c, user.id))
      setConversations(prev => {
        const prevMap = Object.fromEntries(prev.map(c => [c.id, c]))
        return fresh.map(nc => {
          const existing = prevMap[nc.id]
          if (!existing) return nc

          // If there are pending temp (optimistic) messages, don't merge new ones
          // to avoid duplicates — sendMessage will handle the replacement
          const hasPendingTemp = existing.messages.some(m => String(m.id).startsWith('temp_'))
          if (hasPendingTemp) return { ...nc, messages: existing.messages }

          // Add any genuinely new messages from API (API only returns the latest 1)
          const existingIds = new Set(existing.messages.map(m => m.id))
          const newMsgs = nc.messages.filter(m => !existingIds.has(m.id))
          return {
            ...nc,
            messages: newMsgs.length
              ? [...existing.messages, ...newMsgs].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
              : existing.messages,
          }
        })
      })
    } catch {}
  }, [user])

  // ── Fetch users ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) { setChatUsers([]); setConversations([]); return }
    api.get('/api/chat/users')
      .then(res => {
        setChatUsers(
          (res.data || []).filter(u => u.id !== user.id).map(mapApiUser)
        )
      })
      .catch(() => {})
    fetchConversations()
  }, [user?.id])

  // ── Poll conversation list (unread badges, new convos) ───────────────────
  useEffect(() => {
    if (isOpen) {
      pollRef.current = setInterval(fetchConversations, 4000)
    } else {
      clearInterval(pollRef.current)
    }
    return () => clearInterval(pollRef.current)
  }, [isOpen, fetchConversations])

  // ── Poll active conversation messages (ensures all messages stay visible) ─
  const msgPollRef = useRef(null)
  useEffect(() => {
    clearInterval(msgPollRef.current)
    if (isOpen && activeConvoId) {
      msgPollRef.current = setInterval(() => loadMessages(activeConvoId), 4000)
    }
    return () => clearInterval(msgPollRef.current)
  }, [isOpen, activeConvoId, loadMessages])

  const totalUnread = conversations.reduce((a, c) => a + c.unread, 0)

  // Load full messages when active conversation changes
  useEffect(() => {
    if (activeConvoId) loadMessages(activeConvoId)
  }, [activeConvoId])

  const openChat = useCallback((convoId = null) => {
    setIsOpen(true)
    if (convoId) setActiveConvoId(convoId)
  }, [])

  const closeChat = useCallback(() => setIsOpen(false), [])

  // ── Send message ─────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (convoId, payload) => {
    const isText = typeof payload === 'string'
    if (isText && !payload.trim()) return

    const body = isText
      ? { type: 'text', text: payload }
      : { type: payload.type ?? 'text', text: payload.text ?? '', fileUrl: payload.fileUrl, fileName: payload.fileName, fileSize: payload.fileSize, fileMime: payload.fileMime }

    // Optimistic update
    const tempId = `temp_${Date.now()}`
    const tempMsg = {
      id: tempId,
      senderId: meId,
      type: body.type,
      text: body.text,
      fileUrl: body.fileUrl ?? null,
      fileName: body.fileName ?? null,
      fileSize: body.fileSize ?? null,
      fileMime: body.fileMime ?? null,
      duration: null,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      read: true,
      createdAt: new Date().toISOString(),
    }
    setConversations(prev => prev.map(c =>
      c.id !== convoId ? c : { ...c, messages: [...c.messages, tempMsg] }
    ))

    try {
      const res = await api.post(`/api/chat/conversations/${convoId}/messages`, body)
      const saved = mapMsg(res.data, meId)
      // Replace temp message with saved one
      setConversations(prev => prev.map(c =>
        c.id !== convoId ? c : {
          ...c,
          messages: c.messages.map(m => m.id === tempId ? saved : m),
        }
      ))
    } catch {
      // Remove failed temp message
      setConversations(prev => prev.map(c =>
        c.id !== convoId ? c : { ...c, messages: c.messages.filter(m => m.id !== tempId) }
      ))
    }
  }, [meId])

  // ── Create direct chat ────────────────────────────────────────────────────
  const createDirectChat = useCallback(async (userId) => {
    const existing = conversations.find(
      c => c.type === 'direct' &&
           c.participants.includes(userId) &&
           c.participants.includes(meId)
    )
    if (existing) { setActiveConvoId(existing.id); return existing.id }

    try {
      const res = await api.post('/api/chat/conversations/direct', { targetUserId: userId })
      const convo = mapConvo(res.data, meId)
      setConversations(prev => [convo, ...prev.filter(c => c.id !== convo.id)])
      setActiveConvoId(convo.id)
      return convo.id
    } catch {}
  }, [conversations, meId])

  // ── Create group ──────────────────────────────────────────────────────────
  const createGroup = useCallback(async (name, memberIds) => {
    try {
      const res = await api.post('/api/chat/conversations/group', { name, memberIds })
      const convo = mapConvo(res.data, meId)
      setConversations(prev => [convo, ...prev])
      setActiveConvoId(convo.id)
      return convo.id
    } catch {}
  }, [meId])

  // ── Mark as read ──────────────────────────────────────────────────────────
  const markAsRead = useCallback(async (convoId) => {
    setConversations(prev => prev.map(c =>
      c.id !== convoId ? c : { ...c, unread: 0 }
    ))
    try {
      await api.post(`/api/chat/conversations/${convoId}/read`)
    } catch {}
  }, [])

  const updateChatPerm = useCallback((role, key, value) => {
    setChatPerms(prev => ({ ...prev, [role]: { ...prev[role], [key]: value } }))
  }, [])

  return (
    <ChatContext.Provider value={{
      isOpen, openChat, closeChat,
      conversations, setConversations, activeConvoId, setActiveConvoId,
      sendMessage, createDirectChat, createGroup, markAsRead, loadMessages,
      totalUnread,
      chatPerms, updateChatPerm,
      chatUsers,
      me: user,
      meId,
    }}>
      {children}
    </ChatContext.Provider>
  )
}

export const useChat = () => useContext(ChatContext)
