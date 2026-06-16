import { useCallback, useRef, useState } from 'react';
import { ask, type Citation } from './nuclia';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  streaming?: boolean;
  error?: boolean;
}

export function useChat(opts: { filters?: string[]; resourceId?: string } = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const history = messages;
    const context = history.map((m) => ({ author: m.role === 'user' ? 'USER' : 'AGENT', text: m.content }));
    setMessages((m) => [...m, { role: 'user', content: q }, { role: 'assistant', content: '', streaming: true }]);
    setBusy(true);

    try {
      for await (const chunk of ask(q, { filters: opts.filters, resourceId: opts.resourceId, context, signal: ctrl.signal })) {
        if (chunk.kind === 'answer' && chunk.text) {
          setMessages((m) => { const c = [...m]; const last = c[c.length - 1]; if (last?.role === 'assistant') last.content += chunk.text; return c; });
        } else if (chunk.kind === 'citations' && chunk.citations) {
          setMessages((m) => { const c = [...m]; const last = c[c.length - 1]; if (last?.role === 'assistant') last.citations = chunk.citations; return c; });
        }
      }
    } catch (err) {
      if (!ctrl.signal.aborted) setMessages((m) => { const c = [...m]; const last = c[c.length - 1]; if (last?.role === 'assistant') { last.error = true; last.content = last.content || `Error: ${String(err).slice(0, 120)}`; } return c; });
    } finally {
      setMessages((m) => { const c = [...m]; const last = c[c.length - 1]; if (last?.role === 'assistant') last.streaming = false; return c; });
      if (!ctrl.signal.aborted) setBusy(false);
    }
  }, [messages, busy, opts.filters, opts.resourceId]);

  const stop = useCallback(() => { abortRef.current?.abort(); setBusy(false); }, []);
  const reset = useCallback(() => { abortRef.current?.abort(); setMessages([]); setBusy(false); }, []);

  return { messages, busy, send, stop, reset };
}
