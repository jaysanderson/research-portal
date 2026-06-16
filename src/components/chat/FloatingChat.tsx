import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageSquare, X } from 'lucide-react';
import { useChat } from '../../lib/useChat';
import { ChatThread } from './ChatThread';

export function FloatingChat() {
  const [open, setOpen] = useState(false);
  const { messages, busy, send, stop } = useChat();
  const loc = useLocation();

  // Don't double up on the full assistant page.
  if (loc.pathname.startsWith('/assistant')) return null;

  return (
    <>
      {open && (
        <div className="fixed bottom-20 right-4 z-40 flex h-[32rem] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-2xl animate-fade-in">
          <div className="flex items-center justify-between border-b border-ink-200 bg-brand-600 px-4 py-3 text-white">
            <span className="text-sm font-semibold">Ask the Knowledge Box</span>
            <button onClick={() => setOpen(false)}><X size={18} /></button>
          </div>
          <div className="flex-1 overflow-hidden">
            <ChatThread messages={messages} busy={busy} onSend={send} onStop={stop} compact placeholder="Ask a question…" />
          </div>
        </div>
      )}
      <button onClick={() => setOpen((o) => !o)}
        className="fixed bottom-4 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg transition-transform hover:scale-105">
        {open ? <X size={22} /> : <MessageSquare size={22} />}
      </button>
    </>
  );
}
