import { useChat } from '../lib/useChat';
import { ChatThread } from '../components/chat/ChatThread';
import { Logo } from '../components/Logo';

// Bare, embeddable chat widget (no app chrome). Drop into an <iframe> on any site.
export default function EmbedPage() {
  const { messages, busy, send, stop } = useChat();
  return (
    <div className="flex h-screen flex-col bg-white">
      <div className="flex items-center justify-between border-b border-ink-200 px-4 py-2.5">
        <Logo />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-400">Ask AI</span>
      </div>
      <div className="flex-1 overflow-hidden">
        <ChatThread messages={messages} busy={busy} onSend={send} onStop={stop} compact placeholder="Ask about the CMS/DXP knowledge base…"
          examples={['What is a composable DXP?', 'Compare Sitefinity and Sitecore']} />
      </div>
    </div>
  );
}
