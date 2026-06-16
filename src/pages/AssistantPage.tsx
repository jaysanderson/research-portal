import { useEffect } from 'react';
import { useChat } from '../lib/useChat';
import { ChatThread } from '../components/chat/ChatThread';
import { RotateCcw } from 'lucide-react';

const EXAMPLES = [
  'Which CMS/DXP vendors lead in composable architecture?',
  'How does Progress Sitefinity compare to Sitecore for .NET teams?',
  'What do analysts say about headless CMS adoption?',
  'Compare pricing models across the top DXP vendors.',
];

export default function AssistantPage() {
  const { messages, busy, send, stop, reset } = useChat();
  // Pick up a query handed off from the command palette.
  useEffect(() => {
    const q = sessionStorage.getItem('rp_prefill');
    if (q) { sessionStorage.removeItem('rp_prefill'); send(q); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="mx-auto flex h-[calc(100vh-3.5rem)] max-w-3xl flex-col px-5 py-6 md:px-8">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h1 className="t-display">Assistant</h1>
          <p className="mt-1 t-muted">Streaming, cited answers grounded in your Knowledge Box.</p>
        </div>
        {messages.length > 0 && <button onClick={reset} className="btn-outline btn-sm"><RotateCcw size={14} /> New chat</button>}
      </div>
      <div className="card flex-1 overflow-hidden">
        <ChatThread messages={messages} busy={busy} onSend={send} onStop={stop} examples={EXAMPLES}
          placeholder="Ask about the CMS/DXP market…" />
      </div>
    </div>
  );
}
