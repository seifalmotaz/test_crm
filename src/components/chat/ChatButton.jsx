import { MessageSquare, X } from 'lucide-react'
import { useChat } from '../../context/ChatContext'
import ChatPanel from './ChatPanel'

export default function ChatButton() {
  const { isOpen, openChat, closeChat, totalUnread } = useChat()

  return (
    <>
      <ChatPanel />
      <button
        onClick={() => isOpen ? closeChat() : openChat()}
        className="fixed bottom-4 right-4 w-12 h-12 rounded-2xl flex items-center justify-center transition-all hover:scale-105 active:scale-95"
      style={{ zIndex: 9999 }}
        style={{
          background: isOpen
            ? 'linear-gradient(135deg, #1e3a5f, #1d4ed8)'
            : 'linear-gradient(135deg, #2563eb, #3b82f6)',
          boxShadow: '0 8px 24px rgba(37,99,235,0.45), 0 0 0 1px rgba(255,255,255,0.08)',
        }}
        title="Team Chat"
      >
        {isOpen
          ? <X size={18} className="text-white" />
          : <MessageSquare size={18} className="text-white" />
        }
        {!isOpen && totalUnread > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full text-[9px] font-bold text-white flex items-center justify-center px-1"
            style={{ background: '#ef4444', border: '2px solid #0b1120' }}
          >
            {totalUnread > 9 ? '9+' : totalUnread}
          </span>
        )}
      </button>
    </>
  )
}
