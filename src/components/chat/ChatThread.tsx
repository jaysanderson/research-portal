import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
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
      <div className={`flex-1 space-y-4 overflow-y-auto ${compact ? 'p-3' : 'p-5'}`}>
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-4 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Sparkles size={compact ? 18 : 22} strokeWidth={1.75} /></div>
            <p className={`mt-3 font-medium text-ink-700 ${compact ? 'text-sm' : ''}`}>Ask anything about the knowledge base</p>
            <p className="mt-1 t-muted">Answers are grounded in your indexed content, with sources.</p>
            {examples && (
              <div className="mt-4 flex w-full max-w-sm flex-col gap-2">
                {examples.map((ex) => (
                  <button key={ex} onClick={() => onSend(ex)}
                    className="rounded-md border border-ink-200 bg-white px-3 py-2 text-left text-sm text-ink-700 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800 focus-visible:outline-none">{ex}</button>
                ))}
              </div>
            )}
          </div>
        ) : (
          messages.map((m, i) => <Bubble key={i} m={m} compact={compact} />)
        )}
        <div ref={endRef} />
      </div>
      <form onSubmit={submit} className="border-t border-ink-200 p-3">
        <div className="flex items-end gap-2">
          <label className="sr-only" htmlFor="chat-input">Message</label>
          <textarea id="chat-input" value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(e); } }}
            rows={compact ? 1 : 2} placeholder={placeholder || 'Ask a question…'} className="input flex-1 resize-none" />
          {busy ? (
            <button type="button" onClick={onStop} className="btn-secondary" aria-label="Stop generating"><Square size={15} /></button>
          ) : (
            <button type="submit" className="btn-primary" aria-label="Send message"><Send size={15} /></button>
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
      <div className={`min-w-0 max-w-[85%] rounded-xl px-3.5 py-2.5 ${isUser ? 'bg-ink-900 text-white' : m.error ? 'border border-accent-200 bg-accent-50 text-accent-700' : 'border border-ink-200 bg-white'}`}>
        {isUser ? (
          <p className={`whitespace-pre-wrap ${compact ? 'text-sm' : ''}`}>{m.content}</p>
        ) : (
          <>
            <div className="prose-answer" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }} />
            {m.streaming && !m.content && <div className="flex gap-1 py-1"><Dot /><Dot d={150} /><Dot d={300} /></div>}
            {m.citations && m.citations.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5 border-t border-ink-100 pt-2">
                {m.citations.map((c, i) => c.resourceId
                  ? <Link key={i} to={`/knowledge/${c.resourceId}`} className="chip-link text-[11px]">{i + 1}. {c.title}</Link>
                  : <span key={i} className="chip text-[11px]">{i + 1}. {c.title}</span>)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Dot({ d = 0 }: { d?: number }) {
  return <span className="h-1.5 w-1.5 rounded-full bg-ink-300" style={{ animation: 'bounce-dot 1.2s infinite', animationDelay: `${d}ms` }} />;
}
