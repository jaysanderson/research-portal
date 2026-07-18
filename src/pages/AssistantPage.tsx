import { useEffect } from 'react';
import { useChat } from '../lib/useChat';
import { ChatThread } from '../components/chat/ChatThread';
import { useKbProfile } from '../lib/hooks';
import { ModelPicker } from '../components/ModelPicker';
import { RotateCcw } from 'lucide-react';

const FALLBACK_EXAMPLES = [
  'Summarize the main themes in this knowledge base.',
  'What are the most important findings here?',
  'Compare the leading approaches discussed.',
];

export default function AssistantPage() {
  const { messages, busy, send, stop, reset } = useChat();
  const { profile } = useKbProfile();
  const examples = profile?.exampleQuestions?.length ? profile.exampleQuestions : FALLBACK_EXAMPLES;
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
        <div className="flex items-center gap-2">
          <ModelPicker />
          {messages.length > 0 && <button onClick={reset} className="btn-outline btn-sm"><RotateCcw size={14} /> New chat</button>}
        </div>
      </div>
      <div className="card flex-1 overflow-hidden">
        <ChatThread messages={messages} busy={busy} onSend={send} onStop={stop} examples={examples}
          placeholder={profile?.subject ? `Ask about ${profile.subject}…` : 'Ask about the knowledge base…'} />
      </div>
    </div>
  );
}
