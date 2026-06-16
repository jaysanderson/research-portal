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
  return (
    <div className="mx-auto flex h-[calc(100vh-3.5rem)] max-w-4xl flex-col px-5 py-6 md:px-8">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink-900">AI Assistant</h1>
          <p className="text-sm text-ink-500">Streaming, cited answers grounded in your Knowledge Box.</p>
        </div>
        {messages.length > 0 && <button onClick={reset} className="btn-ghost text-sm"><RotateCcw size={15} /> New chat</button>}
      </div>
      <div className="card flex-1 overflow-hidden">
        <ChatThread messages={messages} busy={busy} onSend={send} onStop={stop} examples={EXAMPLES}
          placeholder="Ask about the CMS/DXP market…" />
      </div>
    </div>
  );
}
