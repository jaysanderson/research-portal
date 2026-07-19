import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';

// Browser speech recognition (Chrome/Edge/Safari). Not in TS lib DOM by default.
type SpeechRec = any;
const Rec: any = typeof window !== 'undefined' ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : null;

/** Dictate into any text field — speak a query instead of typing it. */
export function MicButton({ onText, className = '' }: { onText: (text: string) => void; className?: string }) {
  const [listening, setListening] = useState(false);
  const ref = useRef<SpeechRec | null>(null);

  useEffect(() => () => { try { ref.current?.stop(); } catch { /* */ } }, []);
  if (!Rec) return null;

  const toggle = () => {
    if (listening) { try { ref.current?.stop(); } catch { /* */ } setListening(false); return; }
    const r: SpeechRec = new Rec();
    r.lang = navigator.language || 'en-US';
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e: any) => {
      const text = Array.from(e.results).map((res: any) => res[0].transcript).join('');
      onText(text);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    ref.current = r;
    setListening(true);
    try { r.start(); } catch { setListening(false); }
  };

  return (
    <button type="button" onClick={toggle} title={listening ? 'Stop dictation' : 'Dictate'} aria-label={listening ? 'Stop dictation' : 'Dictate'}
      className={`inline-flex items-center justify-center rounded-lg border px-2.5 py-1.5 transition-colors ${
        listening ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-ink-200 bg-white text-ink-500 hover:border-ink-300 hover:text-ink-700'
      } ${className}`}>
      {listening ? <MicOff size={15} className="animate-pulse" /> : <Mic size={15} />}
    </button>
  );
}
