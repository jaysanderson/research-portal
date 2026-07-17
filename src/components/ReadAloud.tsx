import { useEffect, useState } from 'react';
import { Volume2, Square } from 'lucide-react';

/** Read an answer aloud via the browser's built-in speech synthesis (no service, no key). */
export function ReadAloud({ text, className = '' }: { text: string; className?: string }) {
  const [speaking, setSpeaking] = useState(false);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => () => { if (supported) window.speechSynthesis.cancel(); }, [supported]);
  // Stop if the answer text changes underneath us.
  useEffect(() => { if (supported) { window.speechSynthesis.cancel(); setSpeaking(false); } }, [text, supported]);

  if (!supported || !text.trim()) return null;

  const toggle = () => {
    const synth = window.speechSynthesis;
    if (speaking) { synth.cancel(); setSpeaking(false); return; }
    synth.cancel();
    const clean = text.replace(/\[\d+\]/g, '').replace(/[#*_`>]/g, '').replace(/\s+/g, ' ').trim();
    const u = new SpeechSynthesisUtterance(clean);
    u.rate = 1.02; u.pitch = 1;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    synth.speak(u);
  };

  return (
    <button onClick={toggle} title={speaking ? 'Stop' : 'Read aloud'}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
        speaking ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:text-ink-800'
      } ${className}`}>
      {speaking ? <Square size={13} /> : <Volume2 size={14} />} {speaking ? 'Stop' : 'Listen'}
    </button>
  );
}
