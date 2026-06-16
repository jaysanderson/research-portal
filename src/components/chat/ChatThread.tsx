import { useEffect, useRef, useState } from 'react';
import { Send, Square, Sparkles, User } from 'lucide-react';
import { renderMarkdown } from '../../lib/markdown';
import type { ChatMessage } from '../../lib/useChat';

export function ChatThread({ messages, busy, onSend, onStop, placeholder, compact, examples }: {
  messages: ChatMessage[];
  busy: boolean;
  onSend: (t: string) => void;
  onStop: () => void;
  placeholder?: string;
  compact?: boolean;
  examples?: string[];
}) {
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const submit = (e: React.FormEvent) => { e.preventDefault(); if (input.trim()) { onSend(input); setInput(''); } };

  return (
    <div className="flex h-full flex-col">
      <div className={`flex-1 space-y-4 overflow-y-auto ${compact ? 'p-3' : 'p-4'}`}>
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center text-ink-400">
            <Sparkles size={compact ? 22 : 28} className="text-brand-300" />
            <p className={`mt-2 ${compact ? 'text-sm' : ''}`}>Ask anything about the knowledge base.</p>
            {examples && (
              <div className="mt-4 flex flex-col gap-2">
                {examples.map((ex) => (
                  <button key={ex} onClick={() => onSend(ex)}
                    className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-left text-sm text-ink-600 hover:border-brand-300 hover:text-brand-700">{ex}</button>
                ))}
              </div>
            )}
          </div>
        )}
        {messages.map((m, i) => <Bubble key={i} m={m} compact={compact} />)}
        <div ref={endRef} />
      </div>
      <form onSubmit={submit} className="border-t border-ink-200 p-3">
        <div className="flex items-end gap-2">
          <textarea value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(e); } }}
            rows={compact ? 1 : 2} placeholder={placeholder || 'Ask a question…'}
            className="flex-1 resize-none rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-400" />
          {busy ? (
            <button type="button" onClick={onStop} className="btn bg-ink-800 text-white"><Square size={15} /></button>
          ) : (
            <button type="submit" className="btn-primary"><Send size={15} /></button>
          )}
        </div>
      </form>
    </div>
  );
}

function Bubble({ m, compact }: { m: ChatMessage; compact?: boolean }) {
  const isUser = m.role === 'user';
  return (
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${isUser ? 'bg-ink-200 text-ink-600' : 'bg-brand-600 text-white'}`}>
        {isUser ? <User size={14} /> : <Sparkles size={14} />}
      </div>
      <div className={`min-w-0 max-w-[85%] rounded-2xl px-3.5 py-2.5 ${isUser ? 'bg-ink-900 text-white' : m.error ? 'bg-rose-50 text-rose-700' : 'bg-white border border-ink-200'}`}>
        {isUser ? (
          <p className={`whitespace-pre-wrap ${compact ? 'text-sm' : ''}`}>{m.content}</p>
        ) : (
          <>
            <div className="prose-answer" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }} />
            {m.streaming && !m.content && <div className="flex gap-1 py-1"><Dot /><Dot d={150} /><Dot d={300} /></div>}
            {m.citations && m.citations.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5 border-t border-ink-100 pt-2">
                {m.citations.map((c, i) => <span key={i} className="chip text-[11px]">{i + 1}. {c.title}</span>)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Dot({ d = 0 }: { d?: number }) {
  return <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-300" style={{ animationDelay: `${d}ms` }} />;
}
