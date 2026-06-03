import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Send, Plus, Search, Users, MessageSquare, Check, CheckCheck, ArrowLeft, ShieldCheck, Eye, Maximize2, Minimize2, Paperclip, Mic, MicOff, Play, Pause, FileText, Film, ImageIcon, Download, StopCircle, XCircle, Trash2, CheckSquare } from 'lucide-react'
import { useChat } from '../../context/ChatContext'
import api, { upload } from '../../lib/api'

function getConvoMeta(convo, chatUsers, meId) {
  if (convo.type === 'group') return { name: convo.name, initials: convo.avatar, color: convo.color, online: false }
  const otherId = convo.participants.find(id => id !== meId)
  const u = chatUsers.find(u => u.id === otherId)
  return { name: u?.name ?? 'Unknown', initials: u?.avatar ?? '??', color: u?.color ?? '#3b82f6', online: u?.online ?? false }
}

function getLastMsg(convo, meId) {
  if (!convo.messages.length) return { text: 'No messages yet', time: '' }
  const last = convo.messages[convo.messages.length - 1]
  return { text: (last.senderId === meId ? 'You: ' : '') + last.text, time: last.time }
}

function UserAvatar({ initials, color, size = 36, online = false }) {
  return (
    <div className="relative flex-shrink-0">
      <div
        style={{
          width: size, height: size, borderRadius: 10,
          background: `${color}22`, color,
          border: `1px solid ${color}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: size * 0.28, fontWeight: 700,
        }}
      >
        {initials}
      </div>
      {online && (
        <span
          style={{
            position: 'absolute', bottom: -2, right: -2,
            width: 10, height: 10, borderRadius: '50%',
            background: '#34d399', border: '2px solid #0a0f1e',
          }}
        />
      )}
    </div>
  )
}

const ROLE_COLORS = {
  administrator: '#93c5fd', manager: '#c4b5fd', agent: '#6ee7b7',
  sales_manager: '#fcd34d', team_leader: '#67e8f9', marketing: '#f9a8d4',
  marketing_manager: '#d8b4fe', sales_admin: '#fde68a', quality_control: '#a5b4fc',
}

function UserRow({ u, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 12px', cursor: 'pointer', textAlign: 'left',
        background: 'transparent', border: 'none',
        borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      <UserAvatar initials={u.avatar} color={u.color} size={32} online={u.online} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: '#f1f5f9', margin: 0 }}>{u.name}</p>
        <p style={{
          fontSize: 10, margin: 0,
          color: ROLE_COLORS[u.role] ?? '#475569',
          textTransform: 'capitalize',
        }}>
          {u.role.replace(/_/g, ' ')}
        </p>
      </div>
      <div style={{
        width: 24, height: 24, borderRadius: 8, flexShrink: 0,
        background: 'rgba(37,99,235,0.15)', border: '1px solid rgba(59,130,246,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <MessageSquare size={10} color="#60a5fa" />
      </div>
    </button>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fmtDuration(sec) {
  if (!sec) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function fileIcon(mime) {
  if (!mime) return <FileText size={18} color="#94a3b8" />
  if (mime.startsWith('image/')) return <ImageIcon size={18} color="#60a5fa" />
  if (mime.startsWith('video/')) return <Film size={18} color="#a78bfa" />
  if (mime.startsWith('audio/')) return <Mic size={18} color="#34d399" />
  if (mime.includes('pdf')) return <FileText size={18} color="#f87171" />
  if (mime.includes('word') || mime.includes('document')) return <FileText size={18} color="#60a5fa" />
  return <FileText size={18} color="#94a3b8" />
}

// ── Message Bubble ────────────────────────────────────────────────────────────

function AudioPlayer({ src, isMe }) {
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [loadError, setLoadError] = useState(false)
  const audioRef = useRef(null)

  function toggle() {
    if (!audioRef.current || loadError) return
    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
    } else {
      audioRef.current.play().then(() => setPlaying(true)).catch(() => setLoadError(true))
    }
  }

  if (loadError) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 160 }}>
        <span style={{ fontSize: 10, color: isMe ? 'rgba(255,255,255,0.5)' : '#64748b' }}>⚠ Audio unavailable</span>
        <a href={src} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: isMe ? 'rgba(255,255,255,0.7)' : '#60a5fa', textDecoration: 'underline' }}>Download</a>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 160 }}>
      <audio ref={audioRef}
        src={src}
        onTimeUpdate={e => setProgress(e.target.currentTime)}
        onLoadedMetadata={e => setDuration(e.target.duration)}
        onEnded={() => { setPlaying(false); setProgress(0) }}
        onError={() => setLoadError(true)}
      />
      <button onClick={toggle} style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: isMe ? 'rgba(255,255,255,0.25)' : 'rgba(37,99,235,0.3)', color: isMe ? '#fff' : '#93c5fd' }}>
        {playing ? <Pause size={11} /> : <Play size={11} />}
      </button>
      <div style={{ flex: 1 }}>
        <div style={{ height: 3, borderRadius: 2, background: isMe ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)', position: 'relative', cursor: 'pointer' }}
          onClick={e => {
            if (!audioRef.current || !duration) return
            const rect = e.currentTarget.getBoundingClientRect()
            const pct = (e.clientX - rect.left) / rect.width
            audioRef.current.currentTime = pct * duration
          }}>
          <div style={{ height: '100%', borderRadius: 2, width: `${duration ? (progress / duration) * 100 : 0}%`, background: isMe ? 'rgba(255,255,255,0.8)' : '#60a5fa', transition: 'width 0.1s' }} />
        </div>
        <p style={{ fontSize: 9, color: isMe ? 'rgba(255,255,255,0.6)' : '#475569', margin: '3px 0 0' }}>
          {fmtDuration(progress)} / {fmtDuration(duration)}
        </p>
      </div>
    </div>
  )
}

function MessageBubble({ msg, isMe, expanded }) {
  const isImg   = msg.type === 'image'
  const isVideo = msg.type === 'video'
  const isAudio = msg.type === 'audio'
  const isFile  = msg.type === 'file'

  const bubbleBase = {
    borderRadius: 14, overflow: 'hidden',
    ...(isMe
      ? { background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', color: '#fff', borderBottomRightRadius: 4, boxShadow: '0 4px 12px rgba(37,99,235,0.3)' }
      : { background: 'rgba(255,255,255,0.08)', color: '#cbd5e1', borderBottomLeftRadius: 4 }
    ),
  }

  if (isImg) return (
    <div style={bubbleBase}>
      <img src={msg.fileUrl} alt={msg.fileName} style={{ display: 'block', maxWidth: expanded ? 360 : 200, maxHeight: 200, objectFit: 'cover', cursor: 'pointer' }}
        onClick={() => window.open(msg.fileUrl, '_blank')} />
      {msg.text && <p style={{ padding: '6px 10px', margin: 0, fontSize: 12 }}>{msg.text}</p>}
    </div>
  )

  if (isVideo) return (
    <div style={bubbleBase}>
      <video src={msg.fileUrl} controls style={{ display: 'block', maxWidth: expanded ? 360 : 200, maxHeight: 180 }} />
      {msg.text && <p style={{ padding: '6px 10px', margin: 0, fontSize: 12 }}>{msg.text}</p>}
    </div>
  )

  if (isAudio) return (
    <div style={{ ...bubbleBase, padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <Mic size={11} color={isMe ? 'rgba(255,255,255,0.7)' : '#34d399'} />
        <span style={{ fontSize: 10, color: isMe ? 'rgba(255,255,255,0.7)' : '#475569' }}>Voice Note</span>
      </div>
      <AudioPlayer src={msg.fileUrl} isMe={isMe} />
    </div>
  )

  if (isFile) return (
    <div style={{ ...bubbleBase, padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: isMe ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {fileIcon(msg.fileMime)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 11, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msg.fileName}</p>
          <p style={{ fontSize: 9, margin: '2px 0 0', color: isMe ? 'rgba(255,255,255,0.6)' : '#475569' }}>{fmtSize(msg.fileSize)}</p>
        </div>
        <a href={msg.fileUrl} download={msg.fileName} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 7, background: isMe ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)', flexShrink: 0 }}>
          <Download size={11} color={isMe ? '#fff' : '#94a3b8'} />
        </a>
      </div>
    </div>
  )

  // text
  return (
    <div style={{ ...bubbleBase, padding: '8px 12px', fontSize: 12, lineHeight: 1.5 }}>
      {msg.text}
    </div>
  )
}

// ── Animation styles ─────────────────────────────────────────────────────────

const ANIM_STYLE = `
  @keyframes chatSlideUp {
    0%   { opacity: 0; transform: translateY(32px) scale(0.92); filter: blur(4px); }
    60%  { opacity: 1; filter: blur(0px); }
    80%  { transform: translateY(-4px) scale(1.01); }
    100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0px); }
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%       { opacity: 0.4; transform: scale(1.3); }
  }
`

// ── Main Panel ───────────────────────────────────────────────────────────────

export default function ChatPanel() {
  const {
    isOpen, closeChat,
    conversations, setConversations, activeConvoId, setActiveConvoId,
    sendMessage, createDirectChat, createGroup, markAsRead,
    chatUsers, meId, me,
  } = useChat()

  const ME = meId

  const [view, setView]               = useState('list')
  const [inputText, setInputText]     = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [dmSearch, setDmSearch]       = useState('')
  const [groupName, setGroupName]     = useState('')
  const [selectedMembers, setSelectedMembers] = useState([])
  const [visible, setVisible]         = useState(false)
  const [expanded, setExpanded]       = useState(false)
  const [accessSearch, setAccessSearch] = useState('')
  const [attachment, setAttachment]   = useState(null)   // { file, url, type }
  const [recording, setRecording]     = useState(false)
  const [recSeconds, setRecSeconds]   = useState(0)
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [selectMode, setSelectMode]         = useState(false)
  const [selectedMsgIds, setSelectedMsgIds] = useState([])

  const fileInputRef   = useRef(null)
  const mediaRecRef    = useRef(null)
  const recChunksRef   = useRef([])
  const recTimerRef    = useRef(null)
  const [accessUser, setAccessUser]     = useState(null)
  const [prevView, setPrevView]         = useState('list')

  const filteredDmUsers = chatUsers.filter(u =>
    u.name.toLowerCase().includes(dmSearch.toLowerCase()) ||
    u.role.toLowerCase().includes(dmSearch.toLowerCase())
  )

  const filteredAccessUsers = chatUsers.filter(u =>
    u.name.toLowerCase().includes(accessSearch.toLowerCase()) ||
    u.role.toLowerCase().includes(accessSearch.toLowerCase())
  )

  const accessUserConvos = accessUser
    ? conversations.filter(c => c.participants.includes(accessUser.id))
    : []

  const messagesEndRef = useRef(null)
  const inputRef       = useRef(null)

  const activeConvo = conversations.find(c => c.id === activeConvoId)

  function toggleSelectMsg(id) {
    setSelectedMsgIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function exitSelectMode() {
    setSelectMode(false)
    setSelectedMsgIds([])
  }

  async function handleDeleteSelectedMsgs() {
    if (!activeConvoId || !selectedMsgIds.length) return
    const ids = [...selectedMsgIds]
    exitSelectMode()
    try {
      await api.post(`/api/chat/conversations/${activeConvoId}/messages/delete`, { messageIds: ids })
      setConversations(prev => prev.map(c =>
        c.id !== activeConvoId ? c : { ...c, messages: c.messages.filter(m => !ids.includes(m.id)) }
      ))
    } catch {}
  }

  async function handleDeleteConversation() {
    if (!activeConvoId) return
    const convoId = activeConvoId
    setConversations(prev => prev.filter(c => c.id !== convoId))
    setActiveConvoId(null)
    setView('list')
    exitSelectMode()
    try {
      await api.delete(`/api/chat/conversations/${convoId}`)
    } catch {}
  }

  // Trigger enter animation
  useEffect(() => {
    if (isOpen) {
      setVisible(false)
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
    }
  }, [isOpen])

  useEffect(() => {
    if (view === 'chat') messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeConvo?.messages?.length, view])

  useEffect(() => {
    if (activeConvoId && view === 'chat') markAsRead(activeConvoId)
  }, [activeConvoId, view, markAsRead])

  useEffect(() => {
    if (view === 'chat') setTimeout(() => inputRef.current?.focus(), 80)
  }, [view, activeConvoId])

  if (!isOpen) return null

  function goBack() {
    if (view === 'chat' && prevView === 'access-detail') { setView('access-detail'); return }
    if (view === 'access-detail') { setView('access'); return }
    setView('list'); setDmSearch(''); setAccessSearch('')
  }
  function openConvo(id, from = 'list') {
    setPrevView(from)
    setActiveConvoId(id)
    setView('chat')
  }
  function openAccessUser(u) {
    setAccessUser(u)
    setView('access-detail')
  }

  function handleSend() {
    if (!inputText.trim() || !activeConvoId) return
    sendMessage(activeConvoId, inputText.trim())
    setInputText('')
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  function handleStartDirect(userId) { createDirectChat(userId); setView('chat') }

  function handleCreateGroup() {
    if (!groupName.trim() || !selectedMembers.length) return
    createGroup(groupName.trim(), selectedMembers)
    setGroupName(''); setSelectedMembers([]); setView('chat')
  }

  function toggleMember(id) {
    setSelectedMembers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    let type = 'file'
    if (file.type.startsWith('image/')) type = 'image'
    else if (file.type.startsWith('video/')) type = 'video'
    setAttachment({ file, url, type })
    setShowAttachMenu(false)
    e.target.value = ''
  }

  async function sendAttachment() {
    if (!attachment || !activeConvoId) return
    const file = attachment.file
    const type = attachment.type
    const text = inputText.trim()
    setAttachment(null)
    setInputText('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await upload('/api/chat/upload', fd)
      const { url, fileName, fileSize, fileMime } = res.data
      sendMessage(activeConvoId, { type, text, fileUrl: url, fileName, fileSize, fileMime })
    } catch {
      alert('File upload failed')
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      recChunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) recChunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob     = new Blob(recChunksRef.current, { type: 'audio/webm' })
        const duration = recSeconds
        setRecording(false)
        setRecSeconds(0)
        try {
          const fd = new FormData()
          fd.append('file', blob, `voice-${Date.now()}.webm`)
          const res = await upload('/api/chat/upload', fd)
          const { url, fileName, fileSize, fileMime } = res.data
          sendMessage(activeConvoId, { type: 'audio', text: '', fileUrl: url, fileName, fileSize, fileMime, duration })
        } catch {
          alert('Voice upload failed')
        }
      }
      mr.start()
      mediaRecRef.current = mr
      setRecording(true)
      setRecSeconds(0)
      recTimerRef.current = setInterval(() => setRecSeconds(s => s + 1), 1000)
    } catch {
      alert('Microphone access denied')
    }
  }

  function stopRecording() {
    clearInterval(recTimerRef.current)
    mediaRecRef.current?.stop()
  }

  function cancelRecording() {
    clearInterval(recTimerRef.current)
    if (mediaRecRef.current && mediaRecRef.current.state !== 'inactive') {
      mediaRecRef.current.ondataavailable = null
      mediaRecRef.current.onstop = null
      mediaRecRef.current.stop()
      mediaRecRef.current.stream?.getTracks().forEach(t => t.stop())
    }
    setRecording(false)
    setRecSeconds(0)
  }

  const filtered = conversations.filter(c =>
    getConvoMeta(c, chatUsers, ME).name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const showBack = view !== 'list'

  return (
    <>
      <style>{ANIM_STYLE}</style>
      <div
        style={{
          position: 'fixed', zIndex: 9998,
          display: 'flex', flexDirection: 'column',
          background: expanded ? 'rgba(8, 12, 22, 0.96)' : 'rgba(8, 12, 22, 0.68)',
          backdropFilter: 'blur(36px)',
          WebkitBackdropFilter: 'blur(36px)',
          border: '1px solid rgba(255,255,255,0.11)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)',
          animation: visible ? 'chatSlideUp 0.35s cubic-bezier(0.22,1.4,0.36,1) forwards' : 'none',
          opacity: visible ? 1 : 0,
          overflow: 'hidden',
          transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
          ...(expanded
            ? { top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', borderRadius: 0 }
            : { bottom: 72, right: 16, width: 300, height: 440, borderRadius: 18, transformOrigin: 'bottom right' }
          ),
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: expanded ? '12px 24px' : '10px 12px',
            background: 'rgba(255,255,255,0.03)',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            flexShrink: 0,
            maxWidth: expanded ? 900 : '100%',
            width: '100%',
            alignSelf: 'center',
            boxSizing: 'border-box',
          }}
        >
          {/* Back button */}
          {showBack && (
            <button
              onClick={goBack}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#94a3b8', cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.2)'; e.currentTarget.style.color = '#93c5fd' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#94a3b8' }}
            >
              <ArrowLeft size={14} />
            </button>
          )}

          {/* Title / active convo info */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            {view === 'list' && (
              <>
                <MessageSquare size={13} color="#60a5fa" />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>Messages</span>
              </>
            )}
            {view === 'chat' && activeConvo && (() => {
              const m = getConvoMeta(activeConvo, chatUsers, ME)
              return (
                <>
                  <UserAvatar initials={m.initials} color={m.color} size={28} online={m.online} />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.name}
                    </p>
                    <p style={{ fontSize: 10, margin: 0, color: m.online ? '#34d399' : '#475569' }}>
                      {activeConvo.type === 'group'
                        ? `${activeConvo.participants.length} members`
                        : m.online ? 'Online' : 'Offline'}
                    </p>
                  </div>
                </>
              )
            })()}
            {view === 'new-dm' && <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>New Message</span>}
            {view === 'new-group' && <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>New Group</span>}
            {view === 'access' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <ShieldCheck size={13} color="#a78bfa" />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>Admin Access</span>
              </div>
            )}
            {view === 'access-detail' && accessUser && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <UserAvatar initials={accessUser.avatar} color={accessUser.color} size={26} online={accessUser.online} />
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>{accessUser.name}</p>
                  <p style={{ fontSize: 9, color: '#a78bfa', margin: 0 }}>Admin viewing</p>
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {view === 'chat' && !selectMode && (
              <button onClick={() => setSelectMode(true)} title="Select & Delete"
                style={{ width: 26, height: 26, borderRadius: 7, border: 'none', background: 'rgba(255,255,255,0.06)', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; e.currentTarget.style.color = '#f87171' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#64748b' }}>
                <Trash2 size={12} />
              </button>
            )}
            {view === 'chat' && selectMode && (
              <>
                <button onClick={handleDeleteSelectedMsgs} disabled={!selectedMsgIds.length} title={selectedMsgIds.length ? `Delete ${selectedMsgIds.length} messages` : 'Select messages first'}
                  style={{ width: 26, height: 26, borderRadius: 7, border: 'none', background: selectedMsgIds.length ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.04)', color: selectedMsgIds.length ? '#f87171' : '#334155', cursor: selectedMsgIds.length ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', position: 'relative' }}>
                  <Trash2 size={12} />
                  {selectedMsgIds.length > 0 && (
                    <span style={{ position: 'absolute', top: -4, right: -4, background: '#ef4444', color: '#fff', borderRadius: '50%', width: 13, height: 13, fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {selectedMsgIds.length}
                    </span>
                  )}
                </button>
                <button onClick={handleDeleteConversation} title="Delete entire conversation"
                  style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.12)', color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.25)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.12)' }}>
                  <X size={11} />
                </button>
                <button onClick={exitSelectMode} title="Cancel selection"
                  style={{ width: 26, height: 26, borderRadius: 7, border: 'none', background: 'rgba(255,255,255,0.06)', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Check size={12} />
                </button>
              </>
            )}
            {view === 'list' && (
              <>
                <button onClick={() => setView('new-dm')} title="New Message"
                  style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.06)', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#94a3b8' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#64748b' }}>
                  <Plus size={13} />
                </button>
                <button onClick={() => setView('new-group')} title="New Group"
                  style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.06)', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#94a3b8' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#64748b' }}>
                  <Users size={13} />
                </button>
                {me?.role === 'admin' && (
                  <button onClick={() => setView('access')} title="Admin Access"
                    style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(167,139,250,0.25)', background: 'rgba(167,139,250,0.1)', color: '#a78bfa', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(167,139,250,0.2)'; e.currentTarget.style.borderColor = 'rgba(167,139,250,0.5)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(167,139,250,0.1)'; e.currentTarget.style.borderColor = 'rgba(167,139,250,0.25)' }}>
                    <ShieldCheck size={12} />
                  </button>
                )}
              </>
            )}
            <button
              onClick={() => setExpanded(v => !v)}
              title={expanded ? 'Minimize' : 'Expand'}
              style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.06)', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.15)'; e.currentTarget.style.color = '#60a5fa' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#64748b' }}
            >
              {expanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
            </button>
            <button
              onClick={closeChat}
              style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.06)', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; e.currentTarget.style.color = '#f87171' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#64748b' }}
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{
          flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0,
          maxWidth: expanded ? 900 : '100%',
          width: '100%',
          alignSelf: 'center',
        }}>

          {/* CONVERSATION LIST */}
          {view === 'list' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ padding: '8px 12px', flexShrink: 0 }}>
                <div style={{ position: 'relative' }}>
                  <Search size={11} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
                  <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search..."
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '7px 10px 7px 28px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      borderRadius: 10, color: '#cbd5e1', fontSize: 11,
                      outline: 'none',
                    }}
                  />
                </div>
              </div>
              {/* New message button */}
              <div style={{ padding: '6px 10px 4px', flexShrink: 0 }}>
                <button
                  onClick={() => setView('new-dm')}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    padding: '8px 12px', borderRadius: 11, border: 'none', cursor: 'pointer',
                    background: 'linear-gradient(135deg, rgba(37,99,235,0.25), rgba(59,130,246,0.18))',
                    border: '1px solid rgba(59,130,246,0.3)',
                    color: '#93c5fd', fontSize: 12, fontWeight: 600,
                    transition: 'all 0.18s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg,rgba(37,99,235,0.4),rgba(59,130,246,0.3))'; e.currentTarget.style.borderColor = 'rgba(59,130,246,0.55)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg,rgba(37,99,235,0.25),rgba(59,130,246,0.18))'; e.currentTarget.style.borderColor = 'rgba(59,130,246,0.3)' }}
                >
                  <Plus size={13} />
                  New Message
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto' }}>
                {filtered.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8 }}>
                    <MessageSquare size={24} color="#1e293b" />
                    <p style={{ color: '#334155', fontSize: 12, margin: 0 }}>No conversations</p>
                  </div>
                ) : filtered.map(convo => {
                  const m = getConvoMeta(convo, chatUsers, ME)
                  const lm = getLastMsg(convo, ME)
                  const isActive = convo.id === activeConvoId
                  return (
                    <button
                      key={convo.id}
                      onClick={() => openConvo(convo.id)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 12px', cursor: 'pointer', textAlign: 'left',
                        background: isActive ? 'rgba(59,130,246,0.1)' : 'transparent',
                        border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                    >
                      <UserAvatar initials={m.initials} color={m.color} size={36} online={m.online} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: '#f1f5f9', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</p>
                          <span style={{ fontSize: 9, color: '#475569', flexShrink: 0, marginLeft: 8 }}>{lm.time}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <p style={{ fontSize: 10, color: '#475569', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lm.text}</p>
                          {convo.unread > 0 && (
                            <span style={{ flexShrink: 0, marginLeft: 8, minWidth: 16, height: 16, borderRadius: 8, background: '#2563eb', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
                              {convo.unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* CHAT VIEW */}
          {view === 'chat' && activeConvo && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {activeConvo.messages.length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    <p style={{ color: '#1e293b', fontSize: 12 }}>Start the conversation</p>
                  </div>
                ) : activeConvo.messages.map(msg => {
                  const isMe       = msg.senderId === ME
                  const sender     = chatUsers.find(u => u.id === msg.senderId)
                  const isSelected = selectedMsgIds.includes(msg.id)
                  return (
                    <div key={msg.id}
                      onClick={selectMode ? () => toggleSelectMsg(msg.id) : undefined}
                      style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', gap: 6, cursor: selectMode ? 'pointer' : 'default', borderRadius: 8, padding: selectMode ? '2px 4px' : 0, background: isSelected ? 'rgba(239,68,68,0.10)' : 'transparent', transition: 'background 0.15s' }}>
                      {selectMode && (
                        <div style={{ display: 'flex', alignItems: 'center', order: isMe ? 1 : -1, flexShrink: 0 }}>
                          <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${isSelected ? '#ef4444' : '#334155'}`, background: isSelected ? '#ef4444' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                            {isSelected && <Check size={10} color="#fff" />}
                          </div>
                        </div>
                      )}
                      {!isMe && sender && <UserAvatar initials={sender.avatar} color={sender.color} size={24} />}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', maxWidth: expanded ? '60%' : '78%' }}>
                        {!isMe && activeConvo.type === 'group' && sender && (
                          <p style={{ fontSize: 9, color: '#475569', margin: '0 0 2px 4px' }}>{sender.name}</p>
                        )}
                        <MessageBubble msg={msg} isMe={isMe} expanded={expanded} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 2, padding: '0 2px', flexDirection: isMe ? 'row-reverse' : 'row' }}>
                          <span style={{ fontSize: 9, color: '#334155' }}>{msg.time}</span>
                          {isMe && (msg.read ? <CheckCheck size={9} color="#60a5fa" /> : <Check size={9} color="#334155" />)}
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>

              <div style={{ padding: '8px 12px 12px', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
                {/* Attachment preview */}
                {attachment && (
                  <div style={{ marginBottom: 8, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {attachment.type === 'image' && <img src={attachment.url} style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover' }} />}
                    {attachment.type === 'video' && <div style={{ width: 40, height: 40, borderRadius: 6, background: 'rgba(167,139,250,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Film size={16} color="#a78bfa" /></div>}
                    {attachment.type === 'file'  && <div style={{ width: 40, height: 40, borderRadius: 6, background: 'rgba(96,165,250,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{fileIcon(attachment.file.type)}</div>}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: '#e2e8f0', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachment.file.name}</p>
                      <p style={{ fontSize: 9, color: '#475569', margin: '2px 0 0' }}>{fmtSize(attachment.file.size)}</p>
                    </div>
                    <button onClick={() => setAttachment(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 2 }}><XCircle size={14} /></button>
                  </div>
                )}

                {/* Recording indicator */}
                {recording && (
                  <div style={{ marginBottom: 8, padding: '8px 12px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', animation: 'pulse 1s infinite' }} />
                    <span style={{ fontSize: 12, color: '#fca5a5', fontWeight: 600, flex: 1 }}>Recording… {fmtDuration(recSeconds)}</span>
                    <button onClick={cancelRecording} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', fontSize: 11 }}>Cancel</button>
                    <button onClick={stopRecording} style={{ padding: '4px 10px', borderRadius: 7, border: 'none', background: '#ef4444', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Send</button>
                  </div>
                )}

                {/* Attach menu */}
                {showAttachMenu && (
                  <div style={{ marginBottom: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {[
                      { label: 'Image / Video', accept: 'image/*,video/*', icon: <ImageIcon size={13} />, color: '#60a5fa' },
                      { label: 'Document',      accept: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt', icon: <FileText size={13} />, color: '#f87171' },
                      { label: 'Any File',      accept: '*',               icon: <Paperclip size={13} />, color: '#94a3b8' },
                    ].map(opt => (
                      <button key={opt.label} onClick={() => { fileInputRef.current.accept = opt.accept; fileInputRef.current.click() }}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, border: `1px solid ${opt.color}30`, background: `${opt.color}12`, color: opt.color, fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>
                        {opt.icon}{opt.label}
                      </button>
                    ))}
                  </div>
                )}

                <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileSelect} />

                {/* Input row */}
                {!recording && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      onClick={() => setShowAttachMenu(v => !v)}
                      style={{ width: 32, height: 32, borderRadius: 10, border: 'none', flexShrink: 0, background: showAttachMenu ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.06)', color: showAttachMenu ? '#60a5fa' : '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                    >
                      <Paperclip size={13} />
                    </button>
                    <input
                      ref={inputRef}
                      value={inputText}
                      onChange={e => setInputText(e.target.value)}
                      onKeyDown={handleKey}
                      placeholder={attachment ? 'Add a caption...' : 'Type a message...'}
                      style={{ flex: 1, padding: '8px 11px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 11, color: '#e2e8f0', fontSize: 12, outline: 'none' }}
                      onFocus={e => { e.target.style.borderColor = 'rgba(59,130,246,0.5)' }}
                      onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.09)' }}
                    />
                    {(inputText.trim() || attachment) ? (
                      <button
                        onClick={attachment ? sendAttachment : handleSend}
                        style={{ width: 32, height: 32, borderRadius: 10, border: 'none', flexShrink: 0, background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(37,99,235,0.35)', transition: 'all 0.2s' }}
                      >
                        <Send size={12} />
                      </button>
                    ) : (
                      <button
                        onClick={startRecording}
                        style={{ width: 32, height: 32, borderRadius: 10, border: 'none', flexShrink: 0, background: 'rgba(52,211,153,0.15)', color: '#34d399', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(52,211,153,0.25)', transition: 'all 0.15s' }}
                        title="Record voice note"
                      >
                        <Mic size={13} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* NEW DIRECT MESSAGE */}
          {view === 'new-dm' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* Search */}
              <div style={{ padding: '8px 10px 4px', flexShrink: 0 }}>
                <div style={{ position: 'relative' }}>
                  <Search size={11} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
                  <input
                    placeholder="Search agents or users..."
                    value={dmSearch}
                    onChange={e => setDmSearch(e.target.value)}
                    autoFocus
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '7px 10px 7px 26px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 10, color: '#cbd5e1', fontSize: 11, outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Online first */}
              {filteredDmUsers.some(u => u.online) && (
                <p style={{ fontSize: 9, color: '#22c55e', padding: '6px 12px 2px', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0, flexShrink: 0 }}>
                  🟢 Online
                </p>
              )}

              <div style={{ flex: 1, overflowY: 'auto' }}>
                {filteredDmUsers.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80%', gap: 6 }}>
                    <Search size={20} color="#1e293b" />
                    <p style={{ color: '#334155', fontSize: 11, margin: 0 }}>No users found</p>
                  </div>
                ) : (
                  <>
                    {/* Online users */}
                    {filteredDmUsers.filter(u => u.online).map(u => (
                      <UserRow key={u.id} u={u} onClick={() => handleStartDirect(u.id)} />
                    ))}
                    {/* Offline separator */}
                    {filteredDmUsers.some(u => !u.online) && filteredDmUsers.some(u => u.online) && (
                      <p style={{ fontSize: 9, color: '#334155', padding: '6px 12px 2px', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                        Offline
                      </p>
                    )}
                    {filteredDmUsers.filter(u => !u.online).map(u => (
                      <UserRow key={u.id} u={u} onClick={() => handleStartDirect(u.id)} />
                    ))}
                  </>
                )}
              </div>
            </div>
          )}

          {/* NEW GROUP */}
          {view === 'new-group' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
                <input
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  placeholder="Group name..."
                  autoFocus
                  style={{
                    width: '100%', boxSizing: 'border-box', padding: '8px 12px',
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)',
                    borderRadius: 11, color: '#e2e8f0', fontSize: 12, outline: 'none',
                  }}
                  onFocus={e => { e.target.style.borderColor = 'rgba(59,130,246,0.5)' }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.09)' }}
                />
              </div>
              <p style={{ fontSize: 10, color: '#334155', padding: '8px 12px 4px', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0, flexShrink: 0 }}>Add Members</p>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {chatUsers.map(u => {
                  const sel = selectedMembers.includes(u.id)
                  return (
                    <button
                      key={u.id}
                      onClick={() => toggleMember(u.id)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', cursor: 'pointer', textAlign: 'left', background: sel ? 'rgba(59,130,246,0.08)' : 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}
                    >
                      <UserAvatar initials={u.avatar} color={u.color} size={34} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#f1f5f9', margin: 0 }}>{u.name}</p>
                        <p style={{ fontSize: 10, color: '#475569', margin: 0, textTransform: 'capitalize' }}>{u.role.replace(/_/g, ' ')}</p>
                      </div>
                      <div style={{
                        width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                        background: sel ? '#2563eb' : 'transparent',
                        border: `2px solid ${sel ? '#2563eb' : '#334155'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s',
                      }}>
                        {sel && <Check size={9} color="#fff" />}
                      </div>
                    </button>
                  )
                })}
              </div>
              <div style={{ padding: '8px 12px 12px', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
                <button
                  onClick={handleCreateGroup}
                  disabled={!groupName.trim() || !selectedMembers.length}
                  style={{
                    width: '100%', padding: '9px', borderRadius: 11, border: 'none',
                    background: groupName.trim() && selectedMembers.length ? 'linear-gradient(135deg,#1d4ed8,#2563eb)' : 'rgba(255,255,255,0.06)',
                    color: groupName.trim() && selectedMembers.length ? '#fff' : '#334155',
                    fontSize: 12, fontWeight: 600, cursor: groupName.trim() && selectedMembers.length ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s',
                  }}
                >
                  {selectedMembers.length > 0 ? `Create Group · ${selectedMembers.length} members` : 'Select members to create group'}
                </button>
              </div>
            </div>
          )}
          {/* ── ADMIN ACCESS: USER LIST ── */}
          {view === 'access' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* Header banner */}
              <div style={{ margin: '8px 10px 4px', padding: '8px 10px', borderRadius: 10, background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <Eye size={11} color="#a78bfa" />
                <p style={{ fontSize: 10, color: '#a78bfa', margin: 0, fontWeight: 500 }}>Admin mode · select a user to view their chats</p>
              </div>
              {/* Search */}
              <div style={{ padding: '4px 10px 6px', flexShrink: 0 }}>
                <div style={{ position: 'relative' }}>
                  <Search size={11} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
                  <input
                    placeholder="Search users..."
                    value={accessSearch}
                    onChange={e => setAccessSearch(e.target.value)}
                    autoFocus
                    style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px 7px 26px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#cbd5e1', fontSize: 11, outline: 'none' }}
                  />
                </div>
              </div>
              {/* Users */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {filteredAccessUsers.map(u => {
                  const userConvos = conversations.filter(c => c.participants.includes(u.id))
                  const dms    = userConvos.filter(c => c.type === 'direct').length
                  const groups = userConvos.filter(c => c.type === 'group').length
                  return (
                    <button
                      key={u.id}
                      onClick={() => openAccessUser(u)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', cursor: 'pointer', textAlign: 'left', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(167,139,250,0.06)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                    >
                      <UserAvatar initials={u.avatar} color={u.color} size={34} online={u.online} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#f1f5f9', margin: 0 }}>{u.name}</p>
                        <p style={{ fontSize: 10, color: ROLE_COLORS[u.role] ?? '#475569', margin: '1px 0 0', textTransform: 'capitalize' }}>{u.role.replace(/_/g, ' ')}</p>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                        <span style={{ fontSize: 9, color: '#475569' }}>{dms} DMs · {groups} groups</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 6, background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)' }}>
                          <Eye size={8} color="#a78bfa" />
                          <span style={{ fontSize: 9, color: '#a78bfa', fontWeight: 600 }}>View</span>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── ADMIN ACCESS: USER DETAIL ── */}
          {view === 'access-detail' && accessUser && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* Stats bar */}
              <div style={{ display: 'flex', gap: 6, padding: '8px 10px 6px', flexShrink: 0 }}>
                {[
                  { label: 'DMs',    value: accessUserConvos.filter(c => c.type === 'direct').length, color: '#60a5fa' },
                  { label: 'Groups', value: accessUserConvos.filter(c => c.type === 'group').length,  color: '#34d399' },
                  { label: 'Messages', value: accessUserConvos.reduce((a, c) => a + c.messages.length, 0), color: '#a78bfa' },
                ].map(s => (
                  <div key={s.label} style={{ flex: 1, padding: '6px 8px', borderRadius: 9, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', textAlign: 'center' }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: s.color, margin: 0 }}>{s.value}</p>
                    <p style={{ fontSize: 9, color: '#475569', margin: 0 }}>{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Conversations */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {accessUserConvos.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', gap: 6 }}>
                    <MessageSquare size={22} color="#1e293b" />
                    <p style={{ color: '#334155', fontSize: 11, margin: 0 }}>No conversations found</p>
                  </div>
                ) : (
                  <>
                    {/* DMs section */}
                    {accessUserConvos.filter(c => c.type === 'direct').length > 0 && (
                      <p style={{ fontSize: 9, color: '#334155', padding: '6px 12px 2px', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Direct Messages</p>
                    )}
                    {accessUserConvos.filter(c => c.type === 'direct').map(convo => {
                      const otherId = convo.participants.find(id => id !== accessUser.id)
                      const other   = otherId === ME ? { name: 'You (Admin)', avatar: 'AD', color: '#3b82f6', online: true } : chatUsers.find(u => u.id === otherId)
                      const lm = convo.messages[convo.messages.length - 1]
                      return (
                        <button
                          key={convo.id}
                          onClick={() => openConvo(convo.id, 'access-detail')}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', cursor: 'pointer', textAlign: 'left', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                        >
                          <UserAvatar initials={other?.avatar ?? '??'} color={other?.color ?? '#3b82f6'} size={30} online={other?.online} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 11, fontWeight: 600, color: '#e2e8f0', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {accessUser.name} ↔ {other?.name ?? 'Unknown'}
                            </p>
                            <p style={{ fontSize: 10, color: '#475569', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {lm ? lm.text : 'No messages'}
                            </p>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 6px', borderRadius: 5, background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', flexShrink: 0 }}>
                            <Eye size={8} color="#60a5fa" />
                            <span style={{ fontSize: 9, color: '#60a5fa' }}>{convo.messages.length}</span>
                          </div>
                        </button>
                      )
                    })}

                    {/* Groups section */}
                    {accessUserConvos.filter(c => c.type === 'group').length > 0 && (
                      <p style={{ fontSize: 9, color: '#334155', padding: '6px 12px 2px', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Groups</p>
                    )}
                    {accessUserConvos.filter(c => c.type === 'group').map(convo => {
                      const lm = convo.messages[convo.messages.length - 1]
                      const sender = lm ? (lm.senderId === ME ? 'You' : chatUsers.find(u => u.id === lm.senderId)?.name ?? 'Unknown') : null
                      return (
                        <button
                          key={convo.id}
                          onClick={() => openConvo(convo.id, 'access-detail')}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', cursor: 'pointer', textAlign: 'left', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                        >
                          <div style={{ width: 30, height: 30, borderRadius: 9, background: `${convo.color}22`, border: `1px solid ${convo.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: convo.color, flexShrink: 0 }}>
                            {convo.avatar}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <p style={{ fontSize: 11, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>{convo.name}</p>
                              <span style={{ fontSize: 9, color: '#334155' }}>{convo.participants.length} members</span>
                            </div>
                            <p style={{ fontSize: 10, color: '#475569', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {lm ? `${sender}: ${lm.text}` : 'No messages'}
                            </p>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 6px', borderRadius: 5, background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', flexShrink: 0 }}>
                            <Eye size={8} color="#34d399" />
                            <span style={{ fontSize: 9, color: '#34d399' }}>{convo.messages.length}</span>
                          </div>
                        </button>
                      )
                    })}
                  </>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  )
}
